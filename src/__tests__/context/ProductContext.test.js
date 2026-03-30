import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

const mockFrom = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

const mockOrder = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();

const authState = { user: { id: 'u-1' } };

let realtimeCallback;

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannel(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}));

const ctxRef = { current: null };

const Probe = ({ useProducts }) => {
  ctxRef.current = useProducts();
  return null;
};

describe('ProductContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.user = { id: 'u-1' };
    realtimeCallback = undefined;

    mockOrder.mockResolvedValue({
      data: [
        {
          id: 'p-1',
          name: 'Diesel',
          category: 'Fuel',
          stock_quantity: 5,
          low_stock_threshold: 10,
          is_active: true,
        },
        {
          id: 'p-2',
          name: 'Oil',
          category: 'Lubricants',
          stock_quantity: 30,
          low_stock_threshold: 10,
          is_active: true,
        },
      ],
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: 'p-1',
        name: 'Diesel',
        category: 'Fuel',
        stock_quantity: 5,
        low_stock_threshold: 10,
        is_active: true,
      },
      error: null,
    });

    mockEq.mockImplementation((column) => {
      if (column === 'is_active') {
        return { order: mockOrder };
      }

      if (column === 'id') {
        return { single: mockSingle };
      }

      return { order: mockOrder, single: mockSingle };
    });

    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    mockChannel.mockReturnValue({
      on: jest.fn().mockImplementation((_event, _filter, callback) => {
        realtimeCallback = callback;
        return {
          subscribe: jest.fn().mockReturnValue({ id: 'channel-1' }),
        };
      }),
    });
  });

  it('loads products and computes selectors', async () => {
    const { ProductProvider, useProducts } = require('../../context/ProductContext');

    render(
      <ProductProvider>
        <Probe useProducts={useProducts} />
      </ProductProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(ctxRef.current.products).toHaveLength(2);
    });

    expect(ctxRef.current.getProductsByCategory('Fuel')).toHaveLength(1);
    expect(ctxRef.current.getProductsByCategory('All')).toHaveLength(2);
    expect(ctxRef.current.getLowStockProducts()).toHaveLength(1);
    expect(ctxRef.current.getActiveProducts()).toHaveLength(2);
    expect(ctxRef.current.isLowStock(ctxRef.current.products[0])).toBe(true);
  });

  it('returns product by id', async () => {
    const { ProductProvider, useProducts } = require('../../context/ProductContext');

    render(
      <ProductProvider>
        <Probe useProducts={useProducts} />
      </ProductProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    const product = await ctxRef.current.getProductById('p-1');
    expect(product?.id).toBe('p-1');
  });

  it('handles realtime insert, update, and delete', async () => {
    const { ProductProvider, useProducts } = require('../../context/ProductContext');

    render(
      <ProductProvider>
        <Probe useProducts={useProducts} />
      </ProductProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(typeof realtimeCallback).toBe('function');
    });

    act(() => {
      realtimeCallback({
        eventType: 'INSERT',
        new: {
          id: 'p-3',
          name: 'Grease',
          category: 'Lubricants',
          stock_quantity: 20,
          is_active: true,
        },
      });
    });

    expect(ctxRef.current.products[0].id).toBe('p-3');
    expect(ctxRef.current.hasRealtimeUpdates).toBe(true);

    act(() => {
      realtimeCallback({
        eventType: 'UPDATE',
        old: { id: 'p-1', stock_quantity: 5 },
        new: {
          id: 'p-1',
          name: 'Diesel Updated',
          category: 'Fuel',
          stock_quantity: 4,
          is_active: true,
        },
      });
    });

    expect(ctxRef.current.products.find((p) => p.id === 'p-1').name).toBe('Diesel Updated');

    act(() => {
      realtimeCallback({
        eventType: 'DELETE',
        old: { id: 'p-2' },
      });
    });

    expect(ctxRef.current.products.some((p) => p.id === 'p-2')).toBe(false);
  });

  it('refreshProducts clears realtime flag', async () => {
    const { ProductProvider, useProducts } = require('../../context/ProductContext');

    render(
      <ProductProvider>
        <Probe useProducts={useProducts} />
      </ProductProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    act(() => {
      realtimeCallback({
        eventType: 'INSERT',
        new: {
          id: 'p-9',
          name: 'Filter',
          category: 'Parts',
          stock_quantity: 2,
          is_active: true,
        },
      });
    });

    expect(ctxRef.current.hasRealtimeUpdates).toBe(true);

    await act(async () => {
      await ctxRef.current.refreshProducts();
    });

    expect(ctxRef.current.hasRealtimeUpdates).toBe(false);
  });
});

describe('useProducts', () => {
  it('throws when used outside ProductProvider', () => {
    const { useProducts } = require('../../context/ProductContext');

    const BadProbe = () => {
      useProducts();
      return null;
    };

    expect(() => render(<BadProbe />)).toThrow('useProducts must be used within a ProductProvider');
  });
});