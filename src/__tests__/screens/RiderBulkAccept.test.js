import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.setTimeout(30000);

const mockDeliveriesData = [
  {
    id: 101,
    order_id: 201,
    rider_id: 'rider-123',
    status: 'assigned',
    assigned_at: new Date().toISOString(),
    orders: {
      id: 201,
      order_number: 'ORD-001',
      total_amount: 550,
      delivery_address: '123 San Pedro Laguna',
      profiles: { full_name: 'Juan Dela Cruz' },
      customer_name: { full_name: 'Juan Dela Cruz', phone_number: '09123456789' },
    },
  },
  {
    id: 102,
    order_id: 202,
    rider_id: 'rider-123',
    status: 'assigned',
    assigned_at: new Date().toISOString(),
    orders: {
      id: 202,
      order_number: 'ORD-002',
      total_amount: 720,
      delivery_address: '456 San Pedro Laguna',
      profiles: { full_name: 'Maria Santos' },
      customer_name: { full_name: 'Maria Santos', phone_number: '09987654321' },
    },
  },
];

const mockUpdateIn = jest.fn().mockResolvedValue({ error: null });
const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { avatar_url: null, is_online: true },
            error: null,
          }),
        };
      }
      if (table === 'app_settings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { value: '50' },
            error: null,
          }),
        };
      }
      if (table === 'deliveries') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockDeliveriesData,
            error: null,
          }),
          update: jest.fn().mockReturnValue({
            in: mockUpdateIn,
            eq: mockUpdateEq,
          }),
        };
      }
      if (table === 'orders') {
        return {
          update: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ error: null }),
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    })),
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, []);
  },
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
}));

const mockProfile = {
  id: 'rider-123',
  full_name: 'Test Rider Petron',
  role: 'rider',
};

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: mockProfile,
    user: { id: 'rider-123' },
  }),
}));

jest.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    unreadCount: 0,
  }),
}));

jest.mock('../../context/RiderRatingContext', () => ({
  useRiderRatings: () => ({
    getRiderStats: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colors: {
      primary: '#0033A0',
      surface: '#ffffff',
      surfaceElevated: '#f8f9fa',
      background: '#f8f9fa',
      textPrimary: '#1e293b',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      shadow: '#000000',
    },
  }),
}));

jest.mock('../../services/riderPresenceService', () => ({
  riderPresenceService: {
    checkIfOnline: jest.fn().mockResolvedValue(true),
    isIntendedOnline: jest.fn().mockReturnValue(true),
    setOnlineStatus: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../../services/offlineStorageService', () => ({
  offlineStorageService: {
    queueOperation: jest.fn().mockResolvedValue({ success: true }),
  },
}));

import RiderDashboardScreen from '../../screens/rider/RiderDashboardScreen';
import RiderDeliveriesScreen from '../../screens/rider/RiderDeliveriesScreen';
import { supabase } from '../../lib/supabase';

describe('Rider Bulk Accept Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RiderDashboardScreen Bulk Accept', () => {
    it('displays Accept All button when multiple assigned deliveries exist and handles batch accept', async () => {
      const { getByTestId, getByText } = render(
        <RiderDashboardScreen navigation={{ navigate: mockNavigate }} />
      );

      // Should display bulk accept banner button
      const acceptAllButton = await waitFor(
        () => getByTestId('bulk-accept-banner-button'),
        { timeout: 15000 }
      );
      expect(acceptAllButton).toBeTruthy();

      // Press the Accept All button to open modal
      fireEvent.press(acceptAllButton);

      // Bulk Accept Orders modal should be visible
      const modalTitle = await waitFor(
        () => getByText('Bulk Accept Orders'),
        { timeout: 15000 }
      );
      expect(modalTitle).toBeTruthy();

      // Modal shows confirm button
      const confirmButton = await waitFor(
        () => getByTestId('bulk-accept-confirm-button'),
        { timeout: 15000 }
      );
      expect(confirmButton).toBeTruthy();

      // Press confirm accept
      fireEvent.press(confirmButton);

      // Verify update was called
      await waitFor(() => {
        expect(mockUpdateIn).toHaveBeenCalledWith('id', [101, 102]);
      }, { timeout: 15000 });
    }, 60000);
  });

  describe('RiderDeliveriesScreen Bulk Accept', () => {
    it('displays Bulk Accept banner and allows bulk accept of ready deliveries', async () => {
      const { findByText } = render(
        <RiderDeliveriesScreen navigation={{ navigate: mockNavigate, goBack: jest.fn() }} />
      );

      // Should show Accept All (2) in banner
      const bannerBtn = await findByText('Accept All (2)');
      expect(bannerBtn).toBeTruthy();

      // Press to open modal
      fireEvent.press(bannerBtn);

      // Bulk modal visible
      const modalTitle = await findByText('Bulk Accept Orders');
      expect(modalTitle).toBeTruthy();

      // Press confirm
      const confirmBtn = await findByText('Accept (2)');
      fireEvent.press(confirmBtn);

      await waitFor(() => {
        expect(mockUpdateIn).toHaveBeenCalled();
      });
    });
  });
});
