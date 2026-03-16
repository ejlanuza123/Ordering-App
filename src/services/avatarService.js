// src/services/avatarService.js
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';

const AVATAR_BUCKET = 'avatars';

export const avatarService = {
  // Request permissions
  async requestPermissions() {
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    
    return mediaStatus === 'granted' && cameraStatus === 'granted';
  },

  // Pick image from gallery
  async pickImage() {
    try {
      console.log('📷 Attempting to open Image Library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // 🟢 The correct, warning-free modern syntax
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false, 
      });
      
      console.log('📷 Image Library Result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0];
      } else {
        console.log('📷 Upload cancelled or no assets found');
        return null;
      }
    } catch (error) {
      console.error('📷 ImagePicker Gallery Error:', error);
      return null;
    }
  },

  // Take photo with camera
  async takePhoto() {
    try {
      console.log('📷 Attempting to open Camera...');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission required');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'], // 🟢 The correct, warning-free modern syntax
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('📷 Camera Result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0];
      } else {
        console.log('📷 Upload cancelled or no assets found');
        return null;
      }
    } catch (error) {
      console.error('📷 ImagePicker Camera Error:', error);
      return null;
    }
  },

  // Upload avatar to Supabase
  async uploadAvatar(userId, imageUri) {
    try {
      console.log('🔵 SUPABASE: Starting upload for user:', userId);

      // Extract extension securely (fallback to jpeg if the URI lacks an extension)
      const extensionMatch = imageUri.match(/\.([a-zA-Z0-9]+)$/);
      const fileExt = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpeg';
      const fileName = `public/${userId}/${Date.now()}.${fileExt}`;
      const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

      console.log('🔵 SUPABASE: File path:', fileName);

      // 1. Read the image as a base64 string using Expo FileSystem
      const base64 = await FileSystem.readAsStringAsync(imageUri, { 
        encoding: FileSystem.EncodingType.Base64 
      });

      // 2. Upload the decoded base64 arraybuffer to Supabase
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(fileName, decode(base64), {
          contentType: contentType,
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      console.log('🔵 SUPABASE: Upload successful:', uploadData);

      // 3. Get public URL
      const { data } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;
      console.log('🔵 SUPABASE: Public URL:', publicUrl);

      // 4. Update profile with new avatar URL
      console.log('🔵 SUPABASE: Updating profile...');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          avatar_updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Profile update failed: ${updateError.message}`);
      }

      console.log('🔵 SUPABASE: Profile updated successfully');
      return publicUrl;
    } catch (error) {
      console.log('🔵 SUPABASE: Error in uploadAvatar:', error);
      throw error;
    }
  },

  // Delete avatar
  async deleteAvatar(userId, avatarUrl) {
    try {
      if (!avatarUrl) {
        console.log('No avatar URL to delete');
        return;
      }

      console.log('Deleting avatar:', avatarUrl);

      // Extract file path from URL
      const urlParts = avatarUrl.split('/avatars/');
      if (urlParts.length < 2) {
        console.log('Could not extract file path from URL');
        return;
      }
      
      const filePath = urlParts[1];
      console.log('Extracted file path:', filePath);

      // Delete from storage
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([filePath]);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      console.log('File deleted from storage');

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: null,
          avatar_updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw error;
    }
  }
};