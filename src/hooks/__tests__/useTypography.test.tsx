import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { UIVersionProvider } from '../../context/UIVersionContext';
import { useTypography } from '../useTypography';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

let result: ReturnType<typeof useTypography>;
function Probe() { result = useTypography(); return null; }

async function flush() {
  await new Promise((r) => setImmediate(r));
  act(() => {});
}

describe('useTypography', () => {
  test('returns undefined font families when version is v1', async () => {
    await act(async () => {
      TestRenderer.create(<UIVersionProvider><Probe /></UIVersionProvider>);
    });
    await flush();
    expect(result.display).toBeUndefined();
    expect(result.mono).toBeUndefined();
    expect(result.weights.bold).toBe('700');
  });
});
