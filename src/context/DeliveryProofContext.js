import React, { createContext, useContext, useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const DeliveryProofContext = createContext(null);

export const DeliveryProofProvider = ({ children }) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);

  // Upload delivery proof photo
  const uploadProofPhoto = useCallback(async (uri, deliveryId) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      setUploading(true);

      // Get file extension
      const uriParts = uri.split('.');
      const extension = uriParts[uriParts.length - 1].toLowerCase();
      
      // Generate unique filename
      const filename = `delivery_proofs/${deliveryId}_${Date.now()}.${extension}`;

      // Read the file as base64 (works more reliably in React Native / Expo)
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const buffer = decode(base64);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('delivery-proofs')
        .upload(filename, buffer, {
          contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('delivery-proofs')
        .getPublicUrl(filename);

      return { success: true, photoUrl: publicUrl };
    } catch (error) {
      console.error('Error uploading proof photo:', error.message);
      return { success: false, error: error.message };
    } finally {
      setUploading(false);
    }
  }, [user]);

  // Save delivery proof
  const saveDeliveryProof = useCallback(async (proofData) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      // Debug info: check what Supabase sees for auth.uid() and related delivery/order rows
      const { data: deliveryRow, error: deliveryError } = await supabase
        .from('deliveries')
        .select('id, rider_id, order_id')
        .eq('id', proofData.delivery_id)
        .single();

      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select('id, rider_id')
        .eq('id', deliveryRow?.order_id)
        .single();

      console.log('✅ Delivery proof debug:', {
        authUid: user?.id,
        deliveryRow,
        orderRow
      });

      if (deliveryError) {
        console.warn('Delivery lookup error (for proof insert):', deliveryError);
      }
      if (orderError) {
        console.warn('Order lookup error (for proof insert):', orderError);
      }

      const { data, error } = await supabase
        .from('delivery_proofs')
        .insert([{
          delivery_id: proofData.delivery_id,
          photo_url: proofData.photo_url,
          signature_data: proofData.signature_data,
          recipient_name: proofData.recipient_name,
          notes: proofData.notes,
          delivered_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error saving delivery proof:', error.message);
      return { success: false, error: error.message };
    }
  }, [user]);

  // Get delivery proof by delivery ID
  const getProofByDeliveryId = useCallback(async (deliveryId) => {
    try {
      const { data, error } = await supabase
        .from('delivery_proofs')
        .select('*')
        .eq('delivery_id', deliveryId)
        .single();

      if (error) {
        // If no proof found, return null (not an error)
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching delivery proof:', error.message);
      return null;
    }
  }, []);

  // Update delivery proof
  const updateDeliveryProof = useCallback(async (proofId, proofData) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('delivery_proofs')
        .update({
          photo_url: proofData.photo_url,
          signature_data: proofData.signature_data,
          recipient_name: proofData.recipient_name,
          notes: proofData.notes
        })
        .eq('id', proofId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating delivery proof:', error.message);
      return { success: false, error: error.message };
    }
  }, [user]);

  const value = {
    uploading,
    uploadProofPhoto,
    saveDeliveryProof,
    getProofByDeliveryId,
    updateDeliveryProof
  };

  return (
    <DeliveryProofContext.Provider value={value}>
      {children}
    </DeliveryProofContext.Provider>
  );
};

// Custom hook to use delivery proof context
export const useDeliveryProof = () => {
  const context = useContext(DeliveryProofContext);
  if (!context) {
    throw new Error('useDeliveryProof must be used within a DeliveryProofProvider');
  }
  return context;
};

