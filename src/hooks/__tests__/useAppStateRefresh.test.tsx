/**
 * Tests for useAppStateRefresh — Plan 04-03.
 *
 * Hook contract (per 04-03-PLAN behavior + 04-CONTEXT D-13/D-14/D-16):
 * - On background→active (or inactive→active) AppState transition, fires the caller-provided
 *   refresh callback exactly once.
 * - On active→background / active→inactive transitions, does NOT fire.
 * - When refresh is null/undefined, the hook is a no-op (D-16 logged-out skip).
 * - AppState subscription is torn down on unmount (subscription.remove() invoked).
 * - Refresh rejections are caught and logged — never leak as unhandled promise rejections.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState } from 'react-native';
import { useAppStateRefresh } from '../useAppStateRefresh';

type AnyHandler = (state: string) => void;

function HookHarness({ refresh }: { refresh: any }) {
  useAppStateRefresh(refresh);
  return null;
}

describe('useAppStateRefresh', () => {
  let registeredHandler: AnyHandler | null = null;
  let subscriptionRemoveSpy: jest.Mock;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    subscriptionRemoveSpy = jest.fn();
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: any, handler: any) => {
        registeredHandler = handler as AnyHandler;
        return { remove: subscriptionRemoveSpy } as any;
      });
    // Reset currentState; some platforms type it differently so we use defineProperty.
    Object.defineProperty(AppState, 'currentState', {
      value: 'active',
      configurable: true,
      writable: true,
    });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    registeredHandler = null;
  });

  test('Test 1: background→active fires refresh once', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness refresh={refresh} />);
    });

    await ReactTestRenderer.act(async () => {
      registeredHandler!('background');
      registeredHandler!('active');
    });

    // Flush microtasks for the .catch attached inside the hook
    await Promise.resolve();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('Test 2: inactive→active fires refresh once', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness refresh={refresh} />);
    });

    await ReactTestRenderer.act(async () => {
      registeredHandler!('inactive');
      registeredHandler!('active');
    });

    await Promise.resolve();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('Test 3: active→background does NOT fire refresh', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness refresh={refresh} />);
    });

    await ReactTestRenderer.act(async () => {
      registeredHandler!('active');
      registeredHandler!('background');
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  test('Test 4: active→inactive does NOT fire refresh', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness refresh={refresh} />);
    });

    await ReactTestRenderer.act(async () => {
      registeredHandler!('active');
      registeredHandler!('inactive');
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  test('Test 5: null refresh is a no-op', async () => {
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness refresh={null} />);
    });

    // Must not crash or throw when transitioning.
    await ReactTestRenderer.act(async () => {
      registeredHandler!('background');
      registeredHandler!('active');
    });

    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test 6: undefined refresh is a no-op', async () => {
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness refresh={undefined} />);
    });

    await ReactTestRenderer.act(async () => {
      registeredHandler!('background');
      registeredHandler!('active');
    });

    await Promise.resolve();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Test 7: subscription cleanup on unmount', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);

    let root: ReactTestRenderer.ReactTestRenderer | null = null;
    await ReactTestRenderer.act(async () => {
      root = ReactTestRenderer.create(<HookHarness refresh={refresh} />);
    });

    expect(subscriptionRemoveSpy).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      root!.unmount();
    });

    expect(subscriptionRemoveSpy).toHaveBeenCalledTimes(1);
  });

  test('Test 8: refresh rejection is caught and logged (no unhandled rejection)', async () => {
    const boom = new Error('boom');
    const refresh = jest.fn().mockRejectedValue(boom);

    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<HookHarness refresh={refresh} />);
    });

    await ReactTestRenderer.act(async () => {
      registeredHandler!('background');
      registeredHandler!('active');
    });

    // Flush microtasks so the rejected promise's .catch runs.
    await Promise.resolve();
    await Promise.resolve();

    expect(refresh).toHaveBeenCalledTimes(1);
    // Hook should have logged via console.error (not the raw unhandled rejection).
    expect(consoleErrorSpy).toHaveBeenCalled();
    // And the Error payload should be present in the logged args somewhere.
    const loggedWithBoom = consoleErrorSpy.mock.calls.some((args: any[]) =>
      args.some((arg) => arg === boom || (arg && arg.message === 'boom')),
    );
    expect(loggedWithBoom).toBe(true);
  });
});
