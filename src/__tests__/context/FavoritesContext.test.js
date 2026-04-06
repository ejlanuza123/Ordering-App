import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

const mockFrom = jest.fn();

const authState = { user: { id: 'u-1' } };

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

const ctxRef = { current: null };

const Probe = ({ useFavorites }) => {
  ctxRef.current = useFavorites();
  return null;
};

describe('FavoritesContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authState.user = { id: 'u-1' };
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    mockFrom.mockImplementation((table) => {
      if (table !== 'favorites') {
        return {};
      }

      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ product_id: 'p-1' }, { product_id: 'p-2' }],
            error: null,
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
        delete: jest.fn().mockReturnValue({
          match: jest.fn().mockResolvedValue({ error: null }),
        }),
      };
    });
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  it('loads favorites for authenticated user', async () => {
    const { FavoritesProvider, useFavorites } = require('../../context/FavoritesContext');

    render(
      <FavoritesProvider>
        <Probe useFavorites={useFavorites} />
      </FavoritesProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
      expect(ctxRef.current.isFavorite('p-1')).toBe(true);
      expect(ctxRef.current.isFavorite('p-2')).toBe(true);
      expect(ctxRef.current.isFavorite('p-9')).toBe(false);
    });
  });

  it('adds favorite when product is not yet favorited', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert,
      delete: jest.fn().mockReturnValue({
        match: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    const { FavoritesProvider, useFavorites } = require('../../context/FavoritesContext');

    render(
      <FavoritesProvider>
        <Probe useFavorites={useFavorites} />
      </FavoritesProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    let nowFavorite;
    await act(async () => {
      nowFavorite = await ctxRef.current.toggleFavorite('p-3');
    });

    expect(nowFavorite).toBe(true);
    expect(insert).toHaveBeenCalledWith({ user_id: 'u-1', product_id: 'p-3' });
    expect(ctxRef.current.isFavorite('p-3')).toBe(true);
  });

  it('removes favorite when product is currently favorited', async () => {
    const match = jest.fn().mockResolvedValue({ error: null });
    const del = jest.fn().mockReturnValue({ match });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [{ product_id: 'p-1' }], error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      delete: del,
    });

    const { FavoritesProvider, useFavorites } = require('../../context/FavoritesContext');

    render(
      <FavoritesProvider>
        <Probe useFavorites={useFavorites} />
      </FavoritesProvider>
    );

    await waitFor(() => expect(ctxRef.current.isFavorite('p-1')).toBe(true));

    let stillFavorite;
    await act(async () => {
      stillFavorite = await ctxRef.current.toggleFavorite('p-1');
    });

    expect(stillFavorite).toBe(false);
    expect(del).toHaveBeenCalled();
    expect(match).toHaveBeenCalledWith({ user_id: 'u-1', product_id: 'p-1' });
    expect(ctxRef.current.isFavorite('p-1')).toBe(false);
  });

  it('returns false for toggleFavorite when user is not authenticated', async () => {
    authState.user = null;

    const { FavoritesProvider, useFavorites } = require('../../context/FavoritesContext');

    render(
      <FavoritesProvider>
        <Probe useFavorites={useFavorites} />
      </FavoritesProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    let result;
    await act(async () => {
      result = await ctxRef.current.toggleFavorite('p-1');
    });

    expect(result).toBe(false);
  });

  it('clears favorites when user becomes unauthenticated', async () => {
    const { FavoritesProvider, useFavorites } = require('../../context/FavoritesContext');

    const view = render(
      <FavoritesProvider>
        <Probe useFavorites={useFavorites} />
      </FavoritesProvider>
    );

    await waitFor(() => expect(ctxRef.current.isFavorite('p-1')).toBe(true));

    authState.user = null;
    view.rerender(
      <FavoritesProvider>
        <Probe useFavorites={useFavorites} />
      </FavoritesProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.isFavorite('p-1')).toBe(false);
      expect(ctxRef.current.favorites.size).toBe(0);
    });
  });

  it('warns and resets loading when favorites fetch throws', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockRejectedValue(new Error('network down')),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      delete: jest.fn().mockReturnValue({
        match: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    const { FavoritesProvider, useFavorites } = require('../../context/FavoritesContext');

    render(
      <FavoritesProvider>
        <Probe useFavorites={useFavorites} />
      </FavoritesProvider>
    );

    await waitFor(() => {
      expect(ctxRef.current.loading).toBe(false);
    });

    expect(console.warn).toHaveBeenCalled();
  });

  it('returns previous state when insert toggle fails', async () => {
    const insert = jest.fn().mockResolvedValue({ error: new Error('insert failed') });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert,
      delete: jest.fn().mockReturnValue({
        match: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    const { FavoritesProvider, useFavorites } = require('../../context/FavoritesContext');

    render(
      <FavoritesProvider>
        <Probe useFavorites={useFavorites} />
      </FavoritesProvider>
    );

    await waitFor(() => expect(ctxRef.current.loading).toBe(false));

    let result;
    await act(async () => {
      result = await ctxRef.current.toggleFavorite('p-3');
    });

    expect(result).toBe(false);
    expect(ctxRef.current.isFavorite('p-3')).toBe(false);
    expect(console.warn).toHaveBeenCalledWith('favorite toggle failed', expect.any(Error));
  });

  it('returns previous state when delete toggle fails', async () => {
    const match = jest.fn().mockResolvedValue({ error: new Error('delete failed') });
    const del = jest.fn().mockReturnValue({ match });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [{ product_id: 'p-1' }], error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      delete: del,
    });

    const { FavoritesProvider, useFavorites } = require('../../context/FavoritesContext');

    render(
      <FavoritesProvider>
        <Probe useFavorites={useFavorites} />
      </FavoritesProvider>
    );

    await waitFor(() => expect(ctxRef.current.isFavorite('p-1')).toBe(true));

    let result;
    await act(async () => {
      result = await ctxRef.current.toggleFavorite('p-1');
    });

    expect(result).toBe(true);
    expect(ctxRef.current.isFavorite('p-1')).toBe(true);
    expect(console.warn).toHaveBeenCalledWith('favorite toggle failed', expect.any(Error));
  });
});

describe('useFavorites', () => {
  it('throws when used outside FavoritesProvider', () => {
    const { useFavorites } = require('../../context/FavoritesContext');

    const BadProbe = () => {
      useFavorites();
      return null;
    };

    expect(() => render(<BadProbe />)).toThrow('useFavorites must be used within FavoritesProvider');
  });
});