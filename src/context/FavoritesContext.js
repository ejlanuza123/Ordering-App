import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const loadFavorites = async () => {
    if (!user) {
      setFavorites(new Set());
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', user.id);
      if (!error && data) {
        setFavorites(new Set(data.map(r => r.product_id)));
      }
    } catch (e) {
      console.warn('Unable to load favorites', e);
    } finally {
      setLoading(false);
    }
  };

  const isFavorite = (productId) => {
    return favorites.has(productId);
  };

  const toggleFavorite = async (productId) => {
    if (!user) return false;
    const currently = favorites.has(productId);
    try {
      if (currently) {
        const { error } = await supabase.from('favorites').delete()
          .match({ user_id: user.id, product_id: productId });
        if (error) throw error;
        setFavorites(prev => {
          const s = new Set(prev);
          s.delete(productId);
          return s;
        });
        return false; // now removed
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
        setFavorites(prev => new Set(prev).add(productId));
        return true; // now added
      }
    } catch (e) {
      console.warn('favorite toggle failed', e);
      return currently; // no change
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [user]);

  return (
    <FavoritesContext.Provider
      value={{ favorites, loading, isFavorite, loadFavorites, toggleFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
