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
});
