import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import NotificationsScreen from '../../screens/customer/NotificationsScreen';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

const mockMarkAsRead = jest.fn().mockResolvedValue(true);
const mockMarkAllAsRead = jest.fn().mockResolvedValue(true);
const mockDeleteNotification = jest.fn().mockResolvedValue(true);
const mockClearAll = jest.fn().mockResolvedValue(true);
const mockLoadNotifications = jest.fn().mockResolvedValue(true);

const mockNotifications = [
  {
    id: 1,
    type: 'broadcast',
    title: '🌧️ Heavy Rain Advisory',
    message: 'Deliveries in San Pedro may be delayed by 10–15 mins for rider safety.',
    is_read: false,
    created_at: '2026-09-11T08:00:00.000Z',
    data: {
      category: 'weather_advisory',
      target_audience: 'all',
      broadcast_id: 101,
    },
  },
  {
    id: 2,
    type: 'order_status',
    title: 'Order Status Update',
    message: 'Your order #123 is now being prepared.',
    is_read: true,
    created_at: '2026-09-11T07:30:00.000Z',
    data: {
      order_id: 123,
    },
  },
];

let mockRole = 'customer';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    role: mockRole,
    user: { id: 'test-user-1' },
  }),
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#0033A0',
      background: '#FFFFFF',
      surface: '#FFFFFF',
      surfaceElevated: '#F8FAFC',
      border: '#E2E8F0',
      textPrimary: '#1E293B',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
    },
    isDarkMode: false,
  }),
}));

jest.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: mockNotifications,
    unreadCount: 1,
    loading: false,
    markAsRead: mockMarkAsRead,
    markAllAsRead: mockMarkAllAsRead,
    deleteNotification: mockDeleteNotification,
    clearAll: mockClearAll,
    loadNotifications: mockLoadNotifications,
  }),
}));

describe('NotificationsScreen with Broadcast Detail Modal', () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'customer';
    jest.spyOn(Share, 'share').mockImplementation(jest.fn().mockResolvedValue({ action: 'sharedAction' }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders notifications list correctly', () => {
    const { getByText } = render(
      <NotificationsScreen navigation={mockNavigation} route={{ params: {} }} />
    );

    expect(getByText('Notifications')).toBeTruthy();
    expect(getByText('🌧️ Heavy Rain Advisory')).toBeTruthy();
    expect(getByText('Order Status Update')).toBeTruthy();
  });

  it('navigates to OrderHistory when tapping a regular order notification', () => {
    const { getByText } = render(
      <NotificationsScreen navigation={mockNavigation} route={{ params: {} }} />
    );

    fireEvent.press(getByText('Order Status Update'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('OrderHistory');
  });

  it('opens BroadcastDetailModal when tapping a broadcast notification', async () => {
    const { getByText, queryByText } = render(
      <NotificationsScreen navigation={mockNavigation} route={{ params: {} }} />
    );

    fireEvent.press(getByText('🌧️ Heavy Rain Advisory'));

    // Should NOT navigate to OrderHistory or Home
    expect(mockNavigation.navigate).not.toHaveBeenCalled();

    // Should mark notification as read
    expect(mockMarkAsRead).toHaveBeenCalledWith(1);

    // Modal elements should be visible
    await waitFor(() => {
      expect(getByText('Weather & Operations')).toBeTruthy();
      expect(getByText('Everyone')).toBeTruthy();
      expect(getByText('Official Broadcast')).toBeTruthy();
      expect(getByText('Browse Products')).toBeTruthy();
      expect(getByText('Share')).toBeTruthy();
      expect(getByText('Close')).toBeTruthy();
    });
  });

  it('calls Share.share when tapping the Share button inside broadcast modal', async () => {
    const { getByText } = render(
      <NotificationsScreen navigation={mockNavigation} route={{ params: {} }} />
    );

    fireEvent.press(getByText('🌧️ Heavy Rain Advisory'));

    await waitFor(() => {
      expect(getByText('Share')).toBeTruthy();
    });

    fireEvent.press(getByText('Share'));

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '🌧️ Heavy Rain Advisory',
        message: expect.stringContaining('Deliveries in San Pedro may be delayed'),
      })
    );
  });

  it('closes the modal when Close button is pressed', async () => {
    const { getByText, queryByText } = render(
      <NotificationsScreen navigation={mockNavigation} route={{ params: {} }} />
    );

    fireEvent.press(getByText('🌧️ Heavy Rain Advisory'));

    await waitFor(() => {
      expect(getByText('Official Broadcast')).toBeTruthy();
    });

    fireEvent.press(getByText('Close'));

    await waitFor(() => {
      expect(queryByText('Official Broadcast')).toBeNull();
    });
  });

  it('auto-opens modal and marks as read when route.params.selectedBroadcast is provided', async () => {
    const broadcastParam = {
      id: 99,
      type: 'promo',
      title: '🍗 Friday Promo Special',
      message: '15% discount for all Platters!',
      is_read: false,
      created_at: '2026-09-11T12:00:00.000Z',
      data: {
        category: 'promo',
        target_audience: 'customers',
      },
    };

    const { getByText } = render(
      <NotificationsScreen
        navigation={mockNavigation}
        route={{ params: { selectedBroadcast: broadcastParam } }}
      />
    );

    await waitFor(() => {
      expect(getByText('🍗 Friday Promo Special')).toBeTruthy();
      expect(getByText('15% discount for all Platters!')).toBeTruthy();
      expect(getByText('Special Promotion')).toBeTruthy();
      expect(getByText('Customers Only')).toBeTruthy();
      expect(mockMarkAsRead).toHaveBeenCalledWith(99);
    });
  });

  it('auto-opens modal when nested route.params.params.selectedBroadcast is provided', async () => {
    const nestedBroadcastParam = {
      id: 100,
      type: 'emergency',
      title: '⚠️ Urgent Typhoon Advisory',
      message: 'Severe weather alert in San Pedro area.',
      is_read: false,
      created_at: '2026-09-14T08:00:00.000Z',
      data: {
        category: 'emergency',
        target_audience: 'all',
      },
    };

    const { getByText } = render(
      <NotificationsScreen
        navigation={mockNavigation}
        route={{ params: { params: { selectedBroadcast: nestedBroadcastParam } } }}
      />
    );

    await waitFor(() => {
      expect(getByText('⚠️ Urgent Typhoon Advisory')).toBeTruthy();
      expect(getByText('Severe weather alert in San Pedro area.')).toBeTruthy();
      expect(getByText('Urgent Advisory')).toBeTruthy();
      expect(mockMarkAsRead).toHaveBeenCalledWith(100);
    });
  });
});
