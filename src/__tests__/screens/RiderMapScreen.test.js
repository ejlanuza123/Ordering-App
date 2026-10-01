import React from 'react';
import { render, waitForElementToBeRemoved } from '@testing-library/react-native';
import RiderMapScreen from '../../screens/rider/RiderMapScreen';
import * as Location from 'expo-location';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    WebView: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: jest.fn(),
        postMessage: jest.fn(),
      }));
      return <View testID="mock-webview" {...props} />;
    }),
  };
});

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
  useNavigation: () => ({
    goBack: jest.fn(),
    navigate: jest.fn(),
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

let mockIsDarkMode = false;
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: mockIsDarkMode,
    colors: {
      primary: '#0033A0',
      background: mockIsDarkMode ? '#0F172A' : '#F8FAFC',
      surface: mockIsDarkMode ? '#1E293B' : '#FFFFFF',
      surfaceElevated: mockIsDarkMode ? '#334155' : '#F1F5F9',
      textPrimary: mockIsDarkMode ? '#F8FAFC' : '#0F172A',
      textSecondary: mockIsDarkMode ? '#94A3B8' : '#64748B',
      border: mockIsDarkMode ? '#334155' : '#E2E8F0',
      shadow: '#000000',
    },
  }),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({ data: { avatar_url: null, is_online: true }, error: null }),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      }),
    }),
  },
}));

jest.mock('../../utils/location', () => ({
  requestLocationPermission: jest.fn().mockResolvedValue(true),
  PUERTO_PRINCESA_LANDMARKS: [],
}));

jest.mock('../../utils/riderLocation', () => ({
  startLocationTracking: jest.fn().mockResolvedValue({ success: true, subscription: { remove: jest.fn() } }),
  stopLocationTracking: jest.fn(),
}));

jest.mock('../../services/riderPresenceService', () => ({
  riderPresenceService: {
    isIntendedOnline: jest.fn().mockReturnValue(true),
    setOnlineStatus: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('expo-location', () => ({
  Accuracy: {
    Balanced: 3,
    Highest: 6,
  },
  getLastKnownPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 9.753, longitude: 118.747 },
  }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 9.754, longitude: 118.748 },
  }),
}));

describe('Petron RiderMapScreen', () => {
  jest.setTimeout(20000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDarkMode = false;
  });

  it('renders correctly and acquires location using fast cache and balanced accuracy', async () => {
    const { getByText, queryByText } = render(
      <RiderMapScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: {} }} />
    );

    if (queryByText('Loading map...')) {
      await waitForElementToBeRemoved(() => queryByText('Loading map...'), { timeout: 10000 });
    }

    expect(getByText('Rider GPS Cockpit')).toBeTruthy();
    expect(Location.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 60000 });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  });

  it('handles dark mode theme rendering for GPS cockpit', async () => {
    mockIsDarkMode = true;
    const { getByText, queryByText } = render(
      <RiderMapScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: {} }} />
    );

    if (queryByText('Loading map...')) {
      await waitForElementToBeRemoved(() => queryByText('Loading map...'), { timeout: 10000 });
    }

    expect(getByText('Rider GPS Cockpit')).toBeTruthy();
    expect(getByText('Active Deliveries (0)')).toBeTruthy();
  });
});
