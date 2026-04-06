const mockFetch = jest.fn();
const mockAddEventListener = jest.fn();
const mockProcessSyncQueue = jest.fn();
const mockGetSyncQueueHealth = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...args) => mockFetch(...args),
    addEventListener: (...args) => mockAddEventListener(...args),
  },
}));

jest.mock('../../services/offlineStorageService', () => ({
  offlineStorageService: {
    processSyncQueue: (...args) => mockProcessSyncQueue(...args),
    getSyncQueueHealth: (...args) => mockGetSyncQueueHealth(...args),
  },
}));

describe('networkStateService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('does not start monitoring twice', async () => {
    mockFetch.mockResolvedValue({ isConnected: true });
    mockGetSyncQueueHealth.mockResolvedValue({ success: true, isStuck: false, pendingCount: 0, oldestAgeMs: 0 });

    const unsubscribe = jest.fn();
    mockAddEventListener.mockReturnValue(unsubscribe);

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { networkStateService } = require('../../services/networkStateService');

    await networkStateService.startMonitoring();
    await networkStateService.startMonitoring();

    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('Network monitoring already started');

    networkStateService.stopMonitoring();
    warnSpy.mockRestore();
  });

  it('triggers sync when transitioning from offline to online', async () => {
    mockFetch.mockResolvedValue({ isConnected: false });
    mockProcessSyncQueue.mockResolvedValue({ success: true, processed: 1, pending: 0 });
    mockGetSyncQueueHealth.mockResolvedValue({ success: true, isStuck: false, pendingCount: 0, oldestAgeMs: 0 });

    let callback;
    const unsubscribe = jest.fn();
    mockAddEventListener.mockImplementation((cb) => {
      callback = cb;
      return unsubscribe;
    });

    const { networkStateService } = require('../../services/networkStateService');

    await networkStateService.startMonitoring();
    await callback({ isConnected: true });

    expect(mockProcessSyncQueue).toHaveBeenCalledTimes(1);
    networkStateService.stopMonitoring();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('returns current network status', async () => {
    mockFetch.mockResolvedValue({
      isConnected: true,
      type: 'wifi',
      details: { strength: 80 },
    });
    mockGetSyncQueueHealth.mockResolvedValue({ success: true, isStuck: false, pendingCount: 0, oldestAgeMs: 0 });

    const { networkStateService } = require('../../services/networkStateService');

    const status = await networkStateService.getStatus();

    expect(status).toEqual({
      isOnline: true,
      type: 'wifi',
      strength: 80,
    });
  });

  it('returns null strength when status details are missing', async () => {
    mockFetch.mockResolvedValue({
      isConnected: true,
      type: 'cellular',
      details: null,
    });

    const { networkStateService } = require('../../services/networkStateService');

    const status = await networkStateService.getStatus();

    expect(status).toEqual({
      isOnline: true,
      type: 'cellular',
      strength: null,
    });
  });

  it('returns error status when getStatus fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('netinfo unavailable'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { networkStateService } = require('../../services/networkStateService');

    const status = await networkStateService.getStatus();

    expect(status).toEqual({ isOnline: null, error: 'netinfo unavailable' });
    errorSpy.mockRestore();
  });

  it('dedupes overlapping sync queue runs', async () => {
    mockFetch.mockResolvedValue({ isConnected: true });
    mockGetSyncQueueHealth.mockResolvedValue({ success: true, isStuck: false, pendingCount: 0, oldestAgeMs: 0 });

    let resolveSync;
    const pendingSync = new Promise((resolve) => {
      resolveSync = resolve;
    });
    mockProcessSyncQueue.mockReturnValue(pendingSync);

    const { networkStateService } = require('../../services/networkStateService');

    const firstRun = networkStateService.processSyncQueue();
    const secondRun = await networkStateService.processSyncQueue();

    expect(secondRun).toEqual({
      success: true,
      skipped: true,
      reason: 'sync_already_in_progress',
    });

    resolveSync({ success: true, processed: 1, pending: 0 });
    await firstRun;

    expect(mockProcessSyncQueue).toHaveBeenCalledTimes(1);
  });

  it('returns failure when sync queue processing throws', async () => {
    mockProcessSyncQueue.mockRejectedValue(new Error('sync crashed'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { networkStateService } = require('../../services/networkStateService');

    const result = await networkStateService.processSyncQueue();

    expect(result).toEqual({ success: false, error: 'sync crashed' });
    errorSpy.mockRestore();
  });

  it('handles startMonitoring failures gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('startup failed'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { networkStateService } = require('../../services/networkStateService');

    await expect(networkStateService.startMonitoring()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('records offline transition and triggers sync only after reconnect', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    mockFetch.mockResolvedValue({ isConnected: true });
    mockProcessSyncQueue.mockResolvedValue({ success: true, processed: 2, pending: 0 });
    mockGetSyncQueueHealth.mockResolvedValue({ success: true, isStuck: false, pendingCount: 0, oldestAgeMs: 0 });

    let callback;
    const unsubscribe = jest.fn();
    mockAddEventListener.mockImplementation((cb) => {
      callback = cb;
      return unsubscribe;
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { networkStateService } = require('../../services/networkStateService');

    await networkStateService.startMonitoring();
    await callback({ isConnected: false });
    expect(mockProcessSyncQueue).not.toHaveBeenCalled();

    Date.now.mockReturnValue(4000);
    await callback({ isConnected: true });

    expect(mockProcessSyncQueue).toHaveBeenCalledTimes(1);

    networkStateService.stopMonitoring();
    expect(unsubscribe).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
    Date.now.mockRestore();
  });
});
