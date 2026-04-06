import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockSignOut = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockFrom = jest.fn();
let capturedAppStateHandler;
let capturedAuthStateHandler;
let appStateRemove;

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
    capturedAuthStateHandler = undefined;
    appStateRemove = jest.fn();

    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
      capturedAppStateHandler = cb;
      return { remove: appStateRemove };
    });

    mockGetSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'u-1', email: 'customer@test.com' },
        },
      },
    });

    mockOnAuthStateChange.mockImplementation((cb) => {
      capturedAuthStateHandler = cb;
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      };
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

  it('stays unauthenticated when there is no existing session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(readCtx.current.loading).toBe(false);
      expect(readCtx.current.isAuthenticated).toBe(false);
      expect(readCtx.current.user).toBe(null);
    });
  });

  it('clears state on auth state change when session becomes null', async () => {
    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => expect(readCtx.current.isAuthenticated).toBe(true));

    await act(async () => {
      await capturedAuthStateHandler('SIGNED_OUT', null);
    });

    expect(readCtx.current.user).toBe(null);
    expect(readCtx.current.profile).toBe(null);
    expect(readCtx.current.role).toBe(null);
    expect(readCtx.current.loading).toBe(false);
  });

  it('signs out and clears state when auth change resolves to unsupported role', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'u-admin', role: 'admin' },
            error: null,
          }),
        }),
      }),
    }));

    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => expect(readCtx.current.loading).toBe(false));

    await act(async () => {
      await capturedAuthStateHandler('SIGNED_IN', {
        user: { id: 'u-admin', email: 'admin@test.com' },
      });
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(readCtx.current.user).toBe(null);
    expect(readCtx.current.role).toBe(null);
  });

  it('rechecks session instead of signing out when app resumes before timeout', async () => {
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

    await waitFor(() => expect(readCtx.current.loading).toBe(false));

    await act(async () => {
      await capturedAppStateHandler('background');
    });

    now = 1000 + 5 * 60 * 1000;

    await act(async () => {
      await capturedAppStateHandler('active');
    });

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockGetSession).toHaveBeenCalledTimes(2);

    Date.now.mockRestore();
  });

  it('signs in successfully for an allowed role', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    mockFrom.mockImplementation(() => ({
      select: jest.fn((columns) => {
        if (columns === 'role') {
          return {
            ilike: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { role: 'rider' },
                error: null,
              }),
            }),
          };
        }

        return {
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'u-2', role: 'rider', full_name: 'Rider One' },
              error: null,
            }),
          }),
        };
      }),
    }));

    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'u-2', email: 'rider@test.com' } },
      error: null,
    });

    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => expect(readCtx.current.loading).toBe(false));

    await act(async () => {
      await readCtx.current.signIn('rider@test.com', 'secret');
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'rider@test.com',
      password: 'secret',
    });
    expect(readCtx.current.isAuthenticated).toBe(true);
    expect(readCtx.current.role).toBe('rider');
    expect(readCtx.current.isRider).toBe(true);
  });

  it('throws signIn auth errors from supabase', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { role: 'customer' }, error: null }),
        }),
      }),
    }));

    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: new Error('invalid credentials'),
    });

    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => expect(readCtx.current.loading).toBe(false));

    await expect(readCtx.current.signIn('customer@test.com', 'bad')).rejects.toThrow('invalid credentials');
  });

  it('removes app state listener on unmount', async () => {
    const { AuthProvider, useAuth } = require('../../context/AuthContext');

    const { unmount } = render(
      <AuthProvider>
        <AuthProbe useAuth={useAuth} />
      </AuthProvider>
    );

    await waitFor(() => expect(readCtx.current.loading).toBe(false));

    unmount();
    expect(appStateRemove).toHaveBeenCalledTimes(1);
  });
});
