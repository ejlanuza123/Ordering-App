// src/__tests__/services/navigationService.test.js

const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();

jest.mock('react-native', () => ({
  Linking: {
    canOpenURL: (...args) => mockCanOpenURL(...args),
    openURL: (...args) => mockOpenURL(...args),
  },
  Platform: {
    select: (obj) => obj.android, // default to android in tests
  },
  Alert: {
    alert: jest.fn(),
  },
}));

import { navigationService } from '../../services/navigationService';

const COORDS = { lat: 14.35, lng: 121.03 };
const ADDRESS = { address: '123 Main St, San Pedro, Laguna' };
const ZERO_COORDS = { lat: 0, lng: 0 };
const NULL_COORDS = { lat: null, lng: null };

describe('navigationService.openGoogleMaps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenURL.mockResolvedValue(undefined);
  });

  it('opens Google Maps app URL when coordinates are provided and app is supported', async () => {
    mockCanOpenURL.mockResolvedValue(true);
    navigationService.openGoogleMaps(COORDS);
    await Promise.resolve(); // flush promise
    expect(mockCanOpenURL).toHaveBeenCalledWith(expect.stringContaining('14.35'));
    expect(mockOpenURL).toHaveBeenCalledWith(expect.stringContaining('14.35'));
  });

  it('falls back to https URL when app is not supported', async () => {
    mockCanOpenURL.mockResolvedValue(false);
    navigationService.openGoogleMaps(COORDS);
    await Promise.resolve();
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('https://www.google.com/maps')
    );
  });

  it('uses address-based URL when no valid coordinates given', async () => {
    mockCanOpenURL.mockResolvedValue(true);
    navigationService.openGoogleMaps(ADDRESS);
    await Promise.resolve();
    expect(mockCanOpenURL).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('123 Main St'))
    );
  });

  it('opens fallback URL when canOpenURL throws', async () => {
    mockCanOpenURL.mockRejectedValue(new Error('scheme blocked'));
    navigationService.openGoogleMaps(COORDS);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('https://www.google.com/maps')
    );
  });

  it('opens fallback URL directly when lat=0 and no address', () => {
    navigationService.openGoogleMaps(ZERO_COORDS);
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('https://www.google.com/maps')
    );
  });

  it('opens fallback URL directly when both lat and lng are null', () => {
    navigationService.openGoogleMaps(NULL_COORDS);
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('https://www.google.com/maps')
    );
  });
});

describe('navigationService.openWaze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenURL.mockResolvedValue(undefined);
  });

  it('opens Waze app URL when coordinates are provided and Waze is installed', async () => {
    mockCanOpenURL.mockResolvedValue(true);
    navigationService.openWaze(COORDS);
    await Promise.resolve();
    expect(mockCanOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('waze://')
    );
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('waze://')
    );
  });

  it('falls back to waze.com URL when Waze is not installed', async () => {
    mockCanOpenURL.mockResolvedValue(false);
    navigationService.openWaze(COORDS);
    await Promise.resolve();
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('https://waze.com')
    );
  });

  it('uses address-based Waze URL when no valid coordinates', async () => {
    mockCanOpenURL.mockResolvedValue(true);
    navigationService.openWaze(ADDRESS);
    await Promise.resolve();
    expect(mockCanOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('waze://?q=')
    );
  });

  it('opens waze.com fallback when canOpenURL throws', async () => {
    mockCanOpenURL.mockRejectedValue(new Error('blocked'));
    navigationService.openWaze(COORDS);
    await new Promise((r) => setTimeout(r, 10));
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('https://waze.com')
    );
  });

  it('opens fallback URL directly when lat=0', () => {
    navigationService.openWaze(ZERO_COORDS);
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('https://waze.com')
    );
  });
});

describe('navigationService.openAppleMaps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenURL.mockResolvedValue(undefined);
  });

  it('opens maps: URL with coordinates when coords are valid', () => {
    navigationService.openAppleMaps(COORDS);
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('maps:?daddr=14.35,121.03')
    );
  });

  it('opens maps: URL with encoded address when no coords', () => {
    navigationService.openAppleMaps(ADDRESS);
    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('maps:?daddr=')
    );
  });

  it('shows Alert when openURL fails', async () => {
    const { Alert } = require('react-native');
    mockOpenURL.mockRejectedValue(new Error('no maps app'));
    navigationService.openAppleMaps(COORDS);
    await new Promise((r) => setTimeout(r, 10));
    expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String));
  });
});
