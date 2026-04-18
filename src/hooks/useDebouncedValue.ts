import { useEffect, useState } from 'react';

/**
 * Debounce hook — returns the latest `value`, but only after `delay` ms have
 * passed without a new value being supplied. Used by AdminModerationScreen to
 * coalesce rapid keystrokes into a single search request (UI-SPEC §Component 2,
 * D-10 — 300ms window).
 *
 * Cleanup: clears the pending timer on unmount AND on every value/delay change.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
