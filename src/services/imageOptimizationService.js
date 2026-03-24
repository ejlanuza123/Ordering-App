import * as FileSystem from 'expo-file-system';
import { Image as ImageResizer } from 'react-native-image-resizer';
import { supabase } from '../lib/supabase';

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY = 0.8;

export const imageOptimizationService = {
  /**
   * Compress image before upload
   */
  async compressImage(imageUri) {
    try {
      // Get original file size
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      const originalSize = fileInfo.size / 1024 / 1024; // MB

      // Only compress if larger than 2MB
      if (originalSize > 2) {
        const response = await ImageResizer.createResizedImage(
          imageUri,
          MAX_WIDTH,
          MAX_HEIGHT,
          'JPEG',
          Math.round(QUALITY * 100),
          0
        );

        const compressedSize = response.size / 1024 / 1024;
        console.log(`Compressed ${originalSize.toFixed(2)}MB to ${compressedSize.toFixed(2)}MB`);

        return {
          success: true,
          uri: response.uri,
          width: response.width,
          height: response.height,
          originalSize,
          compressedSize
        };
      }

      return {
        success: true,
        uri: imageUri,
        originalSize,
        compressedSize: originalSize
      };
    } catch (error) {
      console.error('Error compressing image:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Generate thumbnail
   */
  async generateThumbnail(imageUri) {
    try {
      const response = await ImageResizer.createResizedImage(
        imageUri,
        300,
        300,
        'JPEG',
        70,
        0
      );

      return {
        success: true,
        uri: response.uri
      };
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Upload image to Supabase storage
   */
  async uploadImage(imageUri, bucket, filePath) {
    try {
      // Compress first
      const compressed = await this.compressImage(imageUri);
      if (!compressed.success) throw new Error(compressed.error);

      // Read file
      const data = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Upload to Supabase
      const { data: uploadData, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, data, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return {
        success: true,
        url: urlData.publicUrl,
        path: filePath,
        compressionInfo: {
          original: compressed.originalSize,
          compressed: compressed.compressedSize
        }
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(imageUris, bucket, basePath) {
    const results = [];

    for (let i = 0; i < imageUris.length; i++) {
      const filePath = `${basePath}/image-${i}-${Date.now()}.jpg`;
      const result = await this.uploadImage(imageUris[i], bucket, filePath);
      results.push(result);

      if (!result.success) {
        console.warn(`Failed to upload image ${i}:`, result.error);
      }
    }

    const successful = results.filter(r => r.success);
    return {
      success: successful.length > 0,
      results,
      urls: successful.map(r => r.url),
      failureCount: results.length - successful.length
    };
  },

  /**
   * Delete image from storage
   */
  async deleteImage(bucket, filePath) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting image:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get image metadata
   */
  async getImageMetadata(imageUri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      const { width, height } = await new Promise((resolve, reject) => {
        Image.getSize(imageUri, (width, height) => {
          resolve({ width, height });
        }, reject);
      });

      return {
        success: true,
        size: fileInfo.size,
        width,
        height,
        aspectRatio: width / height
      };
    } catch (error) {
      console.error('Error getting image metadata:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Cache image locally
   */
  async cacheImage(imageUri, cacheKey) {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      const cachedPath = `${cacheDir}${cacheKey}.jpg`;

      // Check if already cached
      const cachedInfo = await FileSystem.getInfoAsync(cachedPath);
      if (cachedInfo.exists) {
        return { success: true, uri: cachedPath, cached: true };
      }

      // Copy to cache
      await FileSystem.copyAsync({
        from: imageUri,
        to: cachedPath
      });

      return { success: true, uri: cachedPath, cached: false };
    } catch (error) {
      console.error('Error caching image:', error);
      return { success: false, error: error.message };
    }
  }
};
