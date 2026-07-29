import '@testing-library/jest-native/extend-expect';

// Jest runs in a pure JS environment, so native modules must be mocked.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
