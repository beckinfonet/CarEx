/**
 * Unit tests for src/utils/greetingVariants — no-back-to-back-repeat random picker
 * with per-slot memory. Drives the RED → GREEN of quick task 260528-hmt Task 2.
 *
 * Contract:
 *   - pickIndex(poolSize, lastIndex) is the pure math; rotateVariant binds the
 *     module-scope per-slot last-index registry on top of it.
 *   - Slots are independent: 'morning' / 'afternoon' / 'evening' / 'headline'.
 *   - __resetVariantRegistry() is the test-only escape hatch.
 */
import {
  pickIndex,
  rotateVariant,
  __resetVariantRegistry,
} from '../greetingVariants';

describe('pickIndex', () => {
  it('returns 0 for poolSize 0', () => {
    expect(pickIndex(0, null)).toBe(0);
    expect(pickIndex(0, 3)).toBe(0);
  });

  it('returns 0 for poolSize 1', () => {
    expect(pickIndex(1, null)).toBe(0);
    expect(pickIndex(1, 0)).toBe(0);
  });

  it('avoids lastIndex when poolSize >= 2 (2-element pool always flips)', () => {
    for (let i = 0; i < 200; i++) {
      expect(pickIndex(2, 0)).toBe(1);
      expect(pickIndex(2, 1)).toBe(0);
    }
  });

  it('with poolSize 5 and lastIndex 2 never returns 2 and covers >= 2 distinct values', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const r = pickIndex(5, 2);
      expect(r).not.toBe(2);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(5);
      seen.add(r);
    }
    expect(seen.has(2)).toBe(false);
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('with lastIndex null returns values in [0, poolSize)', () => {
    for (let i = 0; i < 100; i++) {
      const r = pickIndex(4, null);
      expect([0, 1, 2, 3]).toContain(r);
    }
  });
});

describe('rotateVariant', () => {
  beforeEach(() => {
    __resetVariantRegistry();
  });

  it('never repeats consecutively for the same slot (50 calls / 10-pool)', () => {
    const pool = [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
    ];
    const results: string[] = [];
    for (let i = 0; i < 50; i++) {
      results.push(rotateVariant('morning', pool));
    }
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).not.toBe(results[i - 1]);
    }
  });

  it('maintains independent registries per slot', () => {
    const pool = ['x', 'y'];
    const interleaved: { slot: 'morning' | 'headline'; value: string }[] = [];
    for (let i = 0; i < 20; i++) {
      const slot: 'morning' | 'headline' = i % 2 === 0 ? 'morning' : 'headline';
      interleaved.push({ slot, value: rotateVariant(slot, pool) });
    }
    const morningOnly = interleaved
      .filter((r) => r.slot === 'morning')
      .map((r) => r.value);
    const headlineOnly = interleaved
      .filter((r) => r.slot === 'headline')
      .map((r) => r.value);
    // Within each slot's subsequence: no back-to-back repeat.
    for (let i = 1; i < morningOnly.length; i++) {
      expect(morningOnly[i]).not.toBe(morningOnly[i - 1]);
    }
    for (let i = 1; i < headlineOnly.length; i++) {
      expect(headlineOnly[i]).not.toBe(headlineOnly[i - 1]);
    }
    // Cross-slot interleaving may repeat — sanity check we actually produced both values per slot.
    expect(new Set(morningOnly).size).toBe(2);
    expect(new Set(headlineOnly).size).toBe(2);
  });

  it('with single-element pool returns that element repeatedly without throwing', () => {
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(rotateVariant('afternoon', ['only']));
    }
    expect(results).toEqual(['only', 'only', 'only', 'only', 'only']);
  });

  it('with empty pool returns undefined and warns once', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = rotateVariant('evening', [] as string[]);
    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('__resetVariantRegistry clears state — after reset, both 0 and 1 are reachable on poolOf2', () => {
    __resetVariantRegistry();
    // Prime once so registry has a definite lastIndex (0 or 1).
    rotateVariant('morning', ['a', 'b']);
    // Reset clears the prime.
    __resetVariantRegistry();
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      __resetVariantRegistry(); // each iteration starts fresh — picker is free to choose either
      seen.add(rotateVariant('morning', ['a', 'b']));
    }
    // Over 30 independent free picks of a 2-element pool, both values should appear with
    // overwhelming probability (Math.random can't realistically return 30 identical halves).
    expect(seen.has('a')).toBe(true);
    expect(seen.has('b')).toBe(true);
  });
});
