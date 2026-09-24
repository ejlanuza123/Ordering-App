import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import OrderHistoryScreen from '../../screens/customer/OrderHistoryScreen';

// Mock dependencies
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../components/SkeletonLoader', () => () => null);

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-123' },
    profile: { id: 'test-user-123', full_name: 'Test User' },
  }),
}));

jest.mock('../../context/RiderRatingContext', () => ({
  useRiderRatings: () => ({
    rateRider: jest.fn(),
    hasUserRated: jest.fn().mockResolvedValue(false),
    getUserRating: jest.fn().mockResolvedValue(null),
  }),
}));

jest.mock('../../context/CartContext', () => ({
  useCart: () => ({
    reorderItems: jest.fn(),
  }),
}));

jest.mock('../../services/orderService', () => ({
  orderService: {
    getQueuedOrders: jest.fn().mockResolvedValue([]),
    updateOrder: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../../services/offlineStorageService', () => ({
  offlineStorageService: {
    saveData: jest.fn().mockResolvedValue({ success: true }),
    getData: jest.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

jest.mock('../../services/chatService', () => ({
  chatService: {
    getOrCreateOrderConversation: jest.fn().mockResolvedValue({ success: true, conversation: { id: 'c1' } }),
  },
}));

const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
};

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'ord-1',
            order_number: 'ORD-101',
            total_amount: 500,
            delivery_fee: 50,
            status: 'completed',
            delivery_address: '123 Main St',
            payment_method: 'Cash',
            created_at: '2026-09-01T10:00:00Z',
            archived: false,
            order_items: [],
            deliveries: [],
          },
          {
            id: 'ord-2',
            order_number: 'ORD-102',
            total_amount: 300,
            delivery_fee: 50,
            status: 'completed',
            delivery_address: '456 Side St',
            payment_method: 'Cash',
            created_at: '2026-08-30T10:00:00Z',
            archived: true,
            order_items: [],
            deliveries: [],
          },
        ],
        error: null,
      }),
    })),
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn(),
  },
}));

describe('OrderHistoryScreen - Archive Navigation & Icon', () => {
  let mockNavigation;

  beforeEach(() => {
    jest.setTimeout(20000);
    jest.clearAllMocks();
    mockNavigation = {
      navigate: jest.fn(),
      goBack: jest.fn(),
    };
  });

  it('renders "My Orders" initially and does not contain squished text label in archive button', async () => {
    const { findByText, queryByText, getByLabelText } = render(
      <OrderHistoryScreen navigation={mockNavigation} route={{}} />
    );

    const title = await findByText(/My Orders/i, {}, { timeout: 25000 });
    expect(title).toBeTruthy();

    // Archive button exists as icon button without "ARCHIVED" label text
    const archiveBtn = getByLabelText('View Archived Orders');
    expect(archiveBtn).toBeTruthy();
    expect(queryByText('ARCHIVED')).toBeNull();

    // Clicking back from main orders exits screen via navigation.goBack()
    const backBtn = getByLabelText('Go Back');
    fireEvent.press(backBtn);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  }, 60000);

  it('switches to "Archived Orders" without text label and returns to order list on back press', async () => {
    const { findByText, queryByText, getByLabelText } = render(
      <OrderHistoryScreen navigation={mockNavigation} route={{}} />
    );

    const title = await findByText(/My Orders/i, {}, { timeout: 25000 });
    expect(title).toBeTruthy();

    // Tap archive button to enter archive view
    const archiveBtn = getByLabelText('View Archived Orders');
    fireEvent.press(archiveBtn);

    // Title changes to "Archived Orders"
    expect(await findByText(/Archived Orders/i, {}, { timeout: 25000 })).toBeTruthy();

    // The button should NOT render squished text label "ARCHIVED"
    expect(queryByText('ARCHIVED')).toBeNull();

    // Top-left back button now returns to order list, NOT navigation.goBack()
    const backBtn = getByLabelText('Back to Orders');
    fireEvent.press(backBtn);

    // Should return to "My Orders"
    expect(await findByText(/My Orders/i, {}, { timeout: 25000 })).toBeTruthy();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  }, 30000);

  it('handles Android hardware back press by returning to order list when in archive view', async () => {
    const backHandlerSpy = jest.spyOn(BackHandler, 'addEventListener');

    const { findByText, getByLabelText } = render(
      <OrderHistoryScreen navigation={mockNavigation} route={{}} />
    );

    await findByText(/My Orders/i, {}, { timeout: 25000 });

    // Enter archive view
    fireEvent.press(getByLabelText('View Archived Orders'));
    expect(await findByText(/Archived Orders/i, {}, { timeout: 25000 })).toBeTruthy();

    // Trigger Android hardware back press callback
    const hardwareBackCallback = backHandlerSpy.mock.calls[backHandlerSpy.mock.calls.length - 1][1];
    let handled = false;
    act(() => {
      handled = hardwareBackCallback();
    });

    // It should handle the press and navigate back to "My Orders"
    expect(handled).toBe(true);
    expect(await findByText(/My Orders/i, {}, { timeout: 25000 })).toBeTruthy();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();

    backHandlerSpy.mockRestore();
  }, 30000);
});
