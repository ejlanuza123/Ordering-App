import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignOut = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockFrom = jest.fn();
let capturedAppStateHandler;

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
      signOut: (...args) => mockSignOut(...args),
      signInWithPassword: (...args) => mockSignInWithPassword(...args),
    },
    from: (...args) => mockFrom(...args),
  },
}));

const readCtx = { current: null };

const AuthProbe = ({ useAuth }) => {
  readCtx.current = useAuth();
  return null;
};

describe('AuthContext provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedAppStateHandler = undefined;

    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
      capturedAppStateHandler = cb;
      return { remove: jest.fn() };
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'u-1', email: 'customer@test.com' },
        },
      },
    });

    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });

    const single = jest.fn().mockResolvedValue({
      data: { id: 'u-1', role: 'customer', full_name: 'Customer One' },
      error: null,
    });
    const eq = jest.fn().mockReturnValue({ single });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({ eq }),
    });
  });

  it('hydrates provider state from existing session', async () => {
    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(readCtx.current.loading).toBe(false);
      expect(readCtx.current.isAuthenticated).toBe(true);
      expect(readCtx.current.role).toBe('customer');
      expect(readCtx.current.isCustomer).toBe(true);
    });
  });

  it('clears auth state on signOut', async () => {
    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(readCtx.current.loading).toBe(false);
      expect(readCtx.current.isAuthenticated).toBe(true);
    });

    await act(async () => {
      await readCtx.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(readCtx.current.isAuthenticated).toBe(false);
    expect(readCtx.current.user).toBe(null);
    expect(readCtx.current.role).toBe(null);
  });

  it('rejects signIn for unsupported role before auth sign-in call', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const single = jest.fn().mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    });
    const ilike = jest.fn().mockReturnValue({ single });

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({ ilike }),
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
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('signs out after long background inactivity when app resumes', async () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    Object.defineProperty(AppState, 'currentState', {
      value: 'active',
      configurable: true,
      writable: true,
    });

    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(readCtx.current.loading).toBe(false);
      expect(readCtx.current.isAuthenticated).toBe(true);
      expect(typeof capturedAppStateHandler).toBe('function');
    });

    await act(async () => {
      await capturedAppStateHandler('background');
    });

    now = 1000 + 30 * 60 * 1000 + 1;

    await act(async () => {
      await capturedAppStateHandler('active');
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(readCtx.current.isAuthenticated).toBe(false);
    expect(readCtx.current.user).toBe(null);
  });
});
