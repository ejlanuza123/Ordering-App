import '@testing-library/jest-native/extend-expect';

// Jest runs in a pure JS environment, so native modules must be mocked.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 9.7535, longitude: 118.7479, accuracy: 5 }
  }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 9.7535, longitude: 118.7479, accuracy: 5 }
  }),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([
    {
      street: 'National Highway',
      district: 'San Pedro',
      city: 'Puerto Princesa City',
      region: 'Palawan',
      postalCode: '5300'
    }
  ]),
  Accuracy: {
    Highest: 6,
    BestForNavigation: 6
  }
}));
