import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignInWithPassword = jest.fn(() => Promise.resolve({ data: { user: { id: 'u-1', email: 'test@test.com' } }, error: null }));
const mockSignOut = jest.fn(() => Promise.resolve({ error: null }));
const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
      signInWithPassword: (...args) => mockSignInWithPassword(...args),
      signOut: (...args) => mockSignOut(...args),
    },
    from: (...args) => mockFrom(...args),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
  multiRemove: jest.fn().mockResolvedValue(null),
  getAllKeys: jest.fn().mockResolvedValue([]),
}));

const readCtx = { current: null };

const AuthProbe = ({ useAuth }) => {
  readCtx.current = useAuth();
  return null;
};

describe('useAuth (mobile)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });

    const maybeSingle = jest.fn().mockResolvedValue({ data: { role: 'customer' }, error: null });
    const ilike = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ maybeSingle });

    mockFrom.mockReturnValue({
      select: jest.fn().mockImplementation((fields) => {
        if (fields === 'role') return { ilike };
        return { eq };
      }),
    });
  });

  it('exposes unauthenticated session state by default', async () => {
    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(readCtx.current.loading).toBe(false);
      expect(readCtx.current.isAuthenticated).toBe(false);
    });
  });

  it('blocks sign-in for unsupported role', async () => {
    const roleMaybeSingle = jest.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    const ilike = jest.fn().mockReturnValue({ maybeSingle: roleMaybeSingle });
    
    const profileMaybeSingle = jest.fn().mockResolvedValue({ 
      data: { id: 'u-admin', role: 'admin', full_name: 'Admin' }, 
      error: null 
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle: profileMaybeSingle });

    mockFrom.mockReturnValue({
      select: jest.fn().mockImplementation((fields) => {
        if (fields === 'role') {
          return { ilike };
        }
        return { eq: jest.fn().mockReturnValue({ maybeSingle: profileMaybeSingle }) };
      }),
    });

    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(readCtx.current.loading).toBe(false);
    });

    await expect(readCtx.current.signIn('admin@test.com', 'secret')).rejects.toThrow(
      'This account is not allowed to access the app.'
    );
    expect(mockSignInWithPassword).toHaveBeenCalled();
  });
});