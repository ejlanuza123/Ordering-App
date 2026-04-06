const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockCreateResizedImage = jest.fn();

const mockStorageUpload = jest.fn();
const mockStorageGetPublicUrl = jest.fn();
const mockStorageRemove = jest.fn();
const mockStorageFrom = jest.fn();

jest.mock('expo-file-system', () => ({
  getInfoAsync: (...args) => mockGetInfoAsync(...args),
  readAsStringAsync: (...args) => mockReadAsStringAsync(...args),
  copyAsync: (...args) => mockCopyAsync(...args),
  cacheDirectory: 'file:///cache/',
  EncodingType: {
    Base64: 'base64',
  },
}), { virtual: true });

jest.mock('react-native-image-resizer', () => ({
  Image: {
    createResizedImage: (...args) => mockCreateResizedImage(...args),
  },
}), { virtual: true });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: (...args) => mockStorageFrom(...args),
    },
  },
}));

describe('imageOptimizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockStorageUpload.mockResolvedValue({ data: { path: 'products/a.jpg' }, error: null });
    mockStorageGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.test/products/a.jpg' },
    });
    mockStorageRemove.mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({
      upload: mockStorageUpload,
      getPublicUrl: mockStorageGetPublicUrl,
      remove: mockStorageRemove,
    });

    mockReadAsStringAsync.mockResolvedValue('BASE64_IMAGE_DATA');
    mockCopyAsync.mockResolvedValue(undefined);
  });

  it('compresses large image when size is above 2MB', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockGetInfoAsync.mockResolvedValue({ size: 3 * 1024 * 1024, exists: true });
    mockCreateResizedImage.mockResolvedValue({
      uri: 'file:///tmp/compressed.jpg',
      width: 1000,
      height: 1000,
      size: 1 * 1024 * 1024,
    });

    const result = await imageOptimizationService.compressImage('file:///tmp/original.jpg');

    expect(result.success).toBe(true);
    expect(result.uri).toBe('file:///tmp/compressed.jpg');
    expect(result.originalSize).toBe(3);
    expect(result.compressedSize).toBe(1);
    expect(mockCreateResizedImage).toHaveBeenCalledWith(
      'file:///tmp/original.jpg',
      1200,
      1200,
      'JPEG',
      80,
      0
    );
  });

  it('returns original image when size is 2MB or less', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockGetInfoAsync.mockResolvedValue({ size: 2 * 1024 * 1024, exists: true });

    const result = await imageOptimizationService.compressImage('file:///tmp/small.jpg');

    expect(result).toEqual({
      success: true,
      uri: 'file:///tmp/small.jpg',
      originalSize: 2,
      compressedSize: 2,
    });
    expect(mockCreateResizedImage).not.toHaveBeenCalled();
  });

  it('returns failure when image compression throws', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockGetInfoAsync.mockRejectedValue(new Error('cannot read file info'));

    const result = await imageOptimizationService.compressImage('file:///tmp/bad.jpg');

    expect(result).toEqual({ success: false, error: 'cannot read file info' });
  });

  it('generates thumbnail image', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockCreateResizedImage.mockResolvedValue({ uri: 'file:///tmp/thumb.jpg' });

    const result = await imageOptimizationService.generateThumbnail('file:///tmp/original.jpg');

    expect(result).toEqual({ success: true, uri: 'file:///tmp/thumb.jpg' });
    expect(mockCreateResizedImage).toHaveBeenCalledWith(
      'file:///tmp/original.jpg',
      300,
      300,
      'JPEG',
      70,
      0
    );
  });

  it('returns failure when thumbnail generation throws', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockCreateResizedImage.mockRejectedValue(new Error('thumbnail failed'));

    const result = await imageOptimizationService.generateThumbnail('file:///tmp/original.jpg');

    expect(result).toEqual({ success: false, error: 'thumbnail failed' });
  });

  it('uploads compressed image and returns public url', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    jest.spyOn(imageOptimizationService, 'compressImage').mockResolvedValue({
      success: true,
      uri: 'file:///tmp/compressed.jpg',
      originalSize: 4,
      compressedSize: 1.2,
    });

    const result = await imageOptimizationService.uploadImage(
      'file:///tmp/original.jpg',
      'products',
      'products/u-1.jpg'
    );

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///tmp/compressed.jpg', {
      encoding: 'base64',
    });
    expect(mockStorageUpload).toHaveBeenCalledWith('products/u-1.jpg', 'BASE64_IMAGE_DATA', {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    });
    expect(result).toEqual({
      success: true,
      url: 'https://cdn.test/products/a.jpg',
      path: 'products/u-1.jpg',
      compressionInfo: {
        original: 4,
        compressed: 1.2,
      },
    });
  });

  it('returns failure when uploadImage compression fails', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    jest.spyOn(imageOptimizationService, 'compressImage').mockResolvedValue({
      success: false,
      error: 'compress failed',
    });

    const result = await imageOptimizationService.uploadImage(
      'file:///tmp/original.jpg',
      'products',
      'products/u-1.jpg'
    );

    expect(result).toEqual({ success: false, error: 'compress failed' });
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
  });

  it('returns failure when uploadImage storage upload fails', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    jest.spyOn(imageOptimizationService, 'compressImage').mockResolvedValue({
      success: true,
      uri: 'file:///tmp/compressed.jpg',
      originalSize: 3,
      compressedSize: 1,
    });
    mockStorageUpload.mockResolvedValue({ data: null, error: new Error('upload denied') });

    const result = await imageOptimizationService.uploadImage(
      'file:///tmp/original.jpg',
      'products',
      'products/u-2.jpg'
    );

    expect(result).toEqual({ success: false, error: 'upload denied' });
  });

  it('returns partial success info for uploadMultipleImages', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    const uploadSpy = jest.spyOn(imageOptimizationService, 'uploadImage');
    uploadSpy
      .mockResolvedValueOnce({ success: true, url: 'https://cdn.test/a.jpg' })
      .mockResolvedValueOnce({ success: false, error: 'network error' })
      .mockResolvedValueOnce({ success: true, url: 'https://cdn.test/c.jpg' });

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const result = await imageOptimizationService.uploadMultipleImages(
      ['file:///1.jpg', 'file:///2.jpg', 'file:///3.jpg'],
      'products',
      'users/u-1'
    );

    expect(result.success).toBe(true);
    expect(result.failureCount).toBe(1);
    expect(result.urls).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/c.jpg']);
    expect(uploadSpy).toHaveBeenCalledTimes(3);

    nowSpy.mockRestore();
  });

  it('returns failure summary when all uploads fail', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    const uploadSpy = jest.spyOn(imageOptimizationService, 'uploadImage');
    uploadSpy
      .mockResolvedValueOnce({ success: false, error: 'network error' })
      .mockResolvedValueOnce({ success: false, error: 'timeout' });

    const result = await imageOptimizationService.uploadMultipleImages(
      ['file:///1.jpg', 'file:///2.jpg'],
      'products',
      'users/u-9'
    );

    expect(result.success).toBe(false);
    expect(result.urls).toEqual([]);
    expect(result.failureCount).toBe(2);
  });

  it('deletes image from storage', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    const result = await imageOptimizationService.deleteImage('products', 'users/u-1/pic.jpg');

    expect(mockStorageRemove).toHaveBeenCalledWith(['users/u-1/pic.jpg']);
    expect(result).toEqual({ success: true });
  });

  it('returns failure when deleteImage storage remove fails', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockStorageRemove.mockResolvedValue({ error: new Error('delete denied') });

    const result = await imageOptimizationService.deleteImage('products', 'users/u-1/pic.jpg');

    expect(result).toEqual({ success: false, error: 'delete denied' });
  });

  it('gets image metadata from file and dimensions', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockGetInfoAsync.mockResolvedValue({ size: 2048, exists: true });
    global.Image = {
      getSize: jest.fn((uri, onSuccess) => onSuccess(800, 400)),
    };

    const result = await imageOptimizationService.getImageMetadata('file:///tmp/pic.jpg');

    expect(result).toEqual({
      success: true,
      size: 2048,
      width: 800,
      height: 400,
      aspectRatio: 2,
    });
  });

  it('returns failure when getImageMetadata cannot resolve dimensions', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockGetInfoAsync.mockResolvedValue({ size: 2048, exists: true });
    global.Image = {
      getSize: jest.fn((_uri, _onSuccess, onError) => onError(new Error('invalid image'))),
    };

    const result = await imageOptimizationService.getImageMetadata('file:///tmp/bad.jpg');

    expect(result).toEqual({ success: false, error: 'invalid image' });
  });

  it('uses cached file when cache entry already exists', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024 });

    const result = await imageOptimizationService.cacheImage('file:///tmp/pic.jpg', 'user-avatar');

    expect(result).toEqual({
      success: true,
      uri: 'file:///cache/user-avatar.jpg',
      cached: true,
    });
    expect(mockCopyAsync).not.toHaveBeenCalled();
  });

  it('copies image to cache when entry does not exist', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockGetInfoAsync.mockResolvedValue({ exists: false });

    const result = await imageOptimizationService.cacheImage('file:///tmp/pic.jpg', 'proof-1');

    expect(mockCopyAsync).toHaveBeenCalledWith({
      from: 'file:///tmp/pic.jpg',
      to: 'file:///cache/proof-1.jpg',
    });
    expect(result).toEqual({
      success: true,
      uri: 'file:///cache/proof-1.jpg',
      cached: false,
    });
  });

  it('returns failure when cache copy throws', async () => {
    const { imageOptimizationService } = require('../../services/imageOptimizationService');

    mockGetInfoAsync.mockResolvedValue({ exists: false });
    mockCopyAsync.mockRejectedValue(new Error('disk full'));

    const result = await imageOptimizationService.cacheImage('file:///tmp/pic.jpg', 'proof-2');

    expect(result).toEqual({ success: false, error: 'disk full' });
  });
});
