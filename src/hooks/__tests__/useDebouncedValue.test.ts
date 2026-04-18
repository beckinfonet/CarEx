import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { useDebouncedValue } from '../useDebouncedValue';

// Harness component — drives the hook with rerenderable props and exposes the debounced value via a testID
function Harness({ value, delay }: { value: string; delay?: number }) {
  const debounced = useDebouncedValue(value, delay);
  return <Text testID="debounced">{debounced}</Text>;
}

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test.todo('returns the initial value synchronously on first render');
  test.todo('returns the new value after the delay window elapses');
  test.todo('does NOT update the debounced value before the delay elapses');
  test.todo('coalesces rapid consecutive value changes into a single emission of the final value');
  test.todo('respects a custom delay argument (e.g. 100ms)');
  test.todo('clears the pending timer on unmount');
});
