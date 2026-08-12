// src/utils/imageCompressor.js
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresses an image URI before uploading to Supabase Storage on mobile devices.
 * Resizes max width to 1200px and sets compression quality to 0.75.
 *
 * @param {string} imageUri - Original local image URI from image picker/camera
 * @param {Object} [options]
 * @param {number} [options.maxWidth=1200]
 * @param {number} [options.quality=0.75]
 * @returns {Promise<string>} Compressed image URI
 */
export async function compressMobileImage(imageUri, options = {}) {
  const { maxWidth = 1200, quality = 0.75 } = options;

  if (!imageUri) return imageUri;

  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    return manipResult.uri;
  } catch (err) {
    console.warn('Failed to compress mobile image, using original URI:', err);
    return imageUri;
  }
}
