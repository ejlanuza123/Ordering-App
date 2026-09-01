const mockFetch = jest.fn();
const mockNetInfoAddEventListener = jest.fn();
const mockAppStateAddEventListener = jest.fn();
const mockFrom = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...args) => mockFetch(...args),
    addEventListener: (...args) => mockNetInfoAddEventListener(...args),
  },
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (...args) => mockAppStateAddEventListener(...args),
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

describe('riderPresenceService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks rider offline when AppState becomes background', async () => {
    let appStateCallback;
    mockAppStateAddEventListener.mockImplementation((_event, cb) => {
      appStateCallback = cb;
      return { remove: jest.fn() };
    });

    mockFetch.mockResolvedValue({ isConnected: true });

    const { riderPresenceService } = require('../../services/riderPresenceService');
    // Set intended online to true so it triggers the logic
    riderPresenceService.setIntendedOnline(true);

    const setOnlineSpy = jest.spyOn(riderPresenceService, 'setOnlineStatus').mockResolvedValue(undefined);

    riderPresenceService.subscribeToAppState('r-1');

    // inactive should be ignored
    await appStateCallback('inactive');
    expect(setOnlineSpy).not.toHaveBeenCalled();

    // background should trigger a timer
    await appStateCallback('background');
    expect(setOnlineSpy).not.toHaveBeenCalled();
    
    // Fast-forward past BACKGROUND_DEBOUNCE_MS (e.g. 5000)
    jest.advanceTimersByTime(6000);
    expect(setOnlineSpy).toHaveBeenCalledWith('r-1', false);

    // active should immediately set online
    await appStateCallback('active');
    // It calls NetInfo.fetch() in active state which is a promise, so we must await next tick
    await Promise.resolve();
    expect(setOnlineSpy).toHaveBeenCalledWith('r-1', true);
  });

  it('marks rider offline when network is disconnected', async () => {
    let netInfoCallback;
    const unsubscribe = jest.fn();
    mockNetInfoAddEventListener.mockImplementation((cb) => {
      netInfoCallback = cb;
      return unsubscribe;
    });

    const { riderPresenceService } = require('../../services/riderPresenceService');
    riderPresenceService.setIntendedOnline(true);
    
    const setOnlineSpy = jest.spyOn(riderPresenceService, 'setOnlineStatus').mockResolvedValue(undefined);

    riderPresenceService.subscribeToNetworkState('r-2');

    // Network drops - triggers timer
    await netInfoCallback({ isConnected: null });
    expect(setOnlineSpy).not.toHaveBeenCalled();
    
    // Need mockFetch to return down state for the verify check
    mockFetch.mockResolvedValue({ isConnected: false });
    
    // Fast-forward past DISCONNECT_DEBOUNCE_MS
    jest.advanceTimersByTime(10000);
    await Promise.resolve(); // flush promises
    expect(setOnlineSpy).toHaveBeenCalledWith('r-2', false);

    // Network back - immediate
    await netInfoCallback({ isConnected: true, isInternetReachable: true });
    expect(setOnlineSpy).toHaveBeenCalledWith('r-2', true);
  });
});