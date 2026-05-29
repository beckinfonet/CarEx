---
phase: 11-buyer-affected-ux-quality-security-review
reviewed: 2026-05-29T00:00:00Z
date: 2026-05-29
depth: standard
files_reviewed: 14
files_reviewed_list:
  - __tests__/_fixtures/listingStatusFixtures.ts
  - src/constants/translations.ts
  - src/components/moderation/ListingStatusBanner.tsx
  - src/components/moderation/__tests__/ListingStatusBanner.test.tsx
  - src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx
  - src/screens/CarDetailsScreen.tsx
  - src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx
  - src/screens/ServiceCartScreen.tsx
  - __tests__/lbuy03-no-auto-cancel.test.ts
  - __tests__/translation-parity.test.ts
  - __tests__/moderation-literals.test.ts
  - scripts/generate-coverage-manifest.sh
  - __tests__/coverage-manifest.audit.test.ts
  - __tests__/list-security-review.audit.test.ts
findings:
  critical: 0
  blocker: 0
  warning: 6
  info: 5
  total: 11
status: findings
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-29
**Depth:** standard
**Files Reviewed:** 14
**Status:** findings

## Summary

Phase 11 ships the buyer-affected UX layer (LBUY-01..04), the no-auto-cancel
audit (LBUY-03), the i18n/literal scanners (LQUAL-01), the per-requirement
coverage-manifest generator (LQUAL-02), and the security-review audit
(LQUAL-03). The implementation is broadly sound: providers/context wiring is
untouched, the HTTP interceptor count is unchanged (no new global axios
instances), RU/EN parity is enforced for the new keys, and CartContext is NOT
auto-cleared (LBUY-02 invariant preserved). The CTA-gating predicates are
applied consistently to all four buyer CTAs on `CarDetailsScreen`, and the
banner-state-vs-Alert race for the 409 path was correctly resolved by
returning *before* falling through to `Alert.alert(paymentFailed)`.

That said, the review surfaced several real issues:

1. A genuine **dead-code defect**: every banner `bannerHints` object carries a
   `bodyKey` field that is declared on the component prop type, the screen-level
   state type, and the translations table (`listingStatusBanner*Body` keys exist
   for both RU and EN) — but the banner never renders body copy. The keys are
   orphaned. Either the body must be rendered or the field + 6 translation
   entries removed.
2. A **state-leak risk** on `CarDetailsScreen`: when `fetchedCar` is null but
   `route.params.carData` is set, the LBUY-01 banner-mount predicate never
   fires even if the route-prefilled car is non-active. The CTA-gating
   predicate has the same blind spot.
3. The audit-test regex narrowness in `lbuy03-no-auto-cancel.test.ts` will
   miss multi-line `if`-blocks whose discriminant sits >2 lines before the
   cancel call (e.g. an early-return guard at top of a 5-line block). This
   is documented in the file header but worth re-stating as a finding.
4. **Shell-script portability**: the generator's worktree-detection cases
   `*/.git` and `*/.git/*` rely on the case statement evaluating against a
   literal path, and the script falls back silently when `realpath
   --relative-to` is missing on macOS — producing absolute paths in the
   manifest that change between machines and would cause the
   coverage-manifest audit test's snapshot comparison to fail across hosts.
5. **`car.id` is interpolated unencoded** into the apiClient URL path in two
   places. The backend is Mongo and IDs are server-controlled, so this is
   low-risk, but it's a hardening miss flagged here for completeness.

Below: 6 warnings, 5 info-level findings. No blockers or criticals.

## Warnings

### WR-01: `bodyKey` is wired through the entire banner pipeline but never rendered

**File:** `src/components/moderation/ListingStatusBanner.tsx:95-232`,
`src/constants/translations.ts:699-703, 1410-1415`,
`src/screens/ServiceCartScreen.tsx:55-60, 87-93`

**Issue:** The banner's `Props.bannerHints` type declares
`{ titleKey: string; bodyKey: string; severity }`, and the translations file
defines `listingStatusBannerSuspendedBody`, `listingStatusBannerArchivedBody`,
`listingStatusBannerDeletedBody` for both RU and EN. ServiceCartScreen's 404
fallback synthesizes a `bodyKey: 'listingStatusBannerDeletedBody'`. But the
banner's render only emits `title` (from `titleKey`), the `reasonLabel` chip,
and the free-text `note`. **The `bodyKey` is never read.** Net effect: 6
translation keys (3 RU + 3 EN) are dead code, and any future translator who
edits them sees no UI change. The contract between data-layer and UI is
silently broken.

**Fix:** Pick one of the two paths and apply consistently:
```tsx
// Path A — render the body copy below the title, above the optional note:
const bodyKey = bannerHints.bodyKey;
const body: string =
  (t as unknown as Record<string, string>)[bodyKey] ?? '';
// inside the View, after line1:
{body ? <Text style={styles.body}>{body}</Text> : null}

// Path B — drop bodyKey from Props.bannerHints and remove the 6 *Body
// translation entries + the ServiceCartScreen 404 synthesizer field.
```
Path A is preferred because LBUY-01 calls for buyer-facing copy that's
distinct from the title; the keys are already in place.

---

### WR-02: CTA gating and banner mount short-circuit when route prefills `carData` for non-active listings

**File:** `src/screens/CarDetailsScreen.tsx:78-86, 678-685, 819-955`

**Issue:** The screen resolves `car` via
`CARS.find(...) || route.params.carData || fetchedCar`, so if the previous
screen prefilled `route.params.carData`, the API fetch only fires for admins
(`isAdmin`). Non-admin viewers arriving from a list/grid that prefills
`carData` will see the OLD card-time status, and `fetchedCar` stays `null`.
Both LBUY-01 predicates key off `fetchedCar`:

```
const isListingNonActive =
  !isAdmin && !!fetchedCar?.status && fetchedCar.status !== 'active';
// ...
{!isAdmin && fetchedCar?.status && fetchedCar.status !== 'active' && fetchedCar?.banner && (
  <ListingStatusBanner ... />
)}
```

If a listing transitions to `suspended` between the grid load and the buyer
tapping the card, the buyer sees the active CTAs (Telegram/WhatsApp/Book
it/Get services) AND no banner — i.e. the very TOCTOU window LBUY-01 was
designed to close. The Phase 9 D-08 status-aware GET is bypassed by the
`carData` fast-path.

**Fix:** Either always re-fetch (drop the `existingCar &&` guard) or read the
status flag from `route.params.carData` as a fallback discriminant. Minimal
patch:
```tsx
useEffect(() => {
  if (carId) {
    // Always re-fetch: backend is authority for current status.
    setCarLoading(true);
    apiClient.get(`/api/cars/${encodeURIComponent(carId)}`)
      .then(res => setFetchedCar(/* ... */))
      .catch(() => setFetchedCar(null))
      .finally(() => setCarLoading(false));
  }
}, [carId]); // drop isAdmin from deps too — always fetch
```

---

### WR-03: TOCTOU race — re-fetch on `useEffect([carId, isAdmin])` runs once on mount, never on focus

**File:** `src/screens/CarDetailsScreen.tsx:131-168`

**Issue:** Unlike ServiceCartScreen (which uses `useFocusEffect`),
CarDetailsScreen fetches on mount only. If a buyer parks on the screen for a
minute, opens another screen, an admin suspends the listing, and the buyer
returns via back-navigation, the buyer sees stale status. The 409 banner-flip
in `processPayment` (line 441-450) is the only safety net — and it requires
the buyer to actually tap "Book it" through to Stripe and submit. The cheaper
CTAs (Telegram/WhatsApp) have no 409 path; they open external apps with a
seller contact attempt that never sees a 409.

**Fix:** Move the fetch behind `useFocusEffect` (mirrors ServiceCartScreen's
Pattern 4) so returning to the screen re-validates listing status:
```tsx
useFocusEffect(
  useCallback(() => {
    if (!carId) return;
    let cancelled = false;
    setCarLoading(true);
    apiClient.get(`/api/cars/${encodeURIComponent(carId)}`)
      .then(res => { if (!cancelled) setFetchedCar(/* ... */); })
      .catch(() => { if (!cancelled) setFetchedCar(null); })
      .finally(() => { if (!cancelled) setCarLoading(false); });
    return () => { cancelled = true; };
  }, [carId]),
);
```

---

### WR-04: Banner-state vs Alert ordering in `processPayment` — 409 with non-matching error code falls through to generic Alert with wrong copy

**File:** `src/screens/CarDetailsScreen.tsx:438-455`

**Issue:** The 409 branch matches *only* when both the status code AND
`err.response.data.error === 'listing_not_available'` hold. If the backend
ever returns a 409 with a different error code (e.g. `listing_locked` or
`payment_intent_stale`), execution falls through to
`Alert.alert(t.paymentFailed, msg)` — which is benign except that the
banner is NEVER updated and the buyer sees a paymentFailed alert with no
visible reason for the listing's unavailability. The 409 codepath should
log/handle other 409 error codes more gracefully or at least surface the
banner from any 409 that carries a `banner` field in the body.

**Fix:** Loosen the predicate to gate on the presence of a `banner` field
in the 409 body:
```ts
if (err?.response?.status === 409 && err.response.data?.banner) {
  const body = err.response.data;
  setFetchedCar((c: any) => c ? ({
    ...c,
    status: body.status,
    reasonCategory: body.reasonCategory,
    banner: body.banner,
  }) : c);
  return;
}
```
Keep the literal-string `'listing_not_available'` check only if the contract
explicitly forbids other 409 banner shapes.

---

### WR-05: `generate-coverage-manifest.sh` falls back to absolute paths when `realpath --relative-to` is missing (macOS default)

**File:** `scripts/generate-coverage-manifest.sh:86`

**Issue:** macOS ships BSD `realpath` without `--relative-to`. The fallback
`echo "$file"` emits an absolute path like
`/Users/<username>/development/.../11-LIST-SECURITY.audit.test.ts`. This
breaks the determinism the coverage-manifest audit test relies on
(`coverage-manifest.audit.test.ts:80-84` compares fresh output to committed
content with only the `Generated:` line normalized). A developer running the
audit on macOS without `coreutils` will see a `.gitignored`-style diff
between their fresh-generation and the committed manifest — every mobile-test
file row absolute-path-prefixed.

**Fix:** Use a portable relative-path computation that doesn't depend on GNU
realpath:
```bash
case "$file" in
  "$BACKEND_TESTS_ABS"/*)
    suffix="${file#$BACKEND_TESTS_ABS/}"
    rel="../backend-services/carEx-services/__tests__/${suffix}"
    ;;
  "$MAIN_REPO_ROOT"/*)
    rel="${file#$MAIN_REPO_ROOT/}"
    ;;
  *)
    rel="$file"
    ;;
esac
```
This works on bash 3.2 (already targeted) and removes the GNU realpath
dependency entirely.

---

### WR-06: Audit-test sliding window misses cancel-call branches with discriminant >2 lines back

**File:** `__tests__/lbuy03-no-auto-cancel.test.ts:80-99`

**Issue:** The sliding-window scan checks only `lines[i-2]` and `lines[i-1]`
for `LISTING_STATUS_REGEX`. A typical refactor-introduced regression like:
```ts
if (fetchedCar.status === 'suspended') {
  const reason = 'listing_unavailable';
  logEvent('refund_initiated', { reason });
  notifyUser(...);
  cancelOrder(orderId);  // 4 lines after the discriminant — NOT flagged
}
```
escapes the audit. The file header documents the trade-off ("Comments are
skipped so the file header / doc strings can mention these concepts without
false-positives") but doesn't document this scan-depth limit. Given LBUY-03
is a negative requirement and the audit is the ONLY mechanism enforcing it,
a 2-line window is too narrow.

**Fix:** Track a "current scope started by listing-status discriminant" flag
keyed on `{` / `}` balance, OR widen the sliding window to 6-10 lines (still
narrow enough to keep false-positives low for the small order screens). The
window approach is cheapest:
```ts
const WINDOW = 8;
for (let i = WINDOW; i < lines.length; i++) {
  const candidate = lines[i];
  if (candidate.trim().startsWith('//')) continue;
  if (!AUTO_ACTION_REGEX.test(candidate)) continue;
  const window = lines.slice(Math.max(0, i - WINDOW), i).join(' ');
  if (LISTING_STATUS_REGEX.test(window)) {
    /* flag */
  }
}
```
Negative-control note (already in the file header) becomes a real test step:
the operator should temp-insert a 3+ line offending block to verify the
widened window catches it.

## Info

### IN-01: `car.id` interpolated unencoded into apiClient URL paths

**File:** `src/screens/ServiceCartScreen.tsx:66`,
`src/screens/CarDetailsScreen.tsx:141`

**Issue:** `apiClient.get(\`/api/cars/${car.id}\`)` and
`apiClient.get(\`/api/cars/${carId}\`)` pass raw IDs into the URL path. If a
malformed ID containing `/` or URL-reserved characters ever lands in
`car.id` (deep-link payload, malicious push, future schema change), it
would alter the request path. The backend uses Mongo ObjectIds so this is
extremely low-risk today, but a defense-in-depth `encodeURIComponent` would
cost nothing.

**Fix:**
```ts
apiClient.get(`/api/cars/${encodeURIComponent(car.id)}`)
```

---

### IN-02: `useFocusEffect` cleanup may call `setExpanded` after unmount in `ListingStatusBanner`

**File:** `src/components/moderation/ListingStatusBanner.tsx:120-124`

**Issue:** The cleanup calls `setExpanded(false)` on blur AND on unmount.
In StrictMode dev, the focus-effect cleanup also fires once after mount.
React tolerates setState on unmounted components silently (since RN 0.71+),
so this is informational only — but the analog pattern is identical and
the warning surface is identical.

**Fix:** None required; verify in dev StrictMode if a "setState on
unmounted component" warning ever appears, switch to a guard:
```ts
useFocusEffect(
  useCallback(() => {
    let mounted = true;
    return () => { if (mounted) { mounted = false; setExpanded(false); } };
  }, []),
);
```

---

### IN-03: `LISTING_STATUS_REGEX` in audit could match its own assignment if file is moved into scan paths

**File:** `__tests__/lbuy03-no-auto-cancel.test.ts:54-55`

**Issue:** The regex source contains the literal substrings `listing_not_available`,
`carStatus`, `fetchedCar.status`. The file itself is excluded from
`SCAN_FILES`, but if a future maintainer copy-pastes this audit into a
location that *is* in scan paths (or generalizes SCAN_FILES via glob), the
regex source string will trigger false positives against itself.

**Fix:** Either pin SCAN_FILES to an explicit allowlist (already the case
— low risk) or add a self-skip:
```ts
if (path.resolve(absPath) === __filename) return;
```

---

### IN-04: `mockLastFocusCleanup` swallows all errors in the cart-screen test mock — could hide real cleanup-throw regressions

**File:** `src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx:115`

**Issue:** The `useFocusEffect` mock wraps prior-cleanup invocation in
`try { ... } catch (_e) { /* swallow */ }`. Real RN `useFocusEffect` does
NOT swallow cleanup errors — they propagate. Tests that introduce a real
cleanup-throw bug would silently pass.

**Fix:** Either re-throw or at minimum `console.error` so a regression is
audible:
```ts
try { mockLastFocusCleanup(); } catch (e) { console.error(e); throw e; }
```

---

### IN-05: `accessibilityLabel` may render as `". . ."` when title, reason, and note are all empty

**File:** `src/components/moderation/ListingStatusBanner.tsx:155-156`

**Issue:** `\`${title}. ${reasonLabel ?? ''}. ${note ?? ''}\`.trim()`. If
`title` is the fallback `status` string ('suspended'/'archived'/'deleted')
and both reason and note are empty, the label becomes
`"suspended. . ."` — which a screen-reader will pronounce as the literal
word "period period period". Minor a11y polish issue.

**Fix:**
```ts
const accessibilityLabel = [title, reasonLabel, note]
  .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
  .join('. ');
```

---

_Reviewed: 2026-05-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
