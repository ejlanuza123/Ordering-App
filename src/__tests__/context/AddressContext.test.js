import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

const mockFrom = jest.fn();
const mockChannel = jest.fn();
const mockRemoveChannel = jest.fn();

const authState = { user: { id: 'u-1' } };

const baseAddresses = [
  {
    id: 'a-1',
    user_id: 'u-1',
    label: 'Home',
    address: 'Street 1',
    address_lat: 9.75,
    address_lng: 118.74,
    is_default: true,
  },
  {
    id: 'a-2',
    user_id: 'u-1',
    label: 'Office',
    address: 'Street 2',
    address_lat: 9.76,
    address_lng: 118.75,
    is_default: false,
  },
];

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

const Probe = ({ useAddresses }) => {
  ctxRef.current = useAddresses();
  return null;
};

describe('AddressContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.user = { id: 'u-1' };

    mockFrom.mockImplementation((table) => {
      if (table !== 'user_addresses') {
        return {};
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: baseAddresses, error: null }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...baseAddresses[1],
                  label: 'Office Updated',
                  is_default: false,
                },
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'a-3',
                user_id: 'u-1',
                label: 'Warehouse',
                address: 'Street 3',
                address_lat: 9.77,
                address_lng: 118.76,
                is_default: false,
              },
              error: null,
            }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    mockChannel.mockReturnValue({
      on: jest.fn().mockReturnValue({
        subscribe: jest.fn().mockReturnValue({ id: 'address-channel' }),
      }),
    });
  });

  it('loads addresses and exposes default address', async () => {
    const { AddressProvider, useAddresses } = require('../../context/AddressContext');

    render(
      <AddressProvider>
        <Probe useAddresses={useAddresses} />
      </AddressProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(ctxRef.current.addresses).toHaveLength(2);
    }, { timeout: 12000 });

    expect(ctxRef.current.getDefaultAddress()?.id).toBe('a-1');
  }, 15000);

  it('adds and deletes an address', async () => {
    const { AddressProvider, useAddresses } = require('../../context/AddressContext');

    render(
      <AddressProvider>
        <Probe useAddresses={useAddresses} />
      </AddressProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    let addResult;
    await act(async () => {
      addResult = await ctxRef.current.addAddress({
        label: 'Warehouse',
        address: 'Street 3',
        address_lat: 9.77,
        address_lng: 118.76,
        is_default: false,
      });
    });

    expect(addResult.success).toBe(true);
    expect(ctxRef.current.addresses.some((a) => a.id === 'a-3')).toBe(true);

    let delResult;
    await act(async () => {
      delResult = await ctxRef.current.deleteAddress('a-3');
    });

    expect(delResult.success).toBe(true);
    expect(ctxRef.current.addresses.some((a) => a.id === 'a-3')).toBe(false);
  });

  it('updates existing address', async () => {
    const { AddressProvider, useAddresses } = require('../../context/AddressContext');

    render(
      <AddressProvider>
        <Probe useAddresses={useAddresses} />
      </AddressProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    let result;
    await act(async () => {
      result = await ctxRef.current.updateAddress('a-2', {
        label: 'Office Updated',
        address: 'Street 2',
        address_lat: 9.76,
        address_lng: 118.75,
        is_default: false,
      });
    });

    expect(result.success).toBe(true);
    expect(ctxRef.current.addresses.find((a) => a.id === 'a-2')?.label).toBe('Office Updated');
  });

  it('returns not authenticated for address mutations when no user is present', async () => {
    authState.user = null;
    const { AddressProvider, useAddresses } = require('../../context/AddressContext');

    render(
      <AddressProvider>
        <Probe useAddresses={useAddresses} />
      </AddressProvider>
    );

    let addResult;
    let updateResult;
    let deleteResult;
    await act(async () => {
      addResult = await ctxRef.current.addAddress({ label: 'Test' });
      updateResult = await ctxRef.current.updateAddress('a-1', { label: 'Test' });
      deleteResult = await ctxRef.current.deleteAddress('a-1');
    });

    expect(addResult).toEqual({ success: false, error: 'Not authenticated' });
    expect(updateResult).toEqual({ success: false, error: 'Not authenticated' });
    expect(deleteResult).toEqual({ success: false, error: 'Not authenticated' });
    expect(ctxRef.current.getDefaultAddress()).toBe(null);
  });

  it('adds a default address and unsets previous defaults locally', async () => {
    mockFrom.mockImplementation((table) => {
      if (table !== 'user_addresses') {
        return {};
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: baseAddresses, error: null }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'a-9',
                user_id: 'u-1',
                label: 'Default New',
                address: 'Street 9',
                address_lat: 9.8,
                address_lng: 118.8,
                is_default: true,
              },
              error: null,
            }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    const { AddressProvider, useAddresses } = require('../../context/AddressContext');

    render(
      <AddressProvider>
        <Probe useAddresses={useAddresses} />
      </AddressProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    let result;
    await act(async () => {
      result = await ctxRef.current.addAddress({
        label: 'Default New',
        address: 'Street 9',
        address_lat: 9.8,
        address_lng: 118.8,
        is_default: true,
      });
    });

    expect(result.success).toBe(true);
    expect(ctxRef.current.getDefaultAddress()?.id).toBe('a-9');
    expect(ctxRef.current.addresses.filter((a) => a.is_default)).toHaveLength(1);
  });

  it('sets a non-default address as default via setDefaultAddress', async () => {
    mockFrom.mockImplementation((table) => {
      if (table !== 'user_addresses') {
        return {};
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: baseAddresses, error: null }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...baseAddresses[1],
                  is_default: true,
                },
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    const { AddressProvider, useAddresses } = require('../../context/AddressContext');

    render(
      <AddressProvider>
        <Probe useAddresses={useAddresses} />
      </AddressProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    let result;
    await act(async () => {
      result = await ctxRef.current.setDefaultAddress('a-2');
    });

    expect(result.success).toBe(true);
    expect(ctxRef.current.getDefaultAddress()?.id).toBe('a-2');
    expect(ctxRef.current.addresses.filter((a) => a.is_default)).toHaveLength(1);
  });

  it('handles fetch errors and still clears loading', async () => {
    mockFrom.mockImplementation((table) => {
      if (table !== 'user_addresses') {
        return {};
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: null, error: new Error('fetch failed') }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({ eq: jest.fn() }),
        insert: jest.fn().mockReturnValue({ select: jest.fn() }),
        delete: jest.fn().mockReturnValue({ eq: jest.fn() }),
      };
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { AddressProvider, useAddresses } = require('../../context/AddressContext');

    render(
      <AddressProvider>
        <Probe useAddresses={useAddresses} />
      </AddressProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
    });

    expect(ctxRef.current.addresses).toEqual([]);
    errorSpy.mockRestore();
  });

  it('removes realtime channel on unmount', async () => {
    const { AddressProvider, useAddresses } = require('../../context/AddressContext');

    const { unmount } = render(
      <AddressProvider>
        <Probe useAddresses={useAddresses} />
      </AddressProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith({ id: 'address-channel' });
  });
});

describe('useAddresses', () => {
  it('throws when used outside AddressProvider', () => {
    const { useAddresses } = require('../../context/AddressContext');

    const BadProbe = () => {
      useAddresses();
      return null;
    };

    expect(() => render(<BadProbe />)).toThrow('useAddresses must be used within an AddressProvider');
  });
});