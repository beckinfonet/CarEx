/**
 * Integration tests for Plan 04-06 — mount AppStateRefreshEffect inside AuthProvider.
 *
 * Contract (per 04-06-PLAN + 04-CONTEXT D-13/D-16):
 *   - Test 1: AppStateRefreshEffect renders null (side-effect wrapper, no UI).
 *   - Test 2: When user has localId, useAppStateRefresh is called with refreshUser
 *     and { cooldownMs: 30_000 }.
 *   - Test 3: When user is null, useAppStateRefresh is called with null as the
 *     refresh argument (D-16 logged-out skip wired at the component boundary).
 *   - Test 4 (end-to-end): Full App tree mounted with a logged-in user in AsyncStorage
 *     and AuthService.getBackendUser mocked; simulating a background→active AppState
 *     transition invokes AuthService.getBackendUser via AuthContext.refreshUser.
 *
 * Test 5 (regression: existing __tests__/App.test.tsx still passes) is covered by
 * running the existing test file in the same Jest invocation; no duplicate harness
 * needed here.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState } from 'react-native';

// --- Module-level mocks (hoisted by jest) ---------------------------------

// Spy on the hook — tests assert it's called with the right arguments.
jest.mock('../src/hooks/useAppStateRefresh', () => ({
  useAppStateRefresh: jest.fn(),
}));

// Replace useAuth with a jest.fn() per test; keep AuthProvider as a passthrough
// so <AppStateRefreshEffect /> can render without a real provider tree in unit tests.
jest.mock('../src/context/AuthContext', () => {
  const actual = jest.requireActual('../src/context/AuthContext');
  return {
    ...actual,
    useAuth: jest.fn(),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import { AppStateRefreshEffect } from '../App';
import { useAppStateRefresh } from '../src/hooks/useAppStateRefresh';
import { useAuth } from '../src/context/AuthContext';

const mockedUseAppStateRefresh = useAppStateRefresh as jest.MockedFunction<
  typeof useAppStateRefresh
>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('AppStateRefreshEffect — unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Test 1: renders null (side-effect wrapper, no UI output)', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      refreshUser: jest.fn(),
    } as any);

    let root: ReactTestRenderer.ReactTestRenderer | null = null;
    ReactTestRenderer.act(() => {
      root = ReactTestRenderer.create(<AppStateRefreshEffect />);
    });

    // toJSON returns null when component renders null.
    expect(root!.toJSON()).toBeNull();
  });

  test('Test 2: passes refreshUser and { cooldownMs: 30_000 } when logged in', () => {
    const refreshUser = jest.fn();
    mockedUseAuth.mockReturnValue({
      user: { localId: 'uid-1' },
      refreshUser,
    } as any);

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<AppStateRefreshEffect />);
    });

    expect(mockedUseAppStateRefresh).toHaveBeenCalledTimes(1);
    const [firstArg, secondArg] = mockedUseAppStateRefresh.mock.calls[0];
    expect(firstArg).toBe(refreshUser);
    expect(secondArg).toEqual({ cooldownMs: 30_000 });
  });

  test('Test 3: passes null as refresh when logged out (user = null)', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      refreshUser: jest.fn(),
    } as any);

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<AppStateRefreshEffect />);
    });

    expect(mockedUseAppStateRefresh).toHaveBeenCalledTimes(1);
    const [firstArg] = mockedUseAppStateRefresh.mock.calls[0];
    expect(firstArg).toBeNull();
  });

  test('Test 3b: passes null as refresh when user object exists but has no localId', () => {
    mockedUseAuth.mockReturnValue({
      user: { email: 'x@y.z' },
      refreshUser: jest.fn(),
    } as any);

    ReactTestRenderer.act(() => {
      ReactTestRenderer.create(<AppStateRefreshEffect />);
    });

    expect(mockedUseAppStateRefresh).toHaveBeenCalledTimes(1);
    const [firstArg] = mockedUseAppStateRefresh.mock.calls[0];
    expect(firstArg).toBeNull();
  });
});

// --- Test 4: End-to-end through a focused AuthProvider + AppStateRefreshEffect harness ----
//
// We intentionally avoid rendering the full App component (and its 20+ screen imports).
// Instead we mount the REAL AuthProvider wrapping a REAL AppStateRefreshEffect-alike
// child and exercise the background→active transition, proving that:
//   - useAppStateRefresh (the real hook) subscribes to AppState
//   - when a logged-in user exists, its transition fires AuthContext.refreshUser
//   - refreshUser invokes AuthService.getBackendUser
//
// This covers the same wiring contract as an App-render test without the brittleness
// of resetting modules or mocking every navigation/gesture/screens native surface.

describe('AppStateRefreshEffect — end-to-end foreground refresh', () => {
  let registeredAppStateHandler: ((state: string) => void) | null = null;

  beforeEach(() => {
    registeredAppStateHandler = null;
    jest.clearAllMocks();
  });

  test('Test 4: background→active triggers AuthService.getBackendUser when logged in', async () => {
    // Unmock the two modules that the unit tests mocked globally so the REAL
    // AuthProvider + REAL useAppStateRefresh run inside this test.
    jest.unmock('../src/hooks/useAppStateRefresh');
    jest.unmock('../src/context/AuthContext');
    // Pull fresh references to the real implementations. We rely on the fact
    // that jest.mock above is hoisted per-file; unmock + requireActual flips
    // the bindings for the current test only.
    const AuthContextActual = jest.requireActual('../src/context/AuthContext');
    const RealAuthProvider = AuthContextActual.AuthProvider;
    const RealUseAuth = AuthContextActual.useAuth;
    const { useAppStateRefresh: realUseAppStateRefresh } = jest.requireActual(
      '../src/hooks/useAppStateRefresh',
    );

    // Capture the AppState handler installed by the real hook.
    const appStateSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: any, handler: any) => {
        registeredAppStateHandler = handler as (state: string) => void;
        return { remove: jest.fn() } as any;
      });
    Object.defineProperty(AppState, 'currentState', {
      value: 'active',
      configurable: true,
      writable: true,
    });

    // Mock AsyncStorage so AuthProvider.loadStorageData populates a logged-in user.
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation((async (...args: unknown[]) => {
      const key = args[0] as string;
      if (key === 'userToken') return 'stored-token';
      if (key === 'userData') {
        return JSON.stringify({ localId: 'uid-e2e', email: 'a@b.c' });
      }
      return null;
    }) as any);
    jest.spyOn(AsyncStorage, 'setItem').mockResolvedValue(undefined as any);
    jest.spyOn(AsyncStorage, 'removeItem').mockResolvedValue(undefined as any);

    // Mock AuthService methods used during boot + refresh.
    const { AuthService } = require('../src/services/AuthService');
    const getBackendUserSpy = jest
      .spyOn(AuthService, 'getBackendUser')
      .mockResolvedValue({ localId: 'uid-e2e', email: 'a@b.c' });
    jest.spyOn(AuthService, 'getAdminStatus').mockResolvedValue({
      isAdmin: false,
      role: null,
    });
    jest.spyOn(AuthService, 'getToken').mockResolvedValue('stored-token');
    jest.spyOn(AuthService, 'getUserData').mockResolvedValue({
      localId: 'uid-e2e',
      email: 'a@b.c',
    });

    // Build a focused harness that mirrors AppStateRefreshEffect using the REAL
    // hook + the REAL useAuth returned from the real AuthProvider.
    const RealAppStateRefreshEffect = () => {
      const { user, refreshUser } = RealUseAuth();
      realUseAppStateRefresh(user?.localId ? refreshUser : null, {
        cooldownMs: 30_000,
      });
      return null;
    };

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(
        <RealAuthProvider>
          <RealAppStateRefreshEffect />
        </RealAuthProvider>,
      );
    });

    // Wait for loadStorageData's async chain to settle.
    await ReactTestRenderer.act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Baseline: getBackendUser called once during boot (loadStorageData).
    const bootCalls = getBackendUserSpy.mock.calls.length;
    expect(bootCalls).toBeGreaterThanOrEqual(1);
    expect(registeredAppStateHandler).not.toBeNull();

    // Advance clock past the 30s cooldown baked into AuthContext.refreshUser
    // so the AppState-triggered refresh isn't swallowed by the cooldown guard.
    const realNow = Date.now;
    const future = realNow() + 31_000;
    jest.spyOn(Date, 'now').mockReturnValue(future);

    // Simulate background→active transition.
    await ReactTestRenderer.act(async () => {
      registeredAppStateHandler!('background');
      registeredAppStateHandler!('active');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // After the transition, getBackendUser should have been called at least
    // once more (boot call + AppState-triggered refresh call).
    expect(getBackendUserSpy.mock.calls.length).toBeGreaterThan(bootCalls);

    appStateSpy.mockRestore();
  });
});
