// src/context/AuthContext.js (updated)
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef(AppState.currentState);
  const backgroundedAtRef = useRef(null);

  const ALLOWED_ROLES = ['customer', 'rider'];
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const RECOVERY_PENDING_KEY = 'auth_recovery_pending_password_reset';
  const RECOVERY_CANCELLED_KEY = 'auth_recovery_cancelled_password_reset';

  const clearAuthState = () => {
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  const signOutLocalFirst = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      await supabase.auth.signOut();
    }
  };

  const shouldSuppressRecoverySession = async () => {
    const [pendingRecovery, cancelledRecovery] = await Promise.all([
      AsyncStorage.getItem(RECOVERY_PENDING_KEY),
      AsyncStorage.getItem(RECOVERY_CANCELLED_KEY),
    ]);

    return pendingRecovery === '1' || cancelledRecovery === '1';
  };

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          if (await shouldSuppressRecoverySession()) {
            await signOutLocalFirst();
            clearAuthState();
            return;
          }

          await fetchUserProfile(session.user);
        } catch {
          // If role is invalid we already signed out in fetchUserProfile
        }
      } else {
        clearAuthState();
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextState) => {
      const prevState = appStateRef.current;

      if (prevState === 'active' && (nextState === 'inactive' || nextState === 'background')) {
        backgroundedAtRef.current = Date.now();
      }

      if ((prevState === 'inactive' || prevState === 'background') && nextState === 'active') {
        const backgroundedAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;

        if (backgroundedAt) {
          const elapsed = Date.now() - backgroundedAt;

          if (elapsed >= SESSION_TIMEOUT_MS) {
            try {
              await supabase.auth.signOut();
            } finally {
              setUser(null);
              setProfile(null);
              setRole(null);
            }
          } else {
            checkUser();
          }
        }
      }

      appStateRef.current = nextState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (await shouldSuppressRecoverySession()) {
          await signOutLocalFirst();
          clearAuthState();
          return;
        }

        // Only set user after we confirm role is allowed.
        await fetchUserProfile(session.user);
      }
    } catch (error) {
      console.log('Auth check error:', error);
      clearAuthState();
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (user) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('User profile not found');
    }

    // Only allow customer/rider roles in this app.
    if (!ALLOWED_ROLES.includes(data.role)) {
      await supabase.auth.signOut();
      clearAuthState();
      throw new Error('This account is not allowed to access the app.');
    }

    setUser(user);
    setProfile(data);
    setRole(data.role);
  };

  const signIn = async (email, password) => {
    // Prevent admin or other unsupported roles from ever signing in.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .ilike('email', email)
      .single();

    if (profile && !ALLOWED_ROLES.includes(profile.role)) {
      throw new Error('This account is not allowed to access the app.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    
    if (data.user) {
      await fetchUserProfile(data.user);
    }
  };

  const signOut = async () => {
    await signOutLocalFirst();
    clearAuthState();
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