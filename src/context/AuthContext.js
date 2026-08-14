// src/context/AuthContext.js (updated)
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

const LOCAL_CACHED_AUTH_KEY = '@app_cached_auth_v1';
const ALLOWED_ROLES = ['customer', 'rider'];
const AUTH_BOOTSTRAP_TIMEOUT_MS = 10000;
const BACKGROUND_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 mins
const RECOVERY_PENDING_KEY = 'auth_recovery_pending_password_reset';
const RECOVERY_CANCELLED_KEY = 'auth_recovery_cancelled_password_reset';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef(AppState.currentState);
  const backgroundedAtRef = useRef(null);
  const isHydratedRef = useRef(false);

  const withTimeout = (operation, timeoutMs, timeoutMessage) => {
    if (!operation || typeof operation.then !== 'function') {
      return Promise.resolve(operation);
    }
    let timeoutId;

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });

    return Promise.race([
      operation.finally(() => clearTimeout(timeoutId)),
      timeoutPromise,
    ]);
  };

  const clearAuthState = async () => {
    setUser(null);
    setProfile(null);
    setRole(null);
    try {
      await AsyncStorage.removeItem(LOCAL_CACHED_AUTH_KEY);
    } catch (_) {}
  };

  const clearPersistedAuthStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const authKeys = (keys || []).filter((key) =>
        key.includes('supabase') || key.includes('sb-') || key.includes('auth_recovery_') || key === LOCAL_CACHED_AUTH_KEY
      );

      if (authKeys.length > 0) {
        await AsyncStorage.multiRemove(authKeys);
      }
    } catch (storageError) {
      console.warn('Failed to clear persisted auth storage:', storageError);
    }
  };

  const signOutLocalFirst = async () => {
    try {
      const res = await supabase.auth.signOut({ scope: 'local' });
      if (res?.error) {
        await supabase.auth.signOut();
      }
    } catch (_) {
      try {
        await supabase.auth.signOut();
      } catch (__) {}
    }
    await clearPersistedAuthStorage();
    await clearAuthState();
  };

  const shouldSuppressRecoverySession = async () => {
    const [pendingRecovery, cancelledRecovery] = await Promise.all([
      AsyncStorage.getItem(RECOVERY_PENDING_KEY),
      AsyncStorage.getItem(RECOVERY_CANCELLED_KEY),
    ]);

    return pendingRecovery === '1' || cancelledRecovery === '1';
  };

  // 1. Optimistic Local Hydration to prevent login screen flash
  const hydrateFromCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(LOCAL_CACHED_AUTH_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.user && cached?.profile && ALLOWED_ROLES.includes(cached?.role)) {
          setUser(cached.user);
          setProfile(cached.profile);
          setRole(cached.role);
          isHydratedRef.current = true;
        }
      }
    } catch (err) {
      console.warn('Cache hydration notice:', err?.message);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Step A: Hydrate from fast local cache immediately
        await hydrateFromCache();

        // Step B: Verify / refresh session with backend
        await checkUser();
      } catch (_) {
        // Handled within checkUser
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes (token refresh, user signs in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        try {
          if (await shouldSuppressRecoverySession()) {
            await signOutLocalFirst();
            return;
          }

          await withTimeout(
            fetchUserProfile(session.user),
            AUTH_BOOTSTRAP_TIMEOUT_MS,
            'Auth profile lookup timed out.'
          );
        } catch (err) {
          console.warn('onAuthStateChange profile sync notice:', err?.message);
        } finally {
          if (isMounted) setLoading(false);
        }
      } else if (event === 'SIGNED_OUT' || !session) {
        await clearAuthState();
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Background to foreground resume handler
  useEffect(() => {
    const handleAppStateChange = async (nextState) => {
      const prevState = appStateRef.current;

      if (prevState === 'active' && (nextState === 'inactive' || nextState === 'background')) {
        backgroundedAtRef.current = Date.now();
      }

      if ((prevState === 'inactive' || prevState === 'background') && nextState === 'active') {
        const backgroundedAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;

        if (backgroundedAt && Date.now() - backgroundedAt > BACKGROUND_INACTIVITY_TIMEOUT_MS) {
          await signOut();
          return;
        }

        checkUser({ silent: true });
      }

      appStateRef.current = nextState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const checkUser = async ({ silent = false } = {}) => {
    try {
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_BOOTSTRAP_TIMEOUT_MS,
        'Auth session check timed out.'
      );

      if (session?.user) {
        if (await shouldSuppressRecoverySession()) {
          await signOutLocalFirst();
          return;
        }

        await withTimeout(
          fetchUserProfile(session.user),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
          'Auth profile lookup timed out.'
        );
      } else {
        if (!isHydratedRef.current) {
          await clearAuthState();
        }
      }
    } catch (error) {
      console.log('Auth check error:', error);
      const message = error?.message || '';
      const isExplicitInvalidToken = 
        message.toLowerCase().includes('invalid refresh token') || 
        message.toLowerCase().includes('refresh token not found') ||
        message.toLowerCase().includes('user_not_found');

      if (isExplicitInvalidToken) {
        await clearPersistedAuthStorage();
        await clearAuthState();
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // ignore
        }
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchUserProfile = async (currentUser, attempt = 0) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        return fetchUserProfile(currentUser, attempt + 1);
      }

      throw new Error('Account profile not found. Please contact support.');
    }

    // Only allow customer/rider roles in this app.
    if (!ALLOWED_ROLES.includes(data.role)) {
      await signOutLocalFirst();
      throw new Error('This account is not allowed to access the app.');
    }

    setUser(currentUser);
    setProfile(data);
    setRole(data.role);

    // Save to local cache for instant zero-latency startup on next app launch
    try {
      await AsyncStorage.setItem(LOCAL_CACHED_AUTH_KEY, JSON.stringify({
        user: currentUser,
        profile: data,
        role: data.role,
        cachedAt: Date.now(),
      }));
    } catch (cacheErr) {
      console.warn('Failed to update local auth cache:', cacheErr?.message);
    }
  };

  const signIn = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();

    await Promise.all([
      AsyncStorage.removeItem(RECOVERY_PENDING_KEY),
      AsyncStorage.removeItem(RECOVERY_CANCELLED_KEY),
    ]);

    try {
      const preProfileRes = await supabase
        .from('profiles')
        .select('role')
        .ilike('email', normalizedEmail)
        .single();

      if (preProfileRes?.data && !ALLOWED_ROLES.includes(preProfileRes.data.role)) {
        throw new Error('This account is not allowed to access the app.');
      }
    } catch (preErr) {
      if (preErr.message === 'This account is not allowed to access the app.') {
        throw preErr;
      }
    }

    const signInRes = await withTimeout(
      supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      }),
      AUTH_BOOTSTRAP_TIMEOUT_MS,
      'Login timed out. Please try again.'
    );
    const { data, error } = signInRes || {};
    if (error) throw error;
    
    if (data?.user) {
      try {
        await withTimeout(
          fetchUserProfile(data.user),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
          'Auth profile lookup timed out.'
        );
      } catch (profileError) {
        const message = profileError?.message || '';
        if (message.toLowerCase().includes('cannot coerce the result to a single json object')) {
          throw new Error('Account profile not found. Please contact support.');
        }
        throw profileError;
      }
    }
  };

  const signOut = async () => {
    if (role === 'rider' && user?.id) {
      try {
        const { riderPresenceService } = await import('../services/riderPresenceService');
        await riderPresenceService.setOnlineStatus(user.id, false);
      } catch (err) {
        console.warn('Failed to set rider offline before sign out:', err);
      }
    }
    await signOutLocalFirst();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      role, 
      loading, 
      signIn, 
      signOut,
      isAuthenticated: !!user,
      isRider: role === 'rider',
      isCustomer: role === 'customer'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);