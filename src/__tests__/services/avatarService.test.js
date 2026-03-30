const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockRequestCameraPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();
const mockLaunchCameraAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockDecode = jest.fn();

const mockStorageUpload = jest.fn();
const mockStorageGetPublicUrl = jest.fn();
const mockStorageRemove = jest.fn();
const mockStorageFrom = jest.fn();

const mockProfileEq = jest.fn();
const mockProfileUpdate = jest.fn();
const mockFrom = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args) => mockRequestMediaLibraryPermissionsAsync(...args),
  requestCameraPermissionsAsync: (...args) => mockRequestCameraPermissionsAsync(...args),
  launchImageLibraryAsync: (...args) => mockLaunchImageLibraryAsync(...args),
  launchCameraAsync: (...args) => mockLaunchCameraAsync(...args),
}), { virtual: true });

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args) => mockReadAsStringAsync(...args),
}), { virtual: true });

jest.mock('base64-arraybuffer', () => ({
  decode: (...args) => mockDecode(...args),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: (...args) => mockStorageFrom(...args),
    },
    from: (...args) => mockFrom(...args),
  },
}));

describe('avatarService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockStorageUpload.mockResolvedValue({ data: { path: 'public/u-1/1.png' }, error: null });
    mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/avatars/public/u-1/1.png' } });
    mockStorageRemove.mockResolvedValue({ error: null });

    mockStorageFrom.mockReturnValue({
      upload: mockStorageUpload,
      getPublicUrl: mockStorageGetPublicUrl,
      remove: mockStorageRemove,
    });

    mockProfileEq.mockResolvedValue({ error: null });
    mockProfileUpdate.mockReturnValue({ eq: mockProfileEq });
    mockFrom.mockReturnValue({ update: mockProfileUpdate });

    mockReadAsStringAsync.mockResolvedValue('BASE64DATA');
    mockDecode.mockReturnValue('DECODED_BUFFER');

    mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
  });

  it('returns true when both permissions are granted', async () => {
    const { avatarService } = require('../../services/avatarService');

    const result = await avatarService.requestPermissions();

    expect(result).toBe(true);
  });

  it('returns first asset from pickImage', async () => {
    const { avatarService } = require('../../services/avatarService');

    const asset = { uri: 'file:///tmp/image.jpg', width: 100, height: 100 };
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset] });

    const result = await avatarService.pickImage();

    expect(result).toEqual(asset);
  });

  it('returns null from takePhoto when camera permission is denied', async () => {
    const { avatarService } = require('../../services/avatarService');

    mockRequestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await avatarService.takePhoto();

    expect(result).toBeNull();
    expect(mockLaunchCameraAsync).not.toHaveBeenCalled();
  });

  it('uploads avatar and updates profile with public url', async () => {
    const { avatarService } = require('../../services/avatarService');
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const result = await avatarService.uploadAvatar('u-1', 'file:///tmp/avatar.png');

    expect(mockReadAsStringAsync).toHaveBeenCalledWith('file:///tmp/avatar.png', { encoding: 'base64' });
    expect(mockDecode).toHaveBeenCalledWith('BASE64DATA');
    expect(mockStorageUpload).toHaveBeenCalledWith(
      'public/u-1/1700000000000.png',
      'DECODED_BUFFER',
      {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true,
      }
    );
    expect(mockStorageGetPublicUrl).toHaveBeenCalledWith('public/u-1/1700000000000.png');
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar_url: 'https://cdn.test/avatars/public/u-1/1.png',
        avatar_updated_at: expect.any(String),
      })
    );
    expect(mockProfileEq).toHaveBeenCalledWith('id', 'u-1');
    expect(result).toBe('https://cdn.test/avatars/public/u-1/1.png');

    nowSpy.mockRestore();
  });

  it('throws when uploadAvatar storage upload fails', async () => {
    const { avatarService } = require('../../services/avatarService');

    mockStorageUpload.mockResolvedValue({ data: null, error: { message: 'upload failed' } });

    await expect(
      avatarService.uploadAvatar('u-1', 'file:///tmp/avatar.jpg')
    ).rejects.toThrow('Upload failed: upload failed');
  });

  it('deletes avatar from storage and clears profile metadata', async () => {
    const { avatarService } = require('../../services/avatarService');

    await avatarService.deleteAvatar('u-1', 'https://cdn.test/storage/v1/object/public/avatars/public/u-1/old.png');

    expect(mockStorageRemove).toHaveBeenCalledWith(['public/u-1/old.png']);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar_url: null,
        avatar_updated_at: expect.any(String),
      })
    );
    expect(mockProfileEq).toHaveBeenCalledWith('id', 'u-1');
  });

  it('throws when deleteAvatar cannot extract file path', async () => {
    const { avatarService } = require('../../services/avatarService');

    await expect(
      avatarService.deleteAvatar('u-1', 'https://cdn.test/no-avatar-here')
    ).rejects.toThrow('Could not extract file path from avatar URL');
  });
});
