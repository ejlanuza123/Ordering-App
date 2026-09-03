import React from 'react';
import { render, act } from '@testing-library/react-native';
import OfflineBanner from '../../components/OfflineBanner';
import { networkStateService } from '../../services/networkStateService';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../services/networkStateService', () => ({
  networkStateService: {
    subscribe: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));

describe('OfflineBanner', () => {
  let subscribeCallback;
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    networkStateService.subscribe.mockImplementation((cb) => {
      subscribeCallback = cb;
      return mockUnsubscribe;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when initially online', () => {
    const { toJSON } = render(<OfflineBanner />);

    act(() => {
      subscribeCallback({ isOnline: true, wasOffline: false, initial: true });
    });

    expect(toJSON()).toBeNull();
  });

  it('displays offline banner when network drops', () => {
    const { getByText } = render(<OfflineBanner />);

    act(() => {
      subscribeCallback({ isOnline: false, wasOffline: false, initial: false });
    });

    expect(
      getByText('Offline Mode — Orders & actions will sync automatically')
    ).toBeTruthy();
  });

  it('displays reconnected banner and auto-hides after delay', () => {
    const { getByText, queryByText } = render(<OfflineBanner />);

    // Go offline
    act(() => {
      subscribeCallback({ isOnline: false, wasOffline: false, initial: false });
    });
    expect(
      getByText('Offline Mode — Orders & actions will sync automatically')
    ).toBeTruthy();

    // Reconnect
    act(() => {
      subscribeCallback({ isOnline: true, wasOffline: true, initial: false });
    });
    expect(getByText('Back Online — Sync complete')).toBeTruthy();

    // Fast-forward timer by 2500ms
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(queryByText('Back Online — Sync complete')).toBeNull();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = render(<OfflineBanner />);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
