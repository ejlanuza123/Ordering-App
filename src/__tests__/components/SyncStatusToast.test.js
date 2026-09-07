import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import SyncStatusToast from '../../components/SyncStatusToast';
import { offlineStorageService } from '../../services/offlineStorageService';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../services/offlineStorageService', () => ({
  offlineStorageService: {
    subscribeToSyncEvents: jest.fn(),
    subscribeToDeadLetterUpdates: jest.fn(),
    retryDeadLetterOperation: jest.fn(),
    retryAllDeadLetters: jest.fn(),
    removeDeadLetterOperation: jest.fn(),
    clearDeadLetterQueue: jest.fn(),
  },
}));

describe('SyncStatusToast & DeadLetterQueueModal', () => {
  let syncCallback;
  let deadLetterCallback;
  const mockUnsubSync = jest.fn();
  const mockUnsubDead = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    offlineStorageService.subscribeToSyncEvents.mockImplementation((cb) => {
      syncCallback = cb;
      return mockUnsubSync;
    });

    offlineStorageService.subscribeToDeadLetterUpdates.mockImplementation((cb) => {
      deadLetterCallback = cb;
      return mockUnsubDead;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing initially when queue is clean and idle', () => {
    const { queryByText } = render(<SyncStatusToast />);
    expect(queryByText(/Syncing/i)).toBeNull();
    expect(queryByText(/failed/i)).toBeNull();
  });

  it('shows syncing indicator when sync_progress arrives', () => {
    const { getByText } = render(<SyncStatusToast />);

    act(() => {
      syncCallback({ type: 'sync_start', total: 3, pending: 3 });
      syncCallback({ type: 'sync_progress', current: 2, total: 3 });
    });

    expect(getByText('Syncing 2 of 3...')).toBeTruthy();
  });

  it('shows success checkmark on sync_complete and auto-hides', () => {
    const { getByText, queryByText } = render(<SyncStatusToast />);

    act(() => {
      syncCallback({ type: 'sync_complete', processed: 3, pending: 0, deadLetters: 0 });
    });

    expect(getByText('3 offline actions synced!')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    expect(queryByText('3 offline actions synced!')).toBeNull();
  });

  it('shows dead letter alert when items fail and allows opening modal to retry', async () => {
    const deadItem = {
      queueId: 'q-fail-1',
      type: 'create_order',
      error: 'Network timeout during checkout',
      failedAt: Date.now(),
    };

    const { getByText } = render(<SyncStatusToast />);

    act(() => {
      deadLetterCallback([deadItem]);
    });

    const alertBanner = getByText('1 sync item failed • Tap to resolve');
    expect(alertBanner).toBeTruthy();

    // Tap to open modal
    await act(async () => {
      fireEvent.press(alertBanner);
    });

    expect(getByText('Failed Offline Actions')).toBeTruthy();
    expect(getByText('Order Placement')).toBeTruthy();
    expect(getByText('Network timeout during checkout')).toBeTruthy();

    // Tap retry
    const retryBtn = getByText('Retry');
    await act(async () => {
      fireEvent.press(retryBtn);
    });

    expect(offlineStorageService.retryDeadLetterOperation).toHaveBeenCalledWith('q-fail-1');
  });

  it('triggers retryAllDeadLetters when Retry All is pressed', async () => {
    const deadItems = [
      { queueId: 'q-1', type: 'create_order', error: 'err1' },
      { queueId: 'q-2', table: 'delivery_proofs', error: 'err2' },
    ];

    const { getByText } = render(<SyncStatusToast />);

    act(() => {
      deadLetterCallback(deadItems);
    });

    await act(async () => {
      fireEvent.press(getByText('2 sync items failed • Tap to resolve'));
    });

    const retryAllBtn = getByText('Retry All');
    await act(async () => {
      fireEvent.press(retryAllBtn);
    });

    expect(offlineStorageService.retryAllDeadLetters).toHaveBeenCalledTimes(1);
  });
});
