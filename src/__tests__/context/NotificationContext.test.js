import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockFrom = jest.fn();
const mockChannel = jest.fn();

const authState = { user: { id: 'u-1' } };
let capturedRealtimeCallback;
let capturedAppStateHandler;

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannel(...args),
  },
}));

const ctxRef = { current: null };

const Probe = ({ useNotifications }) => {
  ctxRef.current = useNotifications();
  return null;
};

describe('NotificationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.user = { id: 'u-1' };
    capturedRealtimeCallback = undefined;
    capturedAppStateHandler = undefined;

    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
      capturedAppStateHandler = handler;
      return { remove: jest.fn() };
    });

    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { notifications_enabled: true },
                error: null,
              }),
            }),
          }),
        };
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [
                  { id: 'n-1', user_id: 'u-1', is_read: false },
                  { id: 'n-2', user_id: 'u-1', is_read: true },
                ],
                error: null,
              }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    mockChannel.mockReturnValue({
      on: jest.fn().mockImplementation((_event, _filter, callback) => {
        capturedRealtimeCallback = callback;
        return {
          subscribe: jest.fn().mockReturnValue({
            unsubscribe: jest.fn(),
          }),
        };
      }),
    });
  });

  afterEach(() => {
    AppState.addEventListener.mockRestore();
  });

  it('loads notifications and unread count', async () => {
    const { NotificationProvider, useNotifications } = require('../../context/NotificationContext');

    render(
      <NotificationProvider>
        <Probe useNotifications={useNotifications} />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(ctxRef.current.notifications).toHaveLength(2);
      expect(ctxRef.current.unreadCount).toBe(1);
      expect(typeof capturedRealtimeCallback).toBe('function');
    }, { timeout: 12000 });
  }, 15000);

  it('handles realtime insert and markAsRead', async () => {
    const { NotificationProvider, useNotifications } = require('../../context/NotificationContext');

    render(
      <NotificationProvider>
        <Probe useNotifications={useNotifications} />
      </NotificationProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    act(() => {
      capturedRealtimeCallback({
        new: { id: 'n-3', user_id: 'u-1', is_read: false },
      });
    });

    expect(ctxRef.current.notifications[0].id).toBe('n-3');
    expect(ctxRef.current.unreadCount).toBe(2);

    await act(async () => {
      await ctxRef.current.markAsRead('n-3');
    });

    expect(ctxRef.current.notifications.find((n) => n.id === 'n-3').is_read).toBe(true);
    expect(ctxRef.current.unreadCount).toBe(1);
  });

  it('refreshes on app foreground and clears on logout', async () => {
    const { NotificationProvider, useNotifications } = require('../../context/NotificationContext');

    const view = render(
      <NotificationProvider>
        <Probe useNotifications={useNotifications} />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(typeof capturedAppStateHandler).toBe('function');
    });

    await act(async () => {
      await capturedAppStateHandler('active');
    });

    expect(mockFrom).toHaveBeenCalledWith('notifications');

    authState.user = null;
    view.rerender(
      <NotificationProvider>
        <Probe useNotifications={useNotifications} />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.notifications).toEqual([]);
      expect(ctxRef.current.unreadCount).toBe(0);
    });
  });

  it('marks all notifications as read', async () => {
    const { NotificationProvider, useNotifications } = require('../../context/NotificationContext');

    render(
      <NotificationProvider>
        <Probe useNotifications={useNotifications} />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(ctxRef.current.unreadCount).toBe(1);
    });

    await act(async () => {
      await ctxRef.current.markAllAsRead();
    });

    expect(ctxRef.current.unreadCount).toBe(0);
    expect(ctxRef.current.notifications.every((n) => n.is_read)).toBe(true);
  });

  it('deletes an unread notification and updates count', async () => {
    const { NotificationProvider, useNotifications } = require('../../context/NotificationContext');

    render(
      <NotificationProvider>
        <Probe useNotifications={useNotifications} />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(ctxRef.current.notifications.some((n) => n.id === 'n-1')).toBe(true);
      expect(ctxRef.current.unreadCount).toBe(1);
    });

    await act(async () => {
      await ctxRef.current.deleteNotification('n-1');
    });

    expect(ctxRef.current.notifications.some((n) => n.id === 'n-1')).toBe(false);
    expect(ctxRef.current.unreadCount).toBe(0);
  });

  it('clears all notifications', async () => {
    const { NotificationProvider, useNotifications } = require('../../context/NotificationContext');

    render(
      <NotificationProvider>
        <Probe useNotifications={useNotifications} />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(ctxRef.current.notifications).toHaveLength(2);
    });

    await act(async () => {
      await ctxRef.current.clearAll();
    });

    expect(ctxRef.current.notifications).toEqual([]);
    expect(ctxRef.current.unreadCount).toBe(0);
  });

  it('does not append realtime notifications when notifications are disabled', async () => {
    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { notifications_enabled: false },
                error: null,
              }),
            }),
          }),
        };
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [{ id: 'n-1', user_id: 'u-1', is_read: false }],
                error: null,
              }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    const { NotificationProvider, useNotifications } = require('../../context/NotificationContext');

    render(
      <NotificationProvider>
        <Probe useNotifications={useNotifications} />
      </NotificationProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(ctxRef.current.notifications).toHaveLength(1);
      expect(ctxRef.current.notificationsEnabled).toBe(false);
      expect(ctxRef.current.unreadCount).toBe(1);
    });

    act(() => {
      capturedRealtimeCallback({
        new: { id: 'n-2', user_id: 'u-1', is_read: false },
      });
    });

    expect(ctxRef.current.notifications).toHaveLength(1);
    expect(ctxRef.current.unreadCount).toBe(1);
  });
});

describe('useNotifications', () => {
  it('throws when used outside NotificationProvider', () => {
    const { useNotifications } = require('../../context/NotificationContext');

    const BadProbe = () => {
      useNotifications();
      return null;
    };

    expect(() => render(<BadProbe />)).toThrow('useNotifications must be used within NotificationProvider');
  });
});