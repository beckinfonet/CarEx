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
 *   - Every value must be a non-empty string.
 *   - No TODO/FIXME/TRANSLATE placeholder strings.
 */

import { TRANSLATIONS } from '../src/constants/translations';

describe('QUAL-01: translation parity', () => {
  const ru = Object.keys((TRANSLATIONS as any).RU).sort();
  const en = Object.keys((TRANSLATIONS as any).EN).sort();

  test('RU and EN key sets are identical', () => {
    const onlyInRu = ru.filter((k) => !en.includes(k));
    const onlyInEn = en.filter((k) => !ru.includes(k));
    expect({ onlyInRu, onlyInEn }).toEqual({ onlyInRu: [], onlyInEn: [] });
  });

  test('every value is a non-empty string', () => {
    for (const lang of ['RU', 'EN'] as const) {
      for (const [, val] of Object.entries((TRANSLATIONS as any)[lang])) {
        expect(typeof val).toBe('string');
        expect((val as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('no TODO/FIXME/TRANSLATE placeholder values', () => {
    for (const lang of ['RU', 'EN'] as const) {
      for (const [, val] of Object.entries((TRANSLATIONS as any)[lang])) {
        expect(val).not.toMatch(/^(TODO|FIXME|TRANSLATE)[:\s]/i);
      }
    }
  });
});
