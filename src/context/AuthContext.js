// src/context/AuthContext.js (updated)
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const ALLOWED_ROLES = ['customer', 'rider'];

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          await fetchUserProfile(session.user);
        } catch {
          // If role is invalid we already signed out in fetchUserProfile
        }
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Only set user after we confirm role is allowed.
        await fetchUserProfile(session.user);
      }
    } catch (error) {
      console.log('Auth check error:', error);
      setUser(null);
      setProfile(null);
      setRole(null);
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
      setUser(null);
      setProfile(null);
      setRole(null);
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
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
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