import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import RiderProfileScreen from '../../screens/rider/RiderProfileScreen';
import { locationTrackingService } from '../../services/locationTrackingService';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback) => {
    const React = require('react');
    React.useEffect(() => {
      callback();
    }, []);
  },
}));

const mockProfile = {
  id: 'rider-123',
  full_name: 'Rider Juan',
  phone_number: '09123456789',
  address: 'Puerto Princesa City',
  vehicle_type: 'Motorcycle',
  vehicle_plate: 'PAL 1234',
  notifications_enabled: true,
  is_online: true,
  avatar_url: null,
};

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    profile: mockProfile,
    signOut: jest.fn(),
  }),
}));

jest.mock('../../context/RiderRatingContext', () => ({
  useRiderRatings: () => ({
    getRiderStats: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('../../components/Avatar', () => 'Avatar');
jest.mock('../../components/CustomAlertModal', () => 'CustomAlertModal');

jest.mock('../../services/riderPresenceService', () => ({
  riderPresenceService: {
    setIntendedOnline: jest.fn(),
  },
}));

jest.mock('../../services/locationTrackingService', () => ({
  locationTrackingService: {
    isBatterySaverEnabled: jest.fn().mockResolvedValue(true),
    setBatterySaverEnabled: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              avatar_url: null,
              notifications_enabled: true,
              is_online: true,
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

describe('RiderProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders preferences section including Battery Saver (Adaptive GPS)', async () => {
    const { getByText } = render(<RiderProfileScreen navigation={{ navigate: jest.fn() }} />);

    await waitFor(() => {
      expect(getByText('Preferences')).toBeTruthy();
      expect(getByText('Online Status')).toBeTruthy();
      expect(getByText('Push Notifications')).toBeTruthy();
      expect(getByText('Battery Saver (Adaptive GPS)')).toBeTruthy();
      expect(
        getByText('Throttles stationary GPS updates and caches active delivery queries to save battery')
      ).toBeTruthy();
    });
  });

  it('toggles battery saver setting and invokes locationTrackingService.setBatterySaverEnabled', async () => {
    const { getByText, UNSAFE_getAllByType } = render(
      <RiderProfileScreen navigation={{ navigate: jest.fn() }} />
    );

    await waitFor(() => {
      expect(getByText('Battery Saver (Adaptive GPS)')).toBeTruthy();
    });

    const { Switch } = require('react-native');
    const switches = UNSAFE_getAllByType(Switch);
    // 3 switches: Online Status, Notifications, Battery Saver
    expect(switches.length).toBe(3);
    const batterySwitch = switches[2];

    await act(async () => {
      fireEvent(batterySwitch, 'valueChange', false);
    });

    expect(locationTrackingService.setBatterySaverEnabled).toHaveBeenCalledWith(false);
  });
});
