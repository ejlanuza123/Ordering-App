const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockFrom = jest.fn();

const mockNetInfoFetch = jest.fn();
const mockNetInfoAddEventListener = jest.fn();

const mockAppStateAddEventListener = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: (...args) => mockNetInfoFetch(...args),
    addEventListener: (...args) => mockNetInfoAddEventListener(...args),
  },
}));

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    AppState: {
      ...actual.AppState,
      addEventListener: (...args) => mockAppStateAddEventListener(...args),
    },
  };
});

describe('riderPresenceService', () => {
  let originalDateNow;
  let originalSetInterval;
  let originalClearInterval;
  let setIntervalCallbacks;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();

    originalDateNow = Date.now;
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    // Capture setInterval callbacks so we can drive the heartbeat manually
    setIntervalCallbacks = [];
    global.setInterval = jest.fn((cb, ms) => {
      setIntervalCallbacks.push({ cb, ms });
      return 123; // fake interval id
    });
    global.clearInterval = jest.fn();

    mockFrom.mockReturnValue({
      update: (...args) => {
        mockUpdate(...args);
        return { eq: mockEq };
      },
      select: mockSelect,
    });
    mockEq.mockReturnValue({});
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockSingle.mockResolvedValue({ data: { is_online: true }, error: null });

    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    mockNetInfoAddEventListener.mockReturnValue(jest.fn());

    mockAppStateAddEventListener.mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    Date.now = originalDateNow;
    jest.useRealTimers();
  });

  const loadService = () => {
    // Always re-require so the module-level singletons reset.
    return require('../../services/riderPresenceService').riderPresenceService;
  };

  it('skips initialization when no riderId is provided', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const service = loadService();

    await service.initialize(null);

    expect(warnSpy).toHaveBeenCalledWith(
      '[Presence] No riderId provided, skipping initialization'
    );
    expect(mockFrom).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('initializes: sets online, starts heartbeat, subscribes to AppState and NetInfo', async () => {
    mockFrom.mockReturnValue({
      update: (...args) => {
        mockUpdate(...args);
        return { eq: mockEq };
      },
    });
    mockEq.mockResolvedValue({ error: null });

    const service = loadService();
    await service.initialize('rider-1');

    // Heartbeat, AppState, NetInfo subscriptions started
    expect(global.setInterval).toHaveBeenCalledTimes(1);
    expect(mockAppStateAddEventListener).toHaveBeenCalledTimes(1);
    expect(mockNetInfoAddEventListener).toHaveBeenCalledTimes(1);

    // First setOnlineStatus(true) call hits profiles.update
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_online: true, last_seen: expect.any(String) })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'rider-1');
  });

  it('heartbeat only updates last_seen when the device is online', async () => {
    mockEq.mockResolvedValue({ error: null });

    const service = loadService();
    await service.initialize('rider-1');

    // initial setOnlineStatus call
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // Drive the heartbeat while online
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    await setIntervalCallbacks[0].cb();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenLastCalledWith({ last_seen: expect.any(String) });

    // Heartbeat skips when offline
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });
    await setIntervalCallbacks[0].cb();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('marks rider offline when app goes to background and online when it returns', async () => {
    mockEq.mockResolvedValue({ error: null });

    let appStateCallback;
    mockAppStateAddEventListener.mockImplementation((event, cb) => {
      appStateCallback = cb;
      return { remove: jest.fn() };
    });

    const service = loadService();
    await service.initialize('rider-1');

    // initial setOnlineStatus(true)
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // background -> should call setOnlineStatus(false)
    await appStateCallback('background');
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ is_online: false })
    );

    // return to active while online -> setOnlineStatus(true)
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    await appStateCallback('active');
    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ is_online: true })
    );
  });

  it('does not auto-set online on resume if rider was offline before background', async () => {
    mockEq.mockResolvedValue({ error: null });

    // Simulate rider who is already offline in DB
    mockSingle.mockResolvedValueOnce({ data: { is_online: false }, error: null });

    let appStateCallback;
    mockAppStateAddEventListener.mockImplementation((event, cb) => {
      appStateCallback = cb;
      return { remove: jest.fn() };
    });

    const service = loadService();
    await service.initialize('rider-1');

    // initial setOnlineStatus(true)
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // background
    await appStateCallback('background');
    // setOnlineStatus(false)
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    // resume -> should NOT set online because wasOnlineBeforeBackground is false
    mockNetInfoFetch.mockResolvedValue({ isConnected: true });
    await appStateCallback('active');
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('reacts to NetInfo state changes', async () => {
    mockEq.mockResolvedValue({ error: null });

    let netInfoCallback;
    mockNetInfoAddEventListener.mockImplementation((cb) => {
      netInfoCallback = cb;
      return jest.fn();
    });

    const service = loadService();
    await service.initialize('rider-1');
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // Disconnect -> offline
    await netInfoCallback({ isConnected: false });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ is_online: false })
    );

    // Reconnect -> online
    await netInfoCallback({ isConnected: true });
    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ is_online: true })
    );
  });

  it('cleanup stops the heartbeat, removes listeners, and marks the rider offline', async () => {
    mockEq.mockResolvedValue({ error: null });

    const appStateRemove = jest.fn();
    const netInfoUnsubscribe = jest.fn();
    mockAppStateAddEventListener.mockReturnValue({ remove: appStateRemove });
    mockNetInfoAddEventListener.mockReturnValue(netInfoUnsubscribe);

    const service = loadService();
    await service.initialize('rider-1');

    await service.cleanup('rider-1');

    expect(global.clearInterval).toHaveBeenCalledWith(123);
    expect(appStateRemove).toHaveBeenCalledTimes(1);
    expect(netInfoUnsubscribe).toHaveBeenCalledTimes(1);

    // cleanup also flips the rider offline
    const updateCalls = mockUpdate.mock.calls;
    const lastCall = updateCalls[updateCalls.length - 1][0];
    expect(lastCall).toEqual(
      expect.objectContaining({ is_online: false, last_seen: expect.any(String) })
    );
  });

  it('cleanup is safe to call when never initialized', async () => {
    const service = loadService();
    await expect(service.cleanup('unknown-rider')).resolves.toBeUndefined();
  });

  it('setOnlineStatus logs and swallows errors', async () => {
    mockEq.mockResolvedValue({ error: { message: 'rls blocked' } });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const service = loadService();
    await service.setOnlineStatus('rider-1', true);

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('checkIfOnline returns false when no data is returned', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const service = loadService();
    const result = await service.checkIfOnline('rider-1');

    expect(result).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('checkIfOnline returns the is_online value from the database', async () => {
    mockSingle.mockResolvedValueOnce({ data: { is_online: true }, error: null });

    const service = loadService();
    const result = await service.checkIfOnline('rider-1');

    expect(result).toBe(true);
  });

  it('checkIfOnline returns false on error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'db down' } });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const service = loadService();
    const result = await service.checkIfOnline('rider-1');

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
