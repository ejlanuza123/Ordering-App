const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockFrom = jest.fn();
const mockChannelSubscribe = jest.fn();
const mockChannelOn = jest.fn();
const mockChannelUnsubscribe = jest.fn();
const mockChannel = jest.fn();

const mockSetNotificationHandler = jest.fn();
const mockScheduleNotificationAsync = jest.fn();

jest.mock('expo-device', () => ({
  isDevice: true,
}), { virtual: true });

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
  easConfig: { projectId: 'test-project-id' },
}), { virtual: true });

jest.mock('expo-notifications', () => ({
  setNotificationHandler: (...args) => mockSetNotificationHandler(...args),
  scheduleNotificationAsync: (...args) => mockScheduleNotificationAsync(...args),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}), { virtual: true });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannel(...args),
  },
}));

describe('mobileNotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockEq.mockResolvedValue({ error: null, data: [] });
    mockUpdate.mockReturnValue({ eq: mockEq });

    mockLimit.mockResolvedValue({ error: null, data: [] });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockEq.mockReturnValue({ order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq });

    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') {
        return { update: mockUpdate };
      }

      return { select: mockSelect };
    });

    mockChannelOn.mockReturnValue({ subscribe: mockChannelSubscribe });
    mockChannelSubscribe.mockReturnValue({ unsubscribe: mockChannelUnsubscribe });
    mockChannel.mockReturnValue({ on: mockChannelOn });
  });

  it('returns failure when savePushToken has missing userId', async () => {
    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const result = await mobileNotificationService.savePushToken('', 'token-value');

    expect(result).toEqual({ success: false, error: 'Missing userId' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns failure when savePushToken token is invalid', async () => {
    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const result = await mobileNotificationService.savePushToken('user-1', '   ');

    expect(result).toEqual({ success: false, error: 'Invalid push token' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('trims token and writes to profile', async () => {
    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const result = await mobileNotificationService.savePushToken('user-1', '  abc123  ');

    expect(result).toEqual({ success: true });
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith({ fcm_token: 'abc123' });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('returns failure when getNotifications is called without userId', async () => {
    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const result = await mobileNotificationService.getNotifications(null, 25);

    expect(result).toEqual({ success: false, error: 'Missing userId' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('clamps getNotifications limit to max of 100', async () => {
    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    await mobileNotificationService.getNotifications('user-1', 999);

    expect(mockFrom).toHaveBeenCalledWith('notifications');
    expect(mockLimit).toHaveBeenCalledWith(100);
  });

  it('uses default limit for invalid values', async () => {
    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    await mobileNotificationService.getNotifications('user-1', 'abc');

    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('returns noop unsubscribe when subscribeToNotifications missing userId', () => {
    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const cleanup = mobileNotificationService.subscribeToNotifications('', jest.fn());

    expect(typeof cleanup).toBe('function');
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('returns push token when permission is granted', async () => {
    const Notifications = require('expo-notifications');
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'expo-token-1' });

    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const token = await mobileNotificationService.getDevicePushToken();

    expect(token).toBe('expo-token-1');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null when notification permission is denied', async () => {
    const Notifications = require('expo-notifications');
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const token = await mobileNotificationService.getDevicePushToken();

    expect(token).toBeNull();
  });

  it('sets up foreground/response listeners and cleans them up', () => {
    const Notifications = require('expo-notifications');
    const onReceived = jest.fn();
    let foregroundCallback;
    let responseCallback;

    const removeForeground = jest.fn();
    const removeResponse = jest.fn();

    Notifications.addNotificationReceivedListener.mockImplementation((cb) => {
      foregroundCallback = cb;
      return { remove: removeForeground };
    });

    Notifications.addNotificationResponseReceivedListener.mockImplementation((cb) => {
      responseCallback = cb;
      return { remove: removeResponse };
    });

    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const cleanup = mobileNotificationService.setupNotificationListeners(onReceived);

    foregroundCallback({ request: { identifier: 'n1' } });
    responseCallback({ notification: { request: { identifier: 'n2' } } });

    expect(onReceived).toHaveBeenNthCalledWith(1, { request: { identifier: 'n1' } });
    expect(onReceived).toHaveBeenNthCalledWith(2, { request: { identifier: 'n2' } }, 'tapped');

    cleanup();
    expect(removeForeground).toHaveBeenCalled();
    expect(removeResponse).toHaveBeenCalled();
  });

  it('schedules local notification payload', async () => {
    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    mockScheduleNotificationAsync.mockResolvedValue('sched-1');
    const result = await mobileNotificationService.sendLocalNotification('Title', 'Body', { id: 'x1' });

    expect(result).toEqual({ success: true });
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Title',
        body: 'Body',
        data: { id: 'x1' },
        sound: true,
        badge: 1,
      },
      trigger: { seconds: 1 },
    });
  });

  it('subscribes to realtime notifications, forwards events, and unsubscribes', async () => {
    const onNewNotification = jest.fn();
    let realtimeCallback;

    mockChannelOn.mockImplementation((_event, _filter, callback) => {
      realtimeCallback = callback;
      return { subscribe: mockChannelSubscribe };
    });

    mockChannelSubscribe.mockImplementation((statusCallback) => {
      statusCallback('SUBSCRIBED');
      return { unsubscribe: mockChannelUnsubscribe };
    });

    mockScheduleNotificationAsync.mockResolvedValue('sched-2');

    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const cleanup = mobileNotificationService.subscribeToNotifications('user-1', onNewNotification);

    const notification = {
      id: 'n-1',
      title: 'Order Update',
      message: 'Your order is on the way',
      data: { orderId: 'o-1' },
    };

    realtimeCallback({ new: notification });
    await Promise.resolve();

    expect(onNewNotification).toHaveBeenCalledWith(notification);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Order Update',
        body: 'Your order is on the way',
        data: { notificationId: 'n-1', orderId: 'o-1' },
        sound: true,
        badge: 1,
      },
      trigger: { seconds: 1 },
    });

    cleanup();
    expect(mockChannelUnsubscribe).toHaveBeenCalled();
  });

  it('marks notification as read', async () => {
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockImplementation((table) => {
      if (table === 'notifications') {
        return { update };
      }
      return { select: mockSelect };
    });

    const { mobileNotificationService } = require('../../services/mobileNotificationService');

    const result = await mobileNotificationService.markAsRead('n-1');

    expect(result).toEqual({ success: true });
    expect(update).toHaveBeenCalledWith({ is_read: true });
  });

  it('returns null for push token when running on simulator', async () => {
    const Device = require('expo-device');
    const original = Device.isDevice;
    Device.isDevice = false;

    const { mobileNotificationService } = require('../../services/mobileNotificationService');
    const token = await mobileNotificationService.getDevicePushToken();

    expect(token).toBeNull();
    Device.isDevice = original;
  });

  it('returns null when project id is missing', async () => {
    const Notifications = require('expo-notifications');
    const Constants = require('expo-constants');

    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    const originalExpo = Constants.expoConfig;
    const originalEas = Constants.easConfig;
    Constants.expoConfig = {};
    Constants.easConfig = {};

    const { mobileNotificationService } = require('../../services/mobileNotificationService');
    const token = await mobileNotificationService.getDevicePushToken();

    expect(token).toBeNull();
    Constants.expoConfig = originalExpo;
    Constants.easConfig = originalEas;
  });

  it('returns failure when savePushToken update throws error', async () => {
    const eq = jest.fn().mockResolvedValue({ error: new Error('update failed') });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') return { update };
      return { select: mockSelect };
    });

    const { mobileNotificationService } = require('../../services/mobileNotificationService');
    const result = await mobileNotificationService.savePushToken('user-1', 'abc');

    expect(result).toEqual({ success: false, error: 'update failed' });
  });

  it('returns failure when sending local notification fails', async () => {
    mockScheduleNotificationAsync.mockRejectedValue(new Error('schedule failed'));

    const { mobileNotificationService } = require('../../services/mobileNotificationService');
    const result = await mobileNotificationService.sendLocalNotification('Title', 'Body');

    expect(result).toEqual({ success: false, error: 'schedule failed' });
  });

  it('returns failure when markAsRead query fails', async () => {
    const update = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: new Error('mark failed') }),
    });

    mockFrom.mockImplementation((table) => {
      if (table === 'notifications') return { update };
      return { select: mockSelect };
    });

    const { mobileNotificationService } = require('../../services/mobileNotificationService');
    const result = await mobileNotificationService.markAsRead('n-1');

    expect(result).toEqual({ success: false, error: 'mark failed' });
  });

  it('returns failure when getNotifications query fails', async () => {
    const limit = jest.fn().mockResolvedValue({ error: new Error('fetch failed'), data: null });
    const order = jest.fn().mockReturnValue({ limit });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });

    mockFrom.mockImplementation((table) => {
      if (table === 'notifications') return { select };
      return { update: mockUpdate };
    });

    const { mobileNotificationService } = require('../../services/mobileNotificationService');
    const result = await mobileNotificationService.getNotifications('user-1', 10);

    expect(result).toEqual({ success: false, error: 'fetch failed' });
  });

  it('still forwards realtime notification when local schedule fails', async () => {
    const onNewNotification = jest.fn();
    let realtimeCallback;

    mockChannelOn.mockImplementation((_event, _filter, callback) => {
      realtimeCallback = callback;
      return { subscribe: mockChannelSubscribe };
    });
    mockChannelSubscribe.mockReturnValue({ unsubscribe: mockChannelUnsubscribe });
    mockScheduleNotificationAsync.mockRejectedValue(new Error('local schedule failed'));

    const { mobileNotificationService } = require('../../services/mobileNotificationService');
    mobileNotificationService.subscribeToNotifications('user-1', onNewNotification);

    const notification = {
      id: 'n-99',
      title: 'Alert',
      message: 'Message',
      data: { id: 'payload' },
    };

    realtimeCallback({ new: notification });
    await Promise.resolve();

    expect(onNewNotification).toHaveBeenCalledWith(notification);
  });
});