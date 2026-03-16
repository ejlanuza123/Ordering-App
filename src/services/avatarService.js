// src/services/avatarService.js
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase';
import { Platform } from 'react-native';

const AVATAR_BUCKET = 'avatars';
const MAX_SIZE = 500; // 500px max dimension
const QUALITY = 0.8; // 80% quality

export const avatarService = {
  // Request permissions
  async requestPermissions() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  },

  // Pick image from gallery
  async pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      return result.assets[0];
    }
    return null;
  },

  // Take photo with camera
  async takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Camera permission required');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      return result.assets[0];
    }
    return null;
  },

  // Process and resize image
  async processImage(uri) {
    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_SIZE, height: MAX_SIZE } }],
        { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipulatedImage;
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  },

  // Upload avatar to Supabase
  async uploadAvatar(userId, imageUri) {
    try {
      // Process image first
      const processedImage = await this.processImage(imageUri);

      // Generate unique filename
      const fileExt = processedImage.uri.split('.').pop();
      const fileName = `public/${userId}/${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Convert image to blob
      const response = await fetch(processedImage.uri);
      const blob = await response.blob();

      // Upload to Supabase
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          avatar_updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  },

  // Delete avatar
  async deleteAvatar(userId, avatarUrl) {
    try {
      if (!avatarUrl) return;

      // Extract file path from URL
      const urlParts = avatarUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `public/${userId}/${fileName}`;

      // Delete from storage
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([filePath]);

      if (error) throw error;

      // Update profile
      await supabase
        .from('profiles')
        .update({ 
          avatar_url: null,
          avatar_updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw error;
    }
  }
};