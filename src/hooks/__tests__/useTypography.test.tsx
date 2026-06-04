import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
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
  test('returns the V2 font families unconditionally', async () => {
    await act(async () => {
      TestRenderer.create(<Probe />);
    });
    await flush();
    expect(result.display).toBe('Manrope');
    expect(result.mono).toBe('JetBrainsMono-Medium');
    expect(result.weights.bold).toBe('700');
  });
});
