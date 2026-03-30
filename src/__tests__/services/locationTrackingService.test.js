const mockRequestForegroundPermissionsAsync = jest.fn();
const mockRequestBackgroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockWatchPositionAsync = jest.fn();

const mockFrom = jest.fn();
const mockChannel = jest.fn();

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args) => mockRequestForegroundPermissionsAsync(...args),
  requestBackgroundPermissionsAsync: (...args) => mockRequestBackgroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args) => mockGetCurrentPositionAsync(...args),
  watchPositionAsync: (...args) => mockWatchPositionAsync(...args),
  Accuracy: {
    High: 'high',
  },
}), { virtual: true });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannel(...args),
  },
}));

describe('locationTrackingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();

    mockChannel.mockReturnValue({
      on: jest.fn().mockReturnValue({
        subscribe: jest.fn().mockReturnValue({
          unsubscribe: jest.fn(),
        }),
      }),
    });
  });

  it('returns denied when foreground permission is not granted', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { locationTrackingService } = require('../../services/locationTrackingService');

    const result = await locationTrackingService.requestPermissions();

    expect(result).toEqual({ success: false, error: 'Location permission denied' });
    expect(mockRequestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns permission state when foreground is granted', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockRequestBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const { locationTrackingService } = require('../../services/locationTrackingService');

    const result = await locationTrackingService.requestPermissions();

    expect(result).toEqual({
      success: true,
      foregroundGranted: true,
      backgroundGranted: true,
    });
  });

  it('returns normalized current location shape', async () => {
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 9.75,
        longitude: 118.74,
        accuracy: 5,
        altitude: 10,
      },
      timestamp: 12345,
    });

    const { locationTrackingService } = require('../../services/locationTrackingService');

    const result = await locationTrackingService.getCurrentLocation();

    expect(result).toEqual({
      success: true,
      latitude: 9.75,
      longitude: 118.74,
      accuracy: 5,
      altitude: 10,
      timestamp: 12345,
    });
  });

  it('returns error when current location lookup fails', async () => {
    mockGetCurrentPositionAsync.mockRejectedValue(new Error('gps off'));

    const { locationTrackingService } = require('../../services/locationTrackingService');

    const result = await locationTrackingService.getCurrentLocation();

    expect(result).toEqual({ success: false, error: 'gps off' });
  });

  it('starts tracking after successful permission checks', async () => {
    const mockRemove = jest.fn();
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockRequestBackgroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockWatchPositionAsync.mockResolvedValue({ remove: mockRemove });

    const { locationTrackingService } = require('../../services/locationTrackingService');

    const result = await locationTrackingService.startTracking('r-1');

    expect(result).toEqual({ success: true, message: 'Location tracking started' });
    expect(mockWatchPositionAsync).toHaveBeenCalled();
    expect(locationTrackingService.locationSubscription).toEqual({ remove: mockRemove });
  });

  it('returns permission error when startTracking permissions fail', async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { locationTrackingService } = require('../../services/locationTrackingService');

    const result = await locationTrackingService.startTracking('r-1');

    expect(result).toEqual({ success: false, error: 'Location permission denied' });
    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
  });

  it('updates rider location and active delivery coordinates', async () => {
    const mockProfilesEq = jest.fn().mockResolvedValue({ error: null });
    const mockDeliveriesSingle = jest.fn().mockResolvedValue({ data: { id: 'd-1' }, error: null });
    const mockDeliveriesUpdateEq = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          update: jest.fn().mockReturnValue({
            eq: mockProfilesEq,
          }),
        };
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: mockDeliveriesSingle,
                }),
              }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: mockDeliveriesUpdateEq,
        }),
      };
    });

    const { locationTrackingService } = require('../../services/locationTrackingService');

    const result = await locationTrackingService.updateRiderLocation('r-1', {
      latitude: 9.71,
      longitude: 118.71,
    });

    expect(result).toEqual({ success: true });
    expect(mockProfilesEq).toHaveBeenCalledWith('id', 'r-1');
    expect(mockDeliveriesUpdateEq).toHaveBeenCalledWith('id', 'd-1');
  });

  it('stops tracking and marks rider offline', async () => {
    const mockRemove = jest.fn();
    const mockProfilesEq = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: mockProfilesEq,
      }),
    });

    const { locationTrackingService } = require('../../services/locationTrackingService');
    locationTrackingService.locationSubscription = { remove: mockRemove };

    const result = await locationTrackingService.stopTracking('r-1');

    expect(result).toEqual({ success: true, message: 'Location tracking stopped' });
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(locationTrackingService.locationSubscription).toBe(null);
    expect(mockProfilesEq).toHaveBeenCalledWith('id', 'r-1');
  });

  it('returns success for computed delivery route', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        routes: [
          {
            distance: 4500,
            duration: 900,
            geometry: { coordinates: [[118.7, 9.7], [118.8, 9.8]] },
          },
        ],
      }),
    });

    const { locationTrackingService } = require('../../services/locationTrackingService');

    const result = await locationTrackingService.getDeliveryRoute(
      { latitude: 9.7, longitude: 118.7 },
      { latitude: 9.8, longitude: 118.8 }
    );

    expect(result).toEqual({
      success: true,
      distance: 4.5,
      duration: 15,
      geometry: [[118.7, 9.7], [118.8, 9.8]],
    });
  });

  it('returns failure when route fetch fails', async () => {
    global.fetch.mockResolvedValue({ ok: false });

    const { locationTrackingService } = require('../../services/locationTrackingService');

    const result = await locationTrackingService.getDeliveryRoute(
      { latitude: 9.7, longitude: 118.7 },
      { latitude: 9.8, longitude: 118.8 }
    );

    expect(result).toEqual({ success: false, error: 'Route calculation failed' });
  });

  it('maps realtime rider location updates through subscription callback', () => {
    let capturedCallback;
    const unsubscribe = jest.fn();

    mockChannel.mockReturnValue({
      on: jest.fn().mockImplementation((_event, _filter, callback) => {
        capturedCallback = callback;
        return {
          subscribe: jest.fn().mockReturnValue({ unsubscribe }),
        };
      }),
    });

    const onLocationUpdate = jest.fn();
    const { locationTrackingService } = require('../../services/locationTrackingService');

    const cleanup = locationTrackingService.subscribeToRiderLocation('r-1', onLocationUpdate);

    capturedCallback({
      new: {
        address_lat: 9.701,
        address_lng: 118.701,
        is_online: true,
        last_seen: '2026-03-30T00:00:00Z',
      },
    });

    expect(onLocationUpdate).toHaveBeenCalledWith({
      latitude: 9.701,
      longitude: 118.701,
      isOnline: true,
      lastSeen: '2026-03-30T00:00:00Z',
    });

    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });
});