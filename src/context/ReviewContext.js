import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ReviewContext = createContext(null);

export const ReviewProvider = ({ children }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Get average rating for a product
  const getProductRating = useCallback(async (productId) => {
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('rating')
        .eq('product_id', productId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return { average: 0, count: 0 };
      }

      const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
      const average = totalRating / data.length;

      return {
        average: Math.round(average * 10) / 10, // Round to 1 decimal
        count: data.length
      };
    } catch (error) {
      console.error('Error getting product rating:', error.message);
      return { average: 0, count: 0 };
    }
  }, []);

  // Get all reviews for a product
  const getProductReviews = useCallback(async (productId, limit = 10) => {
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`
          *,
          profiles:user_id (
            full_name
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching product reviews:', error.message);
      return [];
    }
  }, []);

  // Add a review to a product
  const addReview = useCallback(async (productId, rating, comment) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('product_reviews')
        .insert([{
          product_id: productId,
          user_id: user.id,
          rating: rating,
          comment: comment || null
        }])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error adding review:', error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update a review
  const updateReview = useCallback(async (reviewId, rating, comment) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('product_reviews')
        .update({
          rating: rating,
          comment: comment || null
        })
        .eq('id', reviewId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating review:', error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Delete a review
  const deleteReview = useCallback(async (reviewId) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('product_reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user.id);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error deleting review:', error.message);
      return { success: false, error: error.message };
    }
  }, [user]);

  // Check if user has reviewed a product
  const hasUserReviewed = useCallback(async (productId) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('id')
        .eq('product_id', productId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no review found, return false (not an error)
        if (error.code === 'PGRST116') {
          return false;
        }
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking user review:', error.message);
      return false;
    }
  }, [user]);

  // Get user's review for a product
  const getUserReview = useCallback(async (productId) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user review:', error.message);
      return null;
    }
  }, [user]);

  // Get user's reviews
  const getUserReviews = useCallback(async () => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select(`
          *,
          products:product_id (
            name,
            image_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching user reviews:', error.message);
      return [];
    }
  }, [user]);

  const value = {
    loading,
    getProductRating,
    getProductReviews,
    addReview,
    updateReview,
    deleteReview,
    hasUserReviewed,
    getUserReview,
    getUserReviews
  };

  return (
    <ReviewContext.Provider value={value}>
      {children}
    </ReviewContext.Provider>
  );
};

// Custom hook to use review context
export const useReviews = () => {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReviews must be used within a ReviewProvider');
  }
  return context;
};

