import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const RiderRatingContext = createContext(null);

export const RiderRatingProvider = ({ children }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Get average rating for a rider
  const getRiderRating = useCallback(async (riderId) => {
    try {
      const { data, error } = await supabase
        .from('rider_ratings')
        .select('rating')
        .eq('rider_id', riderId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return { average: 0, count: 0 };
      }

      const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
      const average = totalRating / data.length;

      return {
        average: Math.round(average * 10) / 10,
        count: data.length
      };
    } catch (error) {
      console.error('Error getting rider rating:', error.message);
      return { average: 0, count: 0 };
    }
  }, []);

  // Get all ratings for a rider
  const getRiderRatings = useCallback(async (riderId, limit = 10) => {
    try {
      const { data, error } = await supabase
        .from('rider_ratings')
        .select(`
          *,
          profiles:user_id (
            full_name
          )
        `)
        .eq('rider_id', riderId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching rider ratings:', error.message);
      return [];
    }
  }, []);

  // Rate a rider after delivery
  const rateRider = useCallback(async (riderId, deliveryId, rating, comment) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('rider_ratings')
        .insert([{
          rider_id: riderId,
          user_id: user.id,
          delivery_id: deliveryId,
          rating: rating,
          comment: comment || null
        }])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error rating rider:', error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update a rating
  const updateRating = useCallback(async (ratingId, rating, comment) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('rider_ratings')
        .update({
          rating: rating,
          comment: comment || null
        })
        .eq('id', ratingId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating rating:', error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check if user has rated a delivery
  const hasUserRated = useCallback(async (deliveryId) => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('rider_ratings')
        .select('id')
        .eq('delivery_id', deliveryId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return false;
        }
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking user rating:', error.message);
      return false;
    }
  }, [user]);

  // Get user's rating for a delivery
  const getUserRating = useCallback(async (deliveryId) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('rider_ratings')
        .select('*')
        .eq('delivery_id', deliveryId)
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
      console.error('Error fetching user rating:', error.message);
      return null;
    }
  }, [user]);

  // Get rider's statistics
  const getRiderStats = useCallback(async (riderId) => {
    try {
      const { data, error } = await supabase
        .from('rider_ratings')
        .select('rating')
        .eq('rider_id', riderId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          totalRatings: 0,
          averageRating: 0,
          fiveStars: 0,
          fourStars: 0,
          threeStars: 0,
          twoStars: 0,
          oneStar: 0
        };
      }

      const totalRatings = data.length;
      const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / totalRatings;

      return {
        totalRatings,
        averageRating: Math.round(averageRating * 10) / 10,
        fiveStars: data.filter(r => r.rating === 5).length,
        fourStars: data.filter(r => r.rating === 4).length,
        threeStars: data.filter(r => r.rating === 3).length,
        twoStars: data.filter(r => r.rating === 2).length,
        oneStar: data.filter(r => r.rating === 1).length
      };
    } catch (error) {
      console.error('Error getting rider stats:', error.message);
      return null;
    }
  }, []);

  const value = {
    loading,
    getRiderRating,
    getRiderRatings,
    rateRider,
    updateRating,
    hasUserRated,
    getUserRating,
    getRiderStats
  };

  return (
    <RiderRatingContext.Provider value={value}>
      {children}
    </RiderRatingContext.Provider>
  );
};

// Custom hook to use rider rating context
export const useRiderRatings = () => {
  const context = useContext(RiderRatingContext);
  if (!context) {
    throw new Error('useRiderRatings must be used within a RiderRatingProvider');
  }
  return context;
};

