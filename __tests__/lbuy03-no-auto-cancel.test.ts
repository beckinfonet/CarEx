/**
 * Phase 11 Plan 11-05 — LBUY-03 source-grep audit
 *
 * LBUY-03 is a NEGATIVE requirement: already-paid orders proceed normally when
 * the underlying listing transitions to a non-active state (suspended /
 * archived / deleted). No auto-cancel or auto-refund logic may be introduced
 * on MyOrdersScreen or ProviderOrdersScreen — admin retains manual cancel via
 * the existing moderation tooling. See CONTEXT D-08 + REQUIREMENTS LBUY-03 +
 * RESEARCH §Architectural Responsibility Map (verification-only tier).
 *
 * This audit is intentionally lightweight (no AST parse, no behavioral test
 * harness) — it mirrors the existing __tests__/moderation-literals.test.ts
 * pattern of fs.readFileSync + regex line scan. The test fails when a
 * cancel/refund verb call shape collocates with a listing-status discriminant
 * either on the same line (single-line if) OR within a two-line sliding
 * window (multi-line if-blocks like
 *   `if (fetchedCar.status === 'suspended') {\n  ...\n  cancelOrder(...);\n}`).
 *
 * Comments are skipped so the file header / doc strings can mention these
 * concepts without false-positives. LISTING_STATUS_REGEX is intentionally
 * narrow (only listing_/listing. variants, listing_not_available, carStatus,
 * fetchedCar.status) so legitimate user-triggered admin manual-cancel handlers
 * — which operate on order state, not listing state — remain unflagged.
 *
 * Negative-control sanity (manual operator step — NOT enforced by CI):
 * temporarily insert
 *   if (fetchedCar.status === 'deleted') cancelOrder();
 * into a copy of MyOrdersScreen.tsx and confirm this suite FAILS, then revert.
 */

import fs from 'fs';
import path from 'path';

// LBUY-03: MyOrdersScreen and ProviderOrdersScreen must NOT add auto-cancel
// or auto-refund logic keyed on a listing's status. Already-paid orders
// proceed normally; admin retains manual cancel via existing tools.
// See CONTEXT D-08, REQUIREMENTS LBUY-03.
const SCAN_FILES = [
  'src/screens/MyOrdersScreen.tsx',
  'src/screens/ProviderOrdersScreen.tsx',
];

// Match function-call shapes for cancel/refund/abort/void verbs.
// Word boundary + opening paren catches `cancel(`, `cancelOrder(`,
// `.refund(`, `abortBooking(`, `void(` — but ignores property reads like
// `order.cancelled` or string literals containing "cancel".
const AUTO_ACTION_REGEX = /\b(cancel|refund|abort|void)\w*\s*\(/i;

// Match listing-status discriminants. Deliberately narrow — only listing-
// status variable names, member-access shapes, and known status sentinels
// associated with the listing-moderation outcome. Manual order-cancel
// handlers operating on order state (e.g. order.status, orderState) are
// intentionally NOT matched here, per the LBUY-03 verification-only contract.
const LISTING_STATUS_REGEX =
  /\blisting[_.]?(status|moderation|suspended|archived|deleted)|listing_not_available|carStatus|fetchedCar\?\.status|fetchedCar\.status/i;

describe('LBUY-03: order screens contain no auto-cancel logic keyed on listing status', () => {
  for (const relPath of SCAN_FILES) {
    test(`${relPath} has zero auto-cancel branches gated by listing-status discriminants`, () => {
      const absPath = path.resolve(__dirname, '..', relPath);
      expect(fs.existsSync(absPath)).toBe(true);

      const src = fs.readFileSync(absPath, 'utf8');
      const lines = src.split('\n');
      const offenders: Array<{ line: number; snippet: string }> = [];

      // Single-line check: AUTO_ACTION and LISTING_STATUS on the SAME line.
      // Skip pure-comment lines so file header / inline rationale can mention
      // these concepts safely.
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const stripped = line.trim();
        if (stripped.startsWith('//') || stripped.startsWith('*')) continue;
        if (AUTO_ACTION_REGEX.test(line) && LISTING_STATUS_REGEX.test(line)) {
          offenders.push({ line: i + 1, snippet: line.trim() });
        }
      }

      // Sliding-window check: AUTO_ACTION on line N, LISTING_STATUS on either
      // of the two preceding lines. Catches multi-line if-blocks like
      //   if (fetchedCar.status === 'suspended') {
      //     showBanner();
      //     cancelOrder(orderId);
      //   }
      // which the single-line check would miss.
      for (let i = 2; i < lines.length; i++) {
        const candidate = lines[i];
        if (candidate.trim().startsWith('//')) continue;
        const prevTwo = `${lines[i - 2]} ${lines[i - 1]}`;
        if (
          AUTO_ACTION_REGEX.test(candidate) &&
          LISTING_STATUS_REGEX.test(prevTwo)
        ) {
          const already = offenders.some((o) => o.line === i + 1);
          if (!already) {
            offenders.push({ line: i + 1, snippet: candidate.trim() });
          }
        }
      }

      if (offenders.length > 0) {
        const diag = offenders
          .map((o) => `  line ${o.line}: ${o.snippet}`)
          .join('\n');
        throw new Error(
          `LBUY-03 violation in ${relPath} — ${offenders.length} auto-cancel ` +
            `branch(es) appear to be gated by listing-status:\n${diag}\n` +
            `Already-paid orders MUST proceed normally when a listing becomes ` +
            `non-active. Admin manual cancel via the existing moderation tools ` +
            `is the only sanctioned path. See REQUIREMENTS LBUY-03, CONTEXT D-08.`,
        );
      }
      expect(offenders).toEqual([]);
    });
  }
});
