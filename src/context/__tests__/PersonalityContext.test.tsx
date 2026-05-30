import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersonalityProvider, usePersonality } from '../PersonalityContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
const mockedAsync = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

let hookResult: ReturnType<typeof usePersonality>;
function Probe() {
  hookResult = usePersonality();
  return null;
}

async function flush() {
  await new Promise((r) => setImmediate(r));
  act(() => {});
  await new Promise((r) => setImmediate(r));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PersonalityContext', () => {
  test('defaults to wholesome when AsyncStorage is empty', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    expect(hookResult.tier).toBe('wholesome');
  });

  test('defaults to wholesome when AsyncStorage holds an unknown value', async () => {
    mockedAsync.getItem.mockResolvedValue('chaotic-good');
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    expect(hookResult.tier).toBe('wholesome');
  });

  test('hydrates sarcastic from AsyncStorage on mount', async () => {
    mockedAsync.getItem.mockResolvedValue('sarcastic');
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    expect(hookResult.tier).toBe('sarcastic');
  });

  test('setTier persists to AsyncStorage and updates state', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    await act(async () => { hookResult.setTier('unhinged'); });
    await flush();
    expect(mockedAsync.setItem).toHaveBeenCalledWith('@carex.personality.tier.v1', 'unhinged');
    expect(hookResult.tier).toBe('unhinged');
  });

  test('cycleTier walks wholesome -> sarcastic, then gates unhinged until accepted', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();

    await act(async () => { hookResult.cycleTier(); });
    await flush();
    expect(hookResult.tier).toBe('sarcastic');

    // Second cycle would land on UNHINGED, which is consent-gated.
    // Tier must NOT advance and the call must report 'needs-consent'.
    await act(async () => { hookResult.cycleTier(); });
    await flush();
    expect(hookResult.tier).toBe('sarcastic');

    // After acceptance the same cycle call advances to UNHINGED and a further
    // cycle wraps back to WHOLESOME (unchanged baseline ordering).
    await act(async () => { hookResult.acceptUnhinged(); });
    await flush();

    await act(async () => { hookResult.cycleTier(); });
    await flush();
    expect(hookResult.tier).toBe('unhinged');

    await act(async () => { hookResult.cycleTier(); });
    await flush();
    expect(hookResult.tier).toBe('wholesome');
  });

  test('two rapid cycleTier calls in one act each advance one step', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    // Both calls happen synchronously inside a single act.
    // First call: wholesome → sarcastic ('switched').
    // Second call: sarcastic → unhinged is now consent-gated, so the call
    // returns 'needs-consent' without advancing — final tier stays 'sarcastic'.
    await act(async () => {
      hookResult.cycleTier();
      hookResult.cycleTier();
    });
    await flush();
    expect(hookResult.tier).toBe('sarcastic');
  });

  test('setTier retains in-memory value when AsyncStorage write rejects', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    mockedAsync.setItem.mockRejectedValueOnce(new Error('quota'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();
    await act(async () => { hookResult.setTier('sarcastic'); });
    await flush();
    expect(hookResult.tier).toBe('sarcastic');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  // ---- Quick 260530-bdq — first-time consent gate ----

  test('requestTier(unhinged) returns needs-consent when not yet accepted', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();

    let result: 'needs-consent' | 'switched' = 'switched';
    await act(async () => { result = hookResult.requestTier('unhinged'); });
    await flush();

    expect(result).toBe('needs-consent');
    expect(hookResult.tier).toBe('wholesome');
  });

  test('after acceptUnhinged, requestTier(unhinged) switches the tier', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();

    await act(async () => { hookResult.acceptUnhinged(); });
    await flush();

    let result: 'needs-consent' | 'switched' = 'needs-consent';
    await act(async () => { result = hookResult.requestTier('unhinged'); });
    await flush();

    expect(result).toBe('switched');
    expect(hookResult.tier).toBe('unhinged');
  });

  test('acceptUnhinged persists the accepted flag to AsyncStorage', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();

    await act(async () => { hookResult.acceptUnhinged(); });
    await flush();

    expect(mockedAsync.setItem).toHaveBeenCalledWith(
      '@carex.personality.unhinged.accepted.v1',
      'true',
    );
  });

  test('hydrating with accepted=true bypasses the gate on first requestTier', async () => {
    mockedAsync.getItem.mockImplementation((key: string) =>
      Promise.resolve(key === '@carex.personality.unhinged.accepted.v1' ? 'true' : null),
    );
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();

    // Default tier remains wholesome because the tier key still returns null.
    expect(hookResult.tier).toBe('wholesome');

    let result: 'needs-consent' | 'switched' = 'needs-consent';
    await act(async () => { result = hookResult.requestTier('unhinged'); });
    await flush();

    expect(result).toBe('switched');
    expect(hookResult.tier).toBe('unhinged');
  });

  test('cycleTier returns switched then needs-consent on the unhinged step', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();

    let first: 'needs-consent' | 'switched' = 'needs-consent';
    await act(async () => { first = hookResult.cycleTier(); });
    await flush();
    expect(first).toBe('switched');
    expect(hookResult.tier).toBe('sarcastic');

    let second: 'needs-consent' | 'switched' = 'switched';
    await act(async () => { second = hookResult.cycleTier(); });
    await flush();
    expect(second).toBe('needs-consent');
    expect(hookResult.tier).toBe('sarcastic');
  });

  test('requestTier(wholesome|sarcastic) is never gated regardless of acceptance', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();

    let s: 'needs-consent' | 'switched' = 'needs-consent';
    await act(async () => { s = hookResult.requestTier('sarcastic'); });
    await flush();
    expect(s).toBe('switched');
    expect(hookResult.tier).toBe('sarcastic');

    let w: 'needs-consent' | 'switched' = 'needs-consent';
    await act(async () => { w = hookResult.requestTier('wholesome'); });
    await flush();
    expect(w).toBe('switched');
    expect(hookResult.tier).toBe('wholesome');
  });
});
