/**
 * Phase 6 Plan 06-09 — QUAL-01 literal scanner
 *
 * Jest-based literal-string scan of the three new moderation components built
 * in Plans 06-03 / 06-04 / 06-05. Runs alongside the already-passing
 * translation-parity.test.ts (Plan 06-01) to close out QUAL-01:
 *
 *   - translation-parity.test.ts  → RU ≡ EN key sets (value-side parity)
 *   - moderation-literals.test.ts → no user-facing <Text>LITERAL</Text> children
 *                                   outside `t.*` (source-side parity)
 *
 * Implementation note: uses synchronous fs reads + a narrow regex, NOT an AST
 * parser. `@babel/parser` / `ts-morph` would give tighter guarantees but
 * require a new dev dependency (CLAUDE.md + phase scope forbids). The regex
 * captures <Text ...>LITERAL</Text> where LITERAL begins with a letter
 * (Latin or Cyrillic) and contains no `{` — so `<Text>{t.foo}</Text>`,
 * `<Text>{variable}</Text>`, and pure-punctuation/whitespace children are
 * naturally excluded. Multiline Text bodies are not scanned (rare in the
 * three target files — all current uses are single-line); if a multiline
 * literal slips through, the scanner under-reports. Acceptable at this audit
 * level; upgrade to AST in a future phase only if a real bypass appears.
 *
 * CarDetailsScreen is NOT scanned wholesale (too many legitimate pre-Phase-6
 * literals like "Visa", "Mastercard", "Telegram" brand names). The new
 * contact-gate region added by Plan 06-07 is self-audited: its only
 * user-facing Text comes from `<FeatureGateOverlay capability="contact_seller" />`
 * which IS scanned here — so Plan 06-07's new text is transitively covered.
 *
 * Fault-injection check (from Plan 06-09 §done): manually inserting a bad
 * literal like `<Text>Test bad literal</Text>` into any SCAN_FILES entry
 * MUST cause this test to fail with a diagnostic naming the offending line
 * and text. Run interactively during task completion; no acceptance grep
 * required.
 */

import fs from 'fs';
import path from 'path';

// Files scanned by QUAL-01 literal-string audit (Phase 6).
// A "user-facing literal" is a JSX Text child that is a string literal
// (not wrapped in {t.*} or {variable}).
const SCAN_FILES = [
  'src/components/moderation/UserStatusBanner.tsx',
  'src/components/moderation/FeatureGateOverlay.tsx',
  'src/components/moderation/GatedScreenWrapper.tsx',
  'src/components/moderation/ListingStatusBanner.tsx',  // Phase 11 LQUAL-01 (D-09): banner copy fully encapsulated; CarDetailsScreen.tsx + ServiceCartScreen.tsx deliberately NOT added per Pitfall 12.
];

// Tokens that are legitimate to appear as a <Text> child without translation.
// Keep this tight — expanding it without a written justification defeats the
// audit. Each entry MUST carry an inline comment explaining why it's exempt.
const ALLOWLIST = new Set<string>([
  // (none for now — all strings in the three new components are expected to
  // come from t.* via useLanguage(). If a legitimate brand name or format
  // constant must be added later, include a justification comment next to
  // the entry.)
]);

// Matches `<Text ...>LITERAL</Text>` where LITERAL starts with a letter
// (Latin or Cyrillic) and contains no `{` or `}` (so JSX-expression children
// are excluded). Deliberately anchored to Text tags only; View / Pressable
// children are not user-facing text.
const TEXT_LITERAL_REGEX = /<Text[^>]*>\s*([A-Za-zА-Яа-я][^<{}]*?)\s*<\/Text>/g;

function scanFile(absPath: string): Array<{ line: number; literal: string }> {
  const src = fs.readFileSync(absPath, 'utf8');
  const lines = src.split('\n');
  const offenders: Array<{ line: number; literal: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    TEXT_LITERAL_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TEXT_LITERAL_REGEX.exec(line)) !== null) {
      const literal = m[1].trim();
      if (literal.length === 0) continue;
      if (ALLOWLIST.has(literal)) continue;
      offenders.push({ line: i + 1, literal });
    }
  }
  return offenders;
}

describe('QUAL-01 / LQUAL-01: moderation components — no untranslated literals', () => {
  for (const relPath of SCAN_FILES) {
    test(`${relPath} contains no user-facing <Text> literals outside t.*`, () => {
      const absPath = path.resolve(__dirname, '..', relPath);
      expect(fs.existsSync(absPath)).toBe(true);
      const offenders = scanFile(absPath);
      if (offenders.length > 0) {
        const diag = offenders
          .map(o => `  line ${o.line}: "${o.literal}"`)
          .join('\n');
        throw new Error(
          `Found ${offenders.length} untranslated <Text> literal(s) in ${relPath}:\n${diag}\n` +
          `Wrap them in t.* via useLanguage(), or add to ALLOWLIST with justification.`,
        );
      }
      expect(offenders).toEqual([]);
    });
  }
});
