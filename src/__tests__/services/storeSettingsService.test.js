// src/__tests__/services/storeSettingsService.test.js

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args) => mockGetItem(...args),
  setItem: (...args) => mockSetItem(...args),
}));

const mockFrom = jest.fn();
const mockIn = jest.fn();
const mockSelect = jest.fn();
const mockChannel = jest.fn();
const mockChannelOn = jest.fn();
const mockChannelSubscribe = jest.fn();
const mockRemoveChannel = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}));

// Helper to build a settings row set
const buildRows = ({
  isPaused = 'false',
  mode = 'open',
  title = '',
  reason = '',
  reopenAt = '',
  allowPreorders = 'false',
  autoReopen = 'true',
} = {}) => [
  { key: 'store_is_paused', value: isPaused },
  { key: 'store_pause_mode', value: mode },
  { key: 'store_pause_title', value: title },
  { key: 'store_pause_reason', value: reason },
  { key: 'store_pause_reopen_at', value: reopenAt },
  { key: 'store_allow_preorders', value: allowPreorders },
  { key: 'store_auto_reopen', value: autoReopen },
];

describe('storeSettingsService.getStorePauseSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    mockSetItem.mockResolvedValue(undefined);
    mockGetItem.mockResolvedValue(null);

    mockIn.mockResolvedValue({ data: buildRows(), error: null });
    mockSelect.mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ select: mockSelect });
  });

  it('returns isPaused: false when store_is_paused is false', async () => {
    mockIn.mockResolvedValue({ data: buildRows({ isPaused: 'false' }), error: null });
    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings.isPaused).toBe(false);
  });

  it('returns isPaused: true when store_is_paused is true', async () => {
    mockIn.mockResolvedValue({ data: buildRows({ isPaused: 'true', mode: 'storm' }), error: null });
    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings.isPaused).toBe(true);
    expect(settings.mode).toBe('storm');
  });

  it('returns mode: open when isPaused is false even if DB has a mode value', async () => {
    mockIn.mockResolvedValue({ data: buildRows({ isPaused: 'false', mode: 'storm' }), error: null });
    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings.mode).toBe('open');
  });

  it('auto-reopens store when reopenAt has passed', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
    mockIn.mockResolvedValue({
      data: buildRows({ isPaused: 'true', reopenAt: pastTime, autoReopen: 'true' }),
      error: null,
    });
    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings.isPaused).toBe(false);
  });

  it('does NOT auto-reopen when reopenAt is in the future', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    mockIn.mockResolvedValue({
      data: buildRows({ isPaused: 'true', reopenAt: futureTime, autoReopen: 'true' }),
      error: null,
    });
    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings.isPaused).toBe(true);
  });

  it('does NOT auto-reopen when autoReopen is false', async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    mockIn.mockResolvedValue({
      data: buildRows({ isPaused: 'true', reopenAt: pastTime, autoReopen: 'false' }),
      error: null,
    });
    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings.isPaused).toBe(true);
  });

  it('persists settings to AsyncStorage after successful fetch', async () => {
    mockIn.mockResolvedValue({ data: buildRows(), error: null });
    const { storeSettingsService } = require('../../services/storeSettingsService');
    await storeSettingsService.getStorePauseSettings();
    expect(mockSetItem).toHaveBeenCalledWith('@petron_store_pause_settings', expect.any(String));
  });

  it('falls back to AsyncStorage cache when Supabase returns empty data', async () => {
    mockIn.mockResolvedValue({ data: [], error: null });
    const cached = JSON.stringify({ isPaused: true, mode: 'holiday' });
    mockGetItem.mockResolvedValue(cached);

    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings.isPaused).toBe(true);
    expect(settings.mode).toBe('holiday');
  });

  it('falls back to AsyncStorage cache when Supabase throws an error', async () => {
    mockIn.mockRejectedValue(new Error('network error'));
    const cached = JSON.stringify({ isPaused: false, mode: 'open' });
    mockGetItem.mockResolvedValue(cached);

    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings.isPaused).toBe(false);
  });

  it('returns safe default when Supabase and cache both fail', async () => {
    mockIn.mockRejectedValue(new Error('network error'));
    mockGetItem.mockRejectedValue(new Error('storage error'));

    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings).toEqual({
      isPaused: false,
      mode: 'open',
      title: '',
      reason: '',
      reopenAt: '',
      allowPreorders: false,
      autoReopen: true,
    });
  });

  it('returns allowPreorders: true when store_allow_preorders is true', async () => {
    mockIn.mockResolvedValue({ data: buildRows({ allowPreorders: 'true' }), error: null });
    const { storeSettingsService } = require('../../services/storeSettingsService');
    const settings = await storeSettingsService.getStorePauseSettings();
    expect(settings.allowPreorders).toBe(true);
  });
});

describe('storeSettingsService.subscribeToStorePauseChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    mockSetItem.mockResolvedValue(undefined);
    mockGetItem.mockResolvedValue(null);
    mockIn.mockResolvedValue({ data: buildRows(), error: null });
    mockSelect.mockReturnValue({ in: mockIn });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockChannelSubscribe.mockImplementation(() => {});
    mockChannelOn.mockReturnValue({ on: mockChannelOn, subscribe: mockChannelSubscribe });
    mockChannel.mockReturnValue({ on: mockChannelOn, subscribe: mockChannelSubscribe });
  });

  it('registers the callback as a subscriber', () => {
    const { storeSettingsService } = require('../../services/storeSettingsService');
    const cb = jest.fn();
    storeSettingsService.subscribeToStorePauseChanges(cb);
    // It should not throw and should return an unsubscribe function
    expect(typeof storeSettingsService.subscribeToStorePauseChanges(jest.fn())).toBe('function');
  });

  it('returns an unsubscribe function', () => {
    const { storeSettingsService } = require('../../services/storeSettingsService');
    const unsubscribe = storeSettingsService.subscribeToStorePauseChanges(jest.fn());
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
