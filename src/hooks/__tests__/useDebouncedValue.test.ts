import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { useDebouncedValue } from '../useDebouncedValue';

// Harness component — drives the hook with rerenderable props and exposes the
// debounced value via children so tests can read it synchronously.
// NOTE: this file uses React.createElement (not JSX) because it is named .ts
// (not .tsx); the react-native jest preset does not enable JSX transforms for
// plain .ts files.
function Harness({ value, delay }: { value: string; delay?: number }) {
  const debounced = useDebouncedValue(value, delay);
  return React.createElement(Text, { testID: 'debounced' }, debounced);
}

const h = (value: string, delay?: number) =>
  React.createElement(Harness, { value, delay });

const readDebounced = (root: TestRenderer.ReactTestRenderer): string => {
  const node = root.root.findByProps({ testID: 'debounced' });
  const child = node.props.children;
  return Array.isArray(child) ? child.join('') : String(child);
};

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns the initial value synchronously on first render', () => {
    let root: TestRenderer.ReactTestRenderer;
    act(() => {
      root = TestRenderer.create(h('hello'));
    });
    expect(readDebounced(root!)).toBe('hello');
  });

  test('returns the new value after the delay window elapses', () => {
    let root: TestRenderer.ReactTestRenderer;
    act(() => {
      root = TestRenderer.create(h('a'));
    });
    act(() => {
      root!.update(h('b'));
    });
    // Before delay elapsed, still 'a'
    expect(readDebounced(root!)).toBe('a');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(readDebounced(root!)).toBe('b');
  });

  test('coalesces rapid consecutive value changes into a single emission of the final value', () => {
    let root: TestRenderer.ReactTestRenderer;
    act(() => {
      root = TestRenderer.create(h('a'));
    });
    act(() => {
      root!.update(h('b'));
    });
    act(() => {
      root!.update(h('c'));
    });
    act(() => {
      root!.update(h('d'));
    });
    // Intermediate updates did not commit any debounced change yet
    expect(readDebounced(root!)).toBe('a');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    // Final value lands after the single coalesced window
    expect(readDebounced(root!)).toBe('d');
  });

  test('respects a custom delay argument', () => {
    let root: TestRenderer.ReactTestRenderer;
    act(() => {
      root = TestRenderer.create(h('a', 100));
    });
    act(() => {
      root!.update(h('b', 100));
    });
    // Before 100ms elapsed, still 'a'
    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(readDebounced(root!)).toBe('a');
    // After 100ms total elapsed, 'b' lands
    act(() => {
      jest.advanceTimersByTime(60);
    });
    expect(readDebounced(root!)).toBe('b');
  });
});
