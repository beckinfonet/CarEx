/**
 * Phase 6 — Wave 0 scaffold (QUAL-01 translation parity)
 *
 * Unlike the three component scaffolds (which use test.todo because the
 * modules they target do not exist yet), this test has REAL assertions
 * because TRANSLATIONS already exists and must remain in RU/EN parity at
 * every wave boundary. It ships green from Wave 0 and provides a live
 * guard as Wave 1 adds keys in parallel RU/EN form.
 *
 * Contract (from UI-SPEC §QUAL-01 + RESEARCH §Pattern 6 + §Pitfall 8):
 *   - Use set-equality, NOT a hardcoded key count. Pre-Phase-6 baseline
 *     is 459 keys per language (NOT 455 as UI-SPEC claims); Phase 6 adds
 *     32 → 491. Using set-equality makes this test robust to any count.
 *   - Every value must be a non-empty string OR a non-empty array of
 *     non-empty strings. (Quick 260528-hmt introduced string[] pool values
 *     for the rotating greeting kicker + headline. Pool entries are
 *     themselves first-class user-facing strings; the parity invariant
 *     applies to each leaf string, not the array wrapper.)
 *   - No TODO/FIXME/TRANSLATE placeholder strings (at any leaf).
 */

import { TRANSLATIONS } from '../src/constants/translations';

// Flatten a single translation value into all the user-facing strings it
// carries. Strings yield themselves; arrays yield each element. Anything else
// is a contract violation surfaced by the type checks below.
function leafStrings(val: unknown): string[] {
  if (typeof val === 'string') return [val];
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === 'string');
  return [];
}

describe('QUAL-01: translation parity', () => {
  const ru = Object.keys((TRANSLATIONS as any).RU).sort();
  const en = Object.keys((TRANSLATIONS as any).EN).sort();

  test('RU and EN key sets are identical', () => {
    const onlyInRu = ru.filter((k) => !en.includes(k));
    const onlyInEn = en.filter((k) => !ru.includes(k));
    expect({ onlyInRu, onlyInEn }).toEqual({ onlyInRu: [], onlyInEn: [] });
  });

  test('every value is a non-empty string (or non-empty array of non-empty strings)', () => {
    for (const lang of ['RU', 'EN'] as const) {
      for (const [key, val] of Object.entries((TRANSLATIONS as any)[lang])) {
        if (Array.isArray(val)) {
          // Pool-shaped value (260528-hmt): must be non-empty + every element a non-empty string.
          expect(val.length).toBeGreaterThan(0);
          for (const entry of val) {
            expect(typeof entry).toBe('string');
            expect((entry as string).trim().length).toBeGreaterThan(0);
          }
        } else {
          expect(typeof val).toBe('string');
          expect((val as string).trim().length).toBeGreaterThan(0);
        }
        // Catch unexpected nested shapes — anything not handled by the two
        // branches above is a contract violation (e.g. plain object).
        expect(typeof val === 'string' || Array.isArray(val)).toBe(true);
        // Use `key` to keep noise out of the report on failure.
        void key;
      }
    }
  });

  test('no TODO/FIXME/TRANSLATE placeholder values', () => {
    const placeholder = /^(TODO|FIXME|TRANSLATE)[:\s]/i;
    for (const lang of ['RU', 'EN'] as const) {
      for (const [, val] of Object.entries((TRANSLATIONS as any)[lang])) {
        for (const leaf of leafStrings(val)) {
          expect(leaf).not.toMatch(placeholder);
        }
      }
    }
  });
});
