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

  test('cycleTier walks wholesome -> sarcastic -> unhinged -> wholesome', async () => {
    mockedAsync.getItem.mockResolvedValue(null);
    await act(async () => {
      TestRenderer.create(<PersonalityProvider><Probe /></PersonalityProvider>);
    });
    await flush();

    await act(async () => { hookResult.cycleTier(); });
    await flush();
    expect(hookResult.tier).toBe('sarcastic');

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
    // Both calls happen synchronously inside a single act — tests the functional updater.
    await act(async () => {
      hookResult.cycleTier();
      hookResult.cycleTier();
    });
    await flush();
    // wholesome → sarcastic → unhinged
    expect(hookResult.tier).toBe('unhinged');
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
});
