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

// The four greeting-pool keys were migrated in Task 3 from `string[]` to
// `{ wholesome: string[]; sarcastic: string[]; unhinged: string[] }`.
// This constant names them so the value checks below can apply tier-aware
// logic without hard-coding which tier names exist.
const TIER_NESTED_KEYS = new Set([
  'greetingVariantsMorning',
  'greetingVariantsAfternoon',
  'greetingVariantsEvening',
  'headlineVariants',
]);

// Flatten a single translation value into all the user-facing strings it
// carries. Strings yield themselves; arrays yield each element; tier-nested
// objects recurse into each tier's array. Anything else is a contract
// violation surfaced by the type checks below.
function leafStrings(val: unknown): string[] {
  if (typeof val === 'string') return [val];
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === 'string');
  if (val !== null && typeof val === 'object') {
    // tier-nested object: flatten all tier arrays
    return Object.values(val as Record<string, unknown>).flatMap(leafStrings);
  }
  return [];
}

// describe ID covers both the original Phase 6 QUAL-01 substrate and the Phase 11 LQUAL-01 extension; coverage manifest (Plan 11-07) reads both.
describe('QUAL-01 / LQUAL-01: translation parity', () => {
  const ru = Object.keys((TRANSLATIONS as any).RU).sort();
  const en = Object.keys((TRANSLATIONS as any).EN).sort();

  test('RU and EN key sets are identical', () => {
    const onlyInRu = ru.filter((k) => !en.includes(k));
    const onlyInEn = en.filter((k) => !ru.includes(k));
    expect({ onlyInRu, onlyInEn }).toEqual({ onlyInRu: [], onlyInEn: [] });
  });

  test('every value is a non-empty string (or non-empty array of non-empty strings, or tier-nested pool object)', () => {
    for (const lang of ['RU', 'EN'] as const) {
      for (const [key, val] of Object.entries((TRANSLATIONS as any)[lang])) {
        if (TIER_NESTED_KEYS.has(key)) {
          // Tier-nested pool (Task 3 migration): must be a plain object whose
          // values are each a non-empty array of non-empty strings.
          expect(typeof val).toBe('object');
          expect(val).not.toBeNull();
          expect(Array.isArray(val)).toBe(false);
          for (const [tier, pool] of Object.entries(val as Record<string, unknown>)) {
            expect(Array.isArray(pool)).toBe(true);
            expect((pool as unknown[]).length).toBeGreaterThan(0);
            for (const entry of pool as unknown[]) {
              expect(typeof entry).toBe('string');
              expect((entry as string).trim().length).toBeGreaterThan(0);
            }
            void tier;
          }
        } else if (Array.isArray(val)) {
          // Flat pool-shaped value (260528-hmt): must be non-empty + every element a non-empty string.
          expect(val.length).toBeGreaterThan(0);
          for (const entry of val) {
            expect(typeof entry).toBe('string');
            expect((entry as string).trim().length).toBeGreaterThan(0);
          }
        } else {
          expect(typeof val).toBe('string');
          expect((val as string).trim().length).toBeGreaterThan(0);
        }
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

  test('LQUAL-01: placeholder tokens are identical across RU and EN for every key', () => {
    // D-09 (c): if RU has `{title}` for a key, EN must have `{title}` for the same key.
    // Per Pitfall 7: same-set semantics PASS; differing-set FAILS as a real bug.
    const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
    function extract(value: unknown): Set<string> {
      const set = new Set<string>();
      const visit = (v: unknown) => {
        if (typeof v === 'string') {
          let m;
          PLACEHOLDER.lastIndex = 0;
          while ((m = PLACEHOLDER.exec(v)) !== null) set.add(m[1]);
        } else if (Array.isArray(v)) v.forEach(visit);
      };
      visit(value);
      return set;
    }
    const ruObj = (TRANSLATIONS as any).RU;
    const enObj = (TRANSLATIONS as any).EN;
    const mismatches: Array<{ key: string; ru: string[]; en: string[] }> = [];
    for (const key of Object.keys(ruObj)) {
      const ruTokens = extract(ruObj[key]);
      const enTokens = extract(enObj[key]);
      if (
        ruTokens.size !== enTokens.size ||
        [...ruTokens].some((tok) => !enTokens.has(tok))
      ) {
        mismatches.push({
          key,
          ru: [...ruTokens].sort(),
          en: [...enTokens].sort(),
        });
      }
    }
    expect(mismatches).toEqual([]);
  });
});
