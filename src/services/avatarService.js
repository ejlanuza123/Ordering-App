// src/services/avatarService.js
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

const AVATAR_BUCKET = 'avatars';
const devLog = (...args) => {
  if (__DEV__) {
    console.log(...args);
  }
};

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
      devLog('Opening image library');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // 🟢 The correct, warning-free modern syntax
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false, 
      });
      
      devLog('Image library result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0];
      } else {
        devLog('Upload canceled or no assets found');
        return null;
      }
    } catch (error) {
      devLog('ImagePicker gallery error:', error);
      return null;
    }
  },

  // Take photo with camera
  async takePhoto() {
    try {
      devLog('Opening camera');
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

      devLog('Camera result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0];
      } else {
        devLog('Upload canceled or no assets found');
        return null;
      }
    } catch (error) {
      devLog('ImagePicker camera error:', error);
      return null;
    }
  },

  // Upload avatar to Supabase
  async uploadAvatar(userId, imageUri) {
    try {
      devLog('Starting avatar upload for user:', userId);

      // Extract extension securely (fallback to jpeg if the URI lacks an extension)
      const extensionMatch = imageUri.match(/\.([a-zA-Z0-9]+)$/);
      const fileExt = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpeg';
      const fileName = `public/${userId}/${Date.now()}.${fileExt}`;
      const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

      devLog('Avatar file path:', fileName);

      // 1. Read the image as a base64 string using Expo FileSystem
      const base64 = await FileSystem.readAsStringAsync(imageUri, { 
        encoding: 'base64' 
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

      devLog('Avatar upload successful:', uploadData);

      // 3. Get public URL
      const { data } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;
      devLog('Avatar public URL:', publicUrl);

      // 4. Update profile with new avatar URL
      devLog('Updating avatar profile metadata');
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

      devLog('Avatar profile updated successfully');
      return publicUrl;
    } catch (error) {
      console.error('Error in uploadAvatar:', error);
      throw error;
    }
  },

  // Delete avatar
  async deleteAvatar(userId, avatarUrl) {
    try {
      if (!avatarUrl) {
        devLog('No avatar URL to delete');
        return;
      }

      devLog('Starting avatar delete for user:', userId);

      // Improved URL parsing with regex fallback
      let filePath = null;
      const urlParts = avatarUrl.split('/avatars/');
      if (urlParts.length >= 2) {
        filePath = urlParts[1];
      } else {
        // Regex fallback for different URL formats
        const match = avatarUrl.match(/\/avatars\/(.*)$/);
        if (match) {
          filePath = match[1];
        }
      }

      if (!filePath) {
        const err = new Error('Could not extract file path from avatar URL: ' + avatarUrl);
        console.error('Avatar delete error:', err.message);
        throw err;
      }

      devLog('Avatar file path extracted:', filePath);

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([filePath]);

      if (deleteError) {
        console.error('Avatar storage delete error:', deleteError);
        throw new Error(`Storage delete failed: ${deleteError.message}`);
      }

      devLog('Avatar file deleted from storage');

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: null,
          avatar_updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Avatar profile update error:', updateError);
        throw new Error(`Profile update failed: ${updateError.message}`);
      }

      devLog('Avatar removed from profile successfully');
    } catch (error) {
      console.error('Delete avatar failed:', error);
      throw error;
    }
  }
};