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
});
