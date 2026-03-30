import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignOut = jest.fn();
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

    const single = jest.fn().mockResolvedValue({ data: { role: 'customer' }, error: null });
    const ilike = jest.fn().mockReturnValue({ single });
    const eq = jest.fn().mockReturnValue({ single });

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
    const single = jest.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    const ilike = jest.fn().mockReturnValue({ single });
    mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue({ ilike }) });

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
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});
