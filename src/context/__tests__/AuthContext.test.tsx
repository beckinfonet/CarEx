/**
 * Plan 04-04 — AuthContext refresh dedupe/cooldown/listener tests.
 *
 * These tests verify the behaviors added by Plan 04-04 on top of the existing
 * AuthProvider:
 *   - registers setTokenProvider on mount
 *   - registers setModerationRefreshListener on mount
 *   - dedupes concurrent refreshUser calls
 *   - enforces a 30s shared cooldown across AppState + interceptor paths
 *   - skips refresh when user is null (D-16)
 *   - passes _skipModerationInterceptor on the listener-triggered refresh
 *   - keeps the token ref in sync across login / loadStorageData / logout
 */

// --- Mock setup --- //
// Mock AsyncStorage (used by AuthService getUserData/getToken on mount)
jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    setItem: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
    removeItem: jest.fn(async (k: string) => {
      delete store[k];
    }),
    __store: store,
    __reset: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
});

// Spy on client.ts exports without actually exercising axios interceptors.
jest.mock('../../services/http/client', () => ({
  setTokenProvider: jest.fn(),
  setModerationRefreshListener: jest.fn(),
  setIdTokenRefreshListener: jest.fn(),
  setLogoutTrigger: jest.fn(),
  apiClient: { defaults: {}, interceptors: {} },
}));

// Mock AuthService — every method AuthContext touches.
jest.mock('../../services/AuthService', () => ({
  AuthService: {
    getUserData: jest.fn(async () => null),
    getToken: jest.fn(async () => null),
    getBackendUser: jest.fn(async () => ({ moderationStatus: { state: 'active' } })),
    getAdminStatus: jest.fn(async () => ({ isAdmin: false })),
    signIn: jest.fn(async () => ({
      email: 'a@b.com',
      localId: 'uid-1',
      idToken: 'id-token-1',
      refreshToken: 'refresh-token-1',
      expiresIn: '3600',
    })),
    signUp: jest.fn(async () => ({
      email: 'new@b.com',
      localId: 'uid-new',
      idToken: 'id-token-new',
      refreshToken: 'refresh-token-new',
      expiresIn: '3600',
    })),
    logout: jest.fn(async () => {}),
    createBackendUser: jest.fn(async () => {}),
    requestSellerStatus: jest.fn(async () => {}),
    requestBrokerStatus: jest.fn(async () => {}),
    requestLogisticsStatus: jest.fn(async () => {}),
    sendOtp: jest.fn(async () => {}),
    verifyOtp: jest.fn(async () => {}),
    deleteAccount: jest.fn(async () => {}),
    // Plan 05-12 mocks
    saveAuthSession: jest.fn(async () => {}),
    getRefreshToken: jest.fn(async () => null),
    getIdTokenExpiresAt: jest.fn(async () => 0),
    refreshIdToken: jest.fn(async () => ({
      idToken: 'refreshed-id-token',
      refreshToken: 'rotated-refresh-token',
      expiresIn: '3600',
    })),
  },
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AuthProvider, useAuth } from '../AuthContext';
import { AuthService } from '../../services/AuthService';
import {
  setTokenProvider,
  setModerationRefreshListener,
  setIdTokenRefreshListener,
  setLogoutTrigger,
} from '../../services/http/client';

// Harness that captures the AuthContext value so tests can drive it.
type Ctx = ReturnType<typeof useAuth>;
let capturedCtx: Ctx | null = null;
function CtxCapture() {
  capturedCtx = useAuth();
  return null;
}

async function flush() {
  // Pump the microtask queue so awaited promises inside effects resolve.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function mountProvider() {
  capturedCtx = null;
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <AuthProvider>
        <CtxCapture />
      </AuthProvider>,
    );
    await flush();
  });
  return renderer!;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset AsyncStorage mock store
  const AS = require('@react-native-async-storage/async-storage');
  AS.__reset();
  // Reset AuthService mocks to baseline
  (AuthService.getUserData as jest.Mock).mockResolvedValue(null);
  (AuthService.getToken as jest.Mock).mockResolvedValue(null);
  (AuthService.getBackendUser as jest.Mock).mockResolvedValue({
    moderationStatus: { state: 'active' },
  });
  (AuthService.getAdminStatus as jest.Mock).mockResolvedValue({
    isAdmin: false,
  });
  (AuthService.signIn as jest.Mock).mockResolvedValue({
    email: 'a@b.com',
    localId: 'uid-1',
    idToken: 'id-token-1',
    refreshToken: 'refresh-token-1',
    expiresIn: '3600',
  });
  // Plan 05-12 mock resets
  (AuthService.saveAuthSession as jest.Mock).mockResolvedValue(undefined);
  (AuthService.getRefreshToken as jest.Mock).mockResolvedValue(null);
  (AuthService.getIdTokenExpiresAt as jest.Mock).mockResolvedValue(0);
  (AuthService.refreshIdToken as jest.Mock).mockResolvedValue({
    idToken: 'refreshed-id-token',
    refreshToken: 'rotated-refresh-token',
    expiresIn: '3600',
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AuthContext — Plan 04-04 behaviors', () => {
  it('Test 1: registers setTokenProvider on mount; getter returns null before login and token after login', async () => {
    await mountProvider();

    expect(setTokenProvider).toHaveBeenCalledTimes(1);
    const getter = (setTokenProvider as jest.Mock).mock.calls[0][0];
    expect(typeof getter).toBe('function');
    expect(getter()).toBeNull();

    // Perform login
    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });
    expect(getter()).toBe('id-token-1');
  });

  it('Test 2: registers setModerationRefreshListener on mount; listener calls getBackendUser with skip flag', async () => {
    await mountProvider();

    expect(setModerationRefreshListener).toHaveBeenCalledTimes(1);
    const listener = (setModerationRefreshListener as jest.Mock).mock.calls[0][0];
    expect(typeof listener).toBe('function');

    // Log in so there's a user for the listener to refresh
    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });

    (AuthService.getBackendUser as jest.Mock).mockClear();

    await ReactTestRenderer.act(async () => {
      await listener();
      await flush();
    });

    // Listener should have invoked getBackendUser with the skip flag
    expect(AuthService.getBackendUser).toHaveBeenCalledTimes(1);
    const [, config] = (AuthService.getBackendUser as jest.Mock).mock.calls[0];
    expect(config?._skipModerationInterceptor).toBe(true);
  });

  it('Test 3: refreshUser dedupes concurrent calls — parallel invocations result in exactly one getBackendUser call', async () => {
    await mountProvider();
    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });

    (AuthService.getBackendUser as jest.Mock).mockClear();

    // Make getBackendUser slow so both refreshUser calls overlap
    let resolveFetch: (v: any) => void = () => {};
    (AuthService.getBackendUser as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveFetch = res;
        }),
    );

    let p1: Promise<void> | null = null;
    let p2: Promise<void> | null = null;
    await ReactTestRenderer.act(async () => {
      p1 = capturedCtx!.refreshUser();
      p2 = capturedCtx!.refreshUser();
      await flush();
      resolveFetch({ moderationStatus: { state: 'active' } });
      await p1;
      await p2;
      await flush();
    });

    expect(AuthService.getBackendUser).toHaveBeenCalledTimes(1);
  });

  it('Test 4: refreshUser cooldown — second call within 30s skipped; after 35s it fetches again', async () => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    await mountProvider();
    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });

    (AuthService.getBackendUser as jest.Mock).mockClear();

    // First call: executes
    await ReactTestRenderer.act(async () => {
      await capturedCtx!.refreshUser();
      await flush();
    });
    expect(AuthService.getBackendUser).toHaveBeenCalledTimes(1);

    // Advance 10s and call again — within 30s cooldown → skip
    await ReactTestRenderer.act(async () => {
      jest.setSystemTime(new Date('2026-01-01T00:00:10Z'));
      await capturedCtx!.refreshUser();
      await flush();
    });
    expect(AuthService.getBackendUser).toHaveBeenCalledTimes(1);

    // Advance another 25s (total 35s) and call — past cooldown → fetch
    await ReactTestRenderer.act(async () => {
      jest.setSystemTime(new Date('2026-01-01T00:00:35Z'));
      await capturedCtx!.refreshUser();
      await flush();
    });
    expect(AuthService.getBackendUser).toHaveBeenCalledTimes(2);
  });

  it('Test 5: refreshUser is a no-op when logged out — getBackendUser not called; resolves without error', async () => {
    await mountProvider();

    (AuthService.getBackendUser as jest.Mock).mockClear();

    await expect(
      (async () => {
        await ReactTestRenderer.act(async () => {
          await capturedCtx!.refreshUser();
          await flush();
        });
      })(),
    ).resolves.toBeUndefined();

    expect(AuthService.getBackendUser).not.toHaveBeenCalled();
  });

  it('Test 6: listener-triggered refresh uses the _skipModerationInterceptor axios config flag', async () => {
    await mountProvider();
    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });

    const listener = (setModerationRefreshListener as jest.Mock).mock.calls[0][0];
    (AuthService.getBackendUser as jest.Mock).mockClear();

    await ReactTestRenderer.act(async () => {
      await listener();
      await flush();
    });

    expect(AuthService.getBackendUser).toHaveBeenCalledTimes(1);
    const [uidArg, configArg] = (AuthService.getBackendUser as jest.Mock).mock
      .calls[0];
    expect(uidArg).toBe('uid-1');
    expect(configArg).toEqual(
      expect.objectContaining({ _skipModerationInterceptor: true }),
    );
  });

  it('Test 7: currentIdTokenRef is cleared on logout — tokenProvider getter returns null after logout', async () => {
    await mountProvider();
    const getter = (setTokenProvider as jest.Mock).mock.calls[0][0];

    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });
    expect(getter()).toBe('id-token-1');

    await ReactTestRenderer.act(async () => {
      await capturedCtx!.logout();
      await flush();
    });
    expect(getter()).toBeNull();
  });

  it('Test 8: loadStorageData hydrates currentIdTokenRef from AsyncStorage-backed AuthService.getToken', async () => {
    (AuthService.getUserData as jest.Mock).mockResolvedValue({
      localId: 'uid-stored',
    });
    (AuthService.getToken as jest.Mock).mockResolvedValue('stored-token');

    await mountProvider();
    // Extra flush — loadStorageData awaits both getUserData and getBackendUser
    await ReactTestRenderer.act(async () => {
      await flush();
      await flush();
    });

    const getter = (setTokenProvider as jest.Mock).mock.calls[0][0];
    expect(getter()).toBe('stored-token');
  });

  // ---------- Plan 05-12 (UAT Test 8) — idToken refresh wiring ----------

  it('Test 9: registers setIdTokenRefreshListener on mount', async () => {
    await mountProvider();
    expect(setIdTokenRefreshListener).toHaveBeenCalledTimes(1);
    const listener = (setIdTokenRefreshListener as jest.Mock).mock.calls[0][0];
    expect(typeof listener).toBe('function');
  });

  it('Test 10: registers setLogoutTrigger on mount', async () => {
    await mountProvider();
    expect(setLogoutTrigger).toHaveBeenCalledTimes(1);
    const trigger = (setLogoutTrigger as jest.Mock).mock.calls[0][0];
    expect(typeof trigger).toBe('function');
  });

  it('Test 11: login persists via saveAuthSession with refreshToken + expiresIn (NOT saveToken)', async () => {
    await mountProvider();

    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });

    expect(AuthService.saveAuthSession).toHaveBeenCalledTimes(1);
    const [idTokenArg, refreshTokenArg, expiresInArg] = (AuthService.saveAuthSession as jest.Mock).mock.calls[0];
    expect(idTokenArg).toBe('id-token-1');
    expect(refreshTokenArg).toBe('refresh-token-1');
    expect(expiresInArg).toBe('3600');

    // Critical: legacy saveToken must NOT be called by login anymore (Plan 05-12 migrated).
    expect((AuthService as any).saveToken).toBeUndefined(); // method is not on the mock at all
  });

  it('Test 12: idTokenRefreshListener calls AuthService.refreshIdToken with the stored refreshToken on first invocation', async () => {
    await mountProvider();
    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });

    const listener = (setIdTokenRefreshListener as jest.Mock).mock.calls[0][0];
    (AuthService.refreshIdToken as jest.Mock).mockClear();

    let result: string | null = null;
    await ReactTestRenderer.act(async () => {
      result = await listener();
      await flush();
    });

    expect(AuthService.refreshIdToken).toHaveBeenCalledTimes(1);
    expect(AuthService.refreshIdToken).toHaveBeenCalledWith('refresh-token-1');
    expect(result).toBe('refreshed-id-token');

    // tokenProvider getter should now return the refreshed token
    const getter = (setTokenProvider as jest.Mock).mock.calls[0][0];
    expect(getter()).toBe('refreshed-id-token');
  });

  it('Test 13: idTokenRefreshListener single-flights — 2 concurrent invocations → exactly 1 refreshIdToken call', async () => {
    await mountProvider();
    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });

    const listener = (setIdTokenRefreshListener as jest.Mock).mock.calls[0][0];
    (AuthService.refreshIdToken as jest.Mock).mockClear();

    // Make refreshIdToken slow so both calls overlap.
    let resolveRefresh: (v: any) => void = () => {};
    (AuthService.refreshIdToken as jest.Mock).mockImplementationOnce(
      () => new Promise((res) => { resolveRefresh = res; }),
    );

    let p1: Promise<string | null> | null = null;
    let p2: Promise<string | null> | null = null;
    await ReactTestRenderer.act(async () => {
      p1 = listener();
      p2 = listener();
      await flush();
      resolveRefresh({
        idToken: 'refreshed-id-token',
        refreshToken: 'rotated',
        expiresIn: '3600',
      });
      await p1;
      await p2;
      await flush();
    });

    expect(AuthService.refreshIdToken).toHaveBeenCalledTimes(1);
  });

  it('Test 14: idTokenRefreshListener triggers logout on TOKEN_EXPIRED — returns null', async () => {
    await mountProvider();
    await ReactTestRenderer.act(async () => {
      await capturedCtx!.login('a@b.com', 'pw');
      await flush();
    });

    const listener = (setIdTokenRefreshListener as jest.Mock).mock.calls[0][0];
    (AuthService.refreshIdToken as jest.Mock).mockRejectedValueOnce({
      message: 'TOKEN_EXPIRED',
    });
    (AuthService.logout as jest.Mock).mockClear();

    let result: string | null = 'sentinel';
    await ReactTestRenderer.act(async () => {
      result = await listener();
      await flush();
    });

    // Listener returned null (signaling permanent refresh failure to the interceptor)
    expect(result).toBeNull();
    // logout flow fired
    expect(AuthService.logout).toHaveBeenCalledTimes(1);
    // Token + user state cleared
    const getter = (setTokenProvider as jest.Mock).mock.calls[0][0];
    expect(getter()).toBeNull();
    expect(capturedCtx!.user).toBeNull();
  });

  it('Test 15: loadStorageData hydrates refreshTokenRef + idTokenExpiresAtRef from AsyncStorage on cold start', async () => {
    (AuthService.getUserData as jest.Mock).mockResolvedValue({ localId: 'uid-stored' });
    (AuthService.getToken as jest.Mock).mockResolvedValue('stored-id-token');
    (AuthService.getRefreshToken as jest.Mock).mockResolvedValue('stored-refresh-token');
    const farFuture = Date.now() + 30 * 60 * 1000; // 30 min from now (well above 5-min threshold)
    (AuthService.getIdTokenExpiresAt as jest.Mock).mockResolvedValue(farFuture);

    await mountProvider();

    expect(AuthService.getRefreshToken).toHaveBeenCalledTimes(1);
    expect(AuthService.getIdTokenExpiresAt).toHaveBeenCalledTimes(1);

    // The listener now has access to the stored refresh token — invoke it
    // and confirm refreshIdToken receives the hydrated value.
    const listener = (setIdTokenRefreshListener as jest.Mock).mock.calls[0][0];
    (AuthService.refreshIdToken as jest.Mock).mockClear();
    await ReactTestRenderer.act(async () => {
      await listener();
      await flush();
    });
    expect(AuthService.refreshIdToken).toHaveBeenCalledWith('stored-refresh-token');
  });
});
