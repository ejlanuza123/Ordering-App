import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const AddressContext = createContext(null);

export const AddressProvider = ({ children }) => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all addresses for the current user
  const fetchAddresses = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Add a new address
  const addAddress = useCallback(async (addressData) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      // If this is set as default, unset other defaults first
      if (addressData.is_default) {
        await supabase
          .from('user_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { data, error } = await supabase
        .from('user_addresses')
        .insert([{
          user_id: user.id,
          label: addressData.label,
          address: addressData.address,
          address_lat: addressData.address_lat,
          address_lng: addressData.address_lng,
          is_default: addressData.is_default || false
        }])
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setAddresses(prev => {
        const updated = [data, ...prev];
        if (data.is_default) {
          return updated.map(a => a.id === data.id ? data : { ...a, is_default: false });
        }
        return updated;
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error adding address:', error.message);
      return { success: false, error: error.message };
    }
  }, [user]);

  // Update an existing address
  const updateAddress = useCallback(async (addressId, addressData) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      // If setting as default, unset other defaults first
      if (addressData.is_default) {
        await supabase
          .from('user_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', addressId);
      }

      const { data, error } = await supabase
        .from('user_addresses')
        .update({
          label: addressData.label,
          address: addressData.address,
          address_lat: addressData.address_lat,
          address_lng: addressData.address_lng,
          is_default: addressData.is_default || false,
          updated_at: new Date().toISOString()
        })
        .eq('id', addressId)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setAddresses(prev => {
        const updated = prev.map(a => a.id === addressId ? data : a);
        if (data.is_default) {
          return updated.map(a => a.id === data.id ? data : { ...a, is_default: false });
        }
        return updated;
      });

      return { success: true, data };
    } catch (error) {
      console.error('Error updating address:', error.message);
      return { success: false, error: error.message };
    }
  }, [user]);

  // Delete an address
  const deleteAddress = useCallback(async (addressId) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', addressId);

      if (error) throw error;

      // Update local state
      setAddresses(prev => prev.filter(a => a.id !== addressId));

      return { success: true };
    } catch (error) {
      console.error('Error deleting address:', error.message);
      return { success: false, error: error.message };
    }
  }, [user]);

  // Set an address as default
  const setDefaultAddress = useCallback(async (addressId) => {
    return await updateAddress(addressId, { 
      ...addresses.find(a => a.id === addressId),
      is_default: true 
    });
  }, [addresses, updateAddress]);

  // Get the default address
  const getDefaultAddress = useCallback(() => {
    return addresses.find(a => a.is_default) || addresses[0] || null;
  }, [addresses]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    fetchAddresses();

    const channel = supabase
      .channel('user-addresses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_addresses',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchAddresses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAddresses]);

  const value = {
    addresses,
    loading,
    fetchAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getDefaultAddress
  };

  return (
    <AddressContext.Provider value={value}>
      {children}
    </AddressContext.Provider>
  );
};

// Custom hook to use address context
export const useAddresses = () => {
  const context = useContext(AddressContext);
  if (!context) {
    throw new Error('useAddresses must be used within an AddressProvider');
  }
  return context;
};

