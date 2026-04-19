---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
stopped_at: "Phase 06 Plan 03 complete (Wave 2 UserStatusBanner component + 19 real test assertions). 2 commits: feat b8207e6 (UserStatusBanner.tsx 314 lines — non-dismissable severity-aware banner, mailto appeal CTA with encodeURIComponent + setAt + Alert fallback, LayoutAnimation expand, useFocusEffect collapse on blur), test ec11163 (16 test.todo → 19 real assertions, all GREEN first run). Delivers AFF-01/02/03. 3 label-level deviations auto-fixed (all comment-only to satisfy strict grep acceptance criteria on encodeURIComponent=2, canOpenURL=0, mailto-url literal); zero functional deviations. Phase 6 test surface: 23 todo (FeatureGateOverlay + GatedScreenWrapper scaffolds — future plans) + 22 passed (UserStatusBanner 19 + translation-parity 3) / 0 failed."
last_updated: "2026-04-19T08:38:15.749Z"
last_activity: 2026-04-19
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 51
  completed_plans: 40
  percent: 78
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Admins can act on bad-actor users after they're already in the system — without losing the audit trail or breaking in-flight orders for legitimate counterparties.
**Current focus:** Phase null

## Current Position

Phase: 06-affected-user-ux-security-review — EXECUTING
Plan: 4 of 12 (01, 02, 03 complete)
Next: /gsd-execute-phase 06 (Plan 04 — FeatureGateOverlay + GatedScreenWrapper). UserStatusBanner shipped; FeatureGateOverlay reuses the severity palette + icon map; GatedScreenWrapper wires the apply_as_provider alias + all_writes sentinel predicate.
Last activity: 2026-04-19 -- Phase 06 Plan 03 complete
Resume file: .planning/phases/06-affected-user-ux-security-review/06-04-PLAN.md

Progress: [████████░░] 78% (40/51 plans; Phase 06 3/12)

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: —
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 02 P01 | 2 | 2 tasks | 4 files |
| Phase 02 P02 | 3min | 3 tasks | 5 files |
| Phase 02 P03 | 4min | 2 tasks tasks | 4 files files |
| Phase 02 P04 | 3min | 2 tasks tasks | 3 files files |
| Phase 02 P05 | 6m24s | 3 tasks | 4 files |
| Phase 02 P06 | 4m47s | 2 tasks | 2 files |
| Phase 03 P01 | 3min | 2 tasks | 3 files |
| Phase 03 P02 | 2min | 2 tasks | 2 files |
| Phase 03 P03 | 2min | 2 tasks tasks | 1 file files |
| Phase 03 P04 | 3min | 2 tasks tasks | 2 files files |
| Phase 03 P05 | 2m10s | 1 tasks | 1 files |
| Phase 03 P06 | 8m44s | 3 tasks | 5 files |
| Phase 05 P01 | 3m14s | 2 tasks | 13 files |
| Phase 05 P02 | 3m14s | 2 tasks | 2 files |
| Phase 05 P03 | 2min | 2 tasks | 1 file |
| Phase 05 P04 | 1m17s | 2 tasks | 4 files |
| Phase 05 P05 | 1m05s | 2 tasks | 2 files |
| Phase 05 P06 | 3m20s | 3 tasks | 3 files |
| Phase 05 P07 | 3m34s | 1 tasks | 1 files |
| Phase 05 P08 | ~30s | 1 tasks | 1 files |
| Phase 05 P09 | 8m54s | 5 tasks | 10 files |
| Phase 05 P10 | ~10m | 4 tasks | 8 files |
| Phase 05 P11 | 5m48s | 3 tasks | 5 files (+2 deleted) |
| Phase 05 P12 | 8m46s | 4 tasks (+1 auto-fix) | 6 files |
| Phase 06 P01 | 2m26s | 3 tasks | 4 files |
| Phase 06 P02 | 2m45s | 2 tasks | 1 file |
| Phase 06 P03 | 4m25s | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Backend-first 6-phase sequence forced by hard deps (verifyIdToken before endpoints; capability map before enforcement; providerSnapshot before delete; ModerationService before UI)
- Roadmap: Schema + security baseline merged into one phase (Phase 1) since both are small foundation work
- Roadmap: QUAL-01 translations audit owned by Phase 6 as cross-cutting gate; earlier phases still write translations as they go
- [Phase 02]: Plan 02-01: req.admin.uid copied from req.auth.uid in requireAdmin (option a per pattern map) — single canonical req.admin shape
- [Phase 02]: Plan 02-01: zod ^3.25.76 + express-rate-limit ^8.3.2 installed as backend production deps (D-37 caret pins)
- [Phase 02]: Plan 02-01: MongoMemoryReplSet fixture lives at __tests__/_helpers/mongoReplSet.js — sibling to existing standalone tests, not a replacement
- [Phase 02]: Plan 02-02: Edit-profile whitelist codified as two .strict() Zod objects wrapped in z.discriminatedUnion on role — machine-enforced D-03 whitelist, not just documented
- [Phase 02]: Plan 02-02: Rate limiter keyGenerator has 3-tier fallback (admin.uid → admin.email → 'unauthenticated' bucket) — regression that nulls uid degrades gracefully instead of silent single-bucket merge
- [Phase 02]: Plan 02-03: Two-step transactional pattern (insert audit row → update User with lastActionId) established as the canonical shape for every Phase 2 handler — explicitly NOT optimized into single $set per D-18
- [Phase 02]: Plan 02-03: Last-admin guard runs INSIDE the transaction with .session(session) — D-27/D-28 compliance; fires only for suspend (never for unsuspend, revoke_role, delete_profile, edit_profile per D-28)
- [Phase 02]: Plan 02-03: Router KNOWN_USER_ERRORS set pre-registered with Plan 02-04/02-05 error tags (role_not_assigned, invalid_field, no_changes, invalid_role_for_delete) — downstream plans throw without amending router error-mapping
- [Phase 02]: Plan 02-04: ROLE_FIELD_BY_NAME whitelist map at top of service.js — dynamic $set on User.{sellerStatus|brokerStatus|logisticsStatus} guarded by fixed lookup so direct service callers cannot inject arbitrary field names via the role parameter (T-02-04-06 mitigation)
- [Phase 02]: Plan 02-04: Last-admin guard explicitly NOT wired into revokeRole per D-28 — admin-ness lives in AdminUser collection (joined by email), not in User.{role}Status fields. Revoke can never make someone less of an admin. Documented in-source so future readers don't add suspend's guard 'for safety'
- [Phase 02]: Plan 02-04: Negative invariants enforced as test assertions — Tests 2/3 assert Broker/LogisticsPartner doc still exists after revoke (D-08 preservation), Test 6 asserts moderationStatus.state unchanged after revoke (D-12 orthogonality). Invariants live BOTH as in-source comments at the do-NOT step AND as toEqual assertions in revokeRole.test.js
- [Phase 02]: Plan 02-05: PROFILE_MODEL_BY_ROLE + getProfileModel() shared between delete and edit; lazy mongoose.model() resolution lets tests inject canonical-name loose-schema seeds before service.js loads, while production server.js registers the same names at boot
- [Phase 02]: Plan 02-05: Two failure paths for unknown edit-profile fields collapse to ONE error envelope ({ error: 'invalid_field', fields: [...] }) — Zod unrecognized_keys at the router AND service-layer EDIT_WHITELIST_BY_ROLE both surface identical 400 shape so mobile UI has one error path
- [Phase 02]: Plan 02-05: Two rollback evidence tests on deleteProviderProfile (audit-failure + post-delete via jest.spyOn User.updateOne mockRejectedValueOnce) prove T-02-05-02 mitigation across both ordering paths
- [Phase 02]: Plan 02-06: router.use(moderationRateLimiter) mounted IMMEDIATELY after express.Router() and BEFORE any route definitions — position load-bearing, verified by an awk positional assertion that catches misordered edits in CI
- [Phase 02]: Plan 02-06: Test isolation via moderationRateLimiter.resetKey('admin:<uid>') in a top-level beforeEach (not module-tree resets) — clears specific buckets without re-requiring the moderation router and triggering OverwriteModelError on the model singletons
- [Phase 02]: Plan 02-06: Single shared Express app built ONCE in beforeAll — limiter state is per-key not per-app, so resetKey() is sufficient for isolation; no per-describe rebuilder helper needed (or possible without OverwriteModelError)
- [Phase 02]: Plan 02-06: Block 3 Test 2 (per-admin keying) explicitly proves D-31 — admin C succeeds with 200 even after admin A's bucket is exhausted, closing the IP-rotation bypass attack vector via real e2e evidence
- [Phase 03]: Plan 03-01: Car/Broker/LogisticsPartner models extracted to src/models/*.js with co-located pre(/^find/) hide-hooks. Join fields locked: sellerId (Car), ownerUid (Broker+Logistics). Lazy mongoose.model('User') inside each hook avoids load cycle per D-08.
- [Phase 03]: Plan 03-01: includeAllUsers bypass lives on query options (not filter). One use per model file — grep-visible for Phase 6 QUAL-03 security review. Default is hide-safely (no flag = filter applies).
- [Phase 03]: Plan 03-01: server.js intentionally untouched — Plan 03-03 deletes inline schemas + wires require(). Pre-existing duplicate-index warning on ownerUid (inline unique + schema.index) preserved verbatim per scope boundary; cleanup deferred (see deferred-items.md).
- [Phase 03]: Plan 03-02: attachAuthIfPresent created as a sibling file (not a mutation of verifyIdToken.js) so /api/admin/moderation/* keeps strict 401-on-missing-Bearer (D-04). The fork is two grep-visible lines: module name + the if (!match) return next() branch.
- [Phase 03]: Plan 03-02: requireNotSuspended self-lookup uses .setOptions({ includeAllUsers: true }) as MANDATORY bypass of Plan 03-01 pre(/^find/) hide-hook. Without it, suspended caller's User doc self-hides -> middleware 404s instead of 403s -> false-negative suspension bypass (T-03-02-03 mitigation enforced by acceptance criterion requiring exactly 1 literal match).
- [Phase 03]: Plan 03-02: feature_limited capability check reads denormalized user.moderationStatus.restrictedFeatures directly (Phase 1 D-12) — acceptance criterion requires zero STATUS_POLICY references in the middleware so capability source of truth is co-located with the User doc.
- [Phase 03]: Plan 03-02: 403 account_suspended response body sends status: state (string), NOT the whole moderationStatus subdoc — mobile banner matches on the string per D-15 and avoids leaking setByAdminUid to gated users.
- [Phase 03]: Plan 03-03: server.js now requires extracted Car/Broker/LogisticsPartner models — Plan 03-01 pre(/^find/) hide-hooks go LIVE on every server.js Car/Broker/Logistics query without further changes. ROADMAP Criterion #2 effectively delivered at this commit.
- [Phase 03]: Plan 03-03: attachAuthIfPresent precedes requireNotSuspended on all five gated routes; attachAuthIfPresent precedes upload.array('images', 25) on POST /api/cars so 403 short-circuits BEFORE multer starts streaming to S3 — avoids charging S3 put-object costs on suspended callers. D-04 mount order enforced.
- [Phase 03]: Plan 03-03: exact grep counts on requireNotSuspended/attachAuthIfPresent (5/5 respectively; 1/2/2 by capability) elevated to CI-relevant invariant — scope discipline per D-02 hybrid cutover encoded as a mechanical check, not just documentation.
- [Phase 03]: Plan 03-04: confirmBooking injected-stripe contract (function arg, not require) — lets Jest mock Stripe via jest.mock('stripe',...) at server.js level while production passes the module-level instance through. Handler at server.js:1044 does the injection.
- [Phase 03]: Plan 03-04: Refund-first-throw-second ordering hardened by triple 'Refund first, throw second' comment (file header + helper body + transaction-callback banner) — high-visibility tripwire at every touch point; any future refactor that reverses the ordering must explicitly delete three comments.
- [Phase 03]: Plan 03-04: Idempotency fast-path placed BEFORE stripe.paymentIntents.retrieve — retry on an already-booked car (car.stripePaymentIntentId === paymentIntentId) returns existing { car, orders } without touching Stripe, preventing redundant API calls on mobile retry loops (T-03-04-06).
- [Phase 03]: Plan 03-04: ServiceOrder model resolved lazily via mongoose.model('ServiceOrder') inside function body (not top-of-file require) — service loads cleanly without depending on server.js's inline ServiceOrder registration, matters for test isolation and future Phase 1 D-02 extraction.
- [Phase 03]: Plan 03-04: orderNumber collision-check lookup uses .session(session).lean() inside the transaction so uniqueness read + create share the same snapshot — prevents two concurrent confirms from both observing 'no such orderNumber' and then both inserting, catching the race at read time instead of relying on the unique index to reject one post-txn.
- [Phase 03]: Plan 03-05: POST /api/orders route body replaced with unconditional 410 Gone stub (13 lines) while route entry preserved — removal deferred per 03-CONTEXT.md until Phase 4 mobile retires the call + grace period. No middleware on the route (the 410 is the gate per D-12); attachAuthIfPresent total unchanged at 6 (5 route usages + 1 require). ServiceOrder require kept at top-of-file (7 remaining handlers still reference the model). Net -85 lines. Closes ROADMAP Criterion #3 TOCTOU escape hatch where a client could skip confirm-booking's transactional re-check by calling standalone POST /api/orders directly.
- [Phase 03]: Plan 03-06: ROADMAP criteria mapped to describe strings as grep-stable literals ('ROADMAP Criterion #1'..'#4') so verifier coverage confirmation is a mechanical grep-count rather than human cross-reference
- [Phase 03]: Plan 03-06: Concurrent-race tests (D-13 race in confirmBooking case 6 + acceptance Block 3) use Promise.allSettled + branch classification on confirmResult.status; exactly two valid outcomes enumerated (refund-abort OR booking-succeed), forbidden third state (booked orders + refund fired) fails the test
- [Phase 03]: Plan 03-06: Tests do NOT boot server.js; each file builds its own minimal Express app (or calls services directly). Acceptance app inlines the five gated routes verbatim from Plan 03-03 so the middleware chain is a faithful reproduction without the server.js init weight (Mongo URI, Twilio, S3, Stripe, Firebase initializers)
- [Phase 03]: Plan 03-06: ServiceOrder registered as a loose { strict: false } schema under the canonical name BEFORE requiring confirmBooking (which does mongoose.model('ServiceOrder') lazily) — mirrors __tests__/moderation/deleteProviderProfile.test.js pattern; decouples enforcement tests from server.js's inline ServiceOrder registration per Phase 1 D-02
- [Phase 03]: Plan 03-06: Phase 1 DATA-03 test (ServiceOrder.providerSnapshot.test.js) now fails because Plan 03-05 replaced POST /api/orders with 410 Gone; logged to deferred-items.md as Plan 03-05 fallout; DATA-03 coverage preserved in the new confirmBooking.transaction.test.js case 1 (happy path asserts providerSnapshot.companyName)
- [Phase 05]: Plan 05-01: 13 Wave 0 jest test scaffolds created with test.todo placeholders across 5 directories (src/services/moderation/__tests__, src/hooks/__tests__, src/utils/__tests__, src/components/moderation/__tests__, src/screens/__tests__) — every scaffold imports its not-yet-existing module under test so Wave 1+ plans get both a real <automated> verify target AND a compile-time wiring check
- [Phase 05]: Plan 05-01: Dual-role delete contract (D-04 / RESEARCH §Pitfall 11) locked from Wave 0 across three scaffolds — QuickActionSheet.test.tsx (3 explicit test.todo entries + deleteBrokerProfile + deleteLogisticsProfile mock keys), AdminManagementScreen.test.tsx (explicit-role pass-through test.todo), AdminModerationScreen.test.tsx (same) — prevents any Wave 1+ plan from silently defaulting to broker when both provider profiles are APPROVED
- [Phase 05]: Plan 05-01: useDebouncedValue.test.ts scaffold uses react-test-renderer + jest.useFakeTimers (already installed) instead of @testing-library/react-hooks (not installed) — driven via a local Harness component so Wave 4 can fill bodies with TestRenderer.create + act(jest.advanceTimersByTime) without a new test dep
- [Phase 05]: Plan 05-02: `adminUsers` collision resolved via dual-key strategy — legacy `adminUsers: 'Администраторы' / 'Administrators'` preserved verbatim (Profile menu consumer); new `adminUsersTitle: 'Пользователи' / 'Users'` added for the repurposed AdminManagementScreen header (RESEARCH §Pitfall 8). Both keys coexist; Plan 05-09 must import the intended one
- [Phase 05]: Plan 05-02: Dual-role delete labels `deleteBrokerProfile` + `deleteLogisticsProfile` land in both RU and EN — D-04 / RESEARCH §Pitfall 11 contract now has STRING-layer support matching the Wave 0 scaffold-layer lock. QuickActionSheet (Plan 05-06) renders both rows when target user has BOTH broker AND logistics APPROVED; no silent broker default possible once the labels hard-code the role name
- [Phase 05]: Plan 05-02: COLORS.success preserved at `#22C55E` (legacy); COLORS.successFg (`#4ADE80`) added as a new separate token aligned with COLORS.moderation.active.fg — T-05-02-03 mitigation. Existing call sites of COLORS.success continue to resolve unchanged; new moderation code uses COLORS.successFg where tonal alignment with active-severity badge matters
- [Phase 05]: Plan 05-02: TYPOGRAPHY fontWeight values pinned with `as const` (6 instances — one per variant) — without it TypeScript widens to `string`, which React Native StyleSheet rejects (only the literal union `'normal' | 'bold' | '100' | ... | '900'` is accepted). Acceptance criterion locks count at exactly 6
- [Phase 05]: Plan 05-02: Strict RU/EN parity enforced by sorted key-set diff — 455 = 455 keys at end of plan; verified by Node script extracting `^ {4}([a-zA-Z][a-zA-Z0-9]*):` from each language block. Banner comment `// ---- Phase 5 — Admin Moderation UI (UI-SPEC §10) ----` appears exactly 2× (once per language)
- [Phase 05]: Plan 05-03: AbortSignal config param added to BOTH searchUsers AND getHistory (plan prescribed only searchUsers; added to getHistory for symmetry + future detail-screen cancellation) — matches axios 1.x forward-compat path per RESEARCH §A2; consumers pass `{ signal: controller.signal }` to drop stale requests
- [Phase 05]: Plan 05-03: ModerationActionRow.severity typed as `Severity | 'none'` (not just Severity) because unsuspend/revoke_role/restore_role/edit_profile/delete_provider_profile audit rows carry no severity — matches Phase 2 audit schema and prevents downstream discriminant narrowing bugs when rendering history rows
- [Phase 05]: Plan 05-03: SearchUserItem.moderationStatus uses the full discriminated literal union (`'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned'`) rather than reusing the `Severity` type alias — because `'active'` is NOT a valid Severity (Severity excludes active by design). Keeps filter query `state` type aligned with row `state` field without widening Severity
- [Phase 05]: Plan 05-03: MOB-01 guardrail held exactly as prescribed — `grep -c 'suspend|revoke|moderation' src/services/AuthService.ts` = 0 unchanged baseline; all new HTTP stays in ModerationService. Existing 6 admin write methods byte-identical verified by `git diff` showing only additions + stub replacement scoped to `getHistory`
- [Phase 05]: Plan 05-04: `useDebouncedValue` cleanup wired via `setTimeout`/`clearTimeout` inside `useEffect`; timer cleared on unmount AND on every value/delay change — matches RESEARCH pitfall mitigation for stale-render race (T-05-04-02 acceptance: closure captures value at schedule time, one-frame staleness is acceptable because the AdminModerationScreen effect re-runs on the new debounced value and AbortController invalidates the prior fetch)
- [Phase 05]: Plan 05-04: `formatYmdHm` uses LOCAL time (`getHours`, `getMinutes`) not UTC and avoids `toLocaleString` family entirely — D-15 locale-independent contract enforced by acceptance grep counts (padStart=4, toLocale*/getUTC=0). Returns `'-'` on null/undefined/empty/invalid-date inputs rather than throwing, so a missing backend timestamp does not crash a history row
- [Phase 05]: Plan 05-04: `MODERATION_ERROR_KEY_MAP` is `as const`-asserted so `t[mapped]` at downstream call sites stays literal-typed against the translations.ts string-literal union; `ModerationErrorCode = keyof typeof MODERATION_ERROR_KEY_MAP` derives the code-union from a single source of truth. Map covers 11 Phase-2 codes; unmapped codes (e.g. `provider_suspended`, `deprecated` from the widened `ModerationError.code` type) intentionally fall back to `t.errGeneric` per T-05-04-03 mitigation
- [Phase 05]: Plan 05-04: Two new routes appended at the END of `RootStackParamList` (not alphabetized) — preserves 21 pre-existing entries byte-identical; inline `{ targetUid: string }` param shape follows existing CarDetails/SellerListings convention; neither route registered in `linking.config.screens` (admin nav is in-app only, T-05-04-04 acceptance)
- [Phase 05]: Plan 05-05: SeverityBadge label lookup uses `(t as Record<string, string>)[labelKey]` with defensive `?? state` fallback — decouples the component from the full TRANSLATIONS key union (which grows every phase) while still giving compile-time safety on the STATE_TO_LABEL_KEY table; the `?? state` fallback closes the narrow runtime hole opened by the cast (T-05-05-02 mitigation)
- [Phase 05]: Plan 05-05: SeverityBadge pill uses `alignSelf: 'flex-start'` (pill hugs content) + `lineHeight: SIZES.badgeHeight` (vertical centering via line-box, not flex alone) — iOS and Android flex vertical centering render short pill text slightly differently; locking lineHeight to container height gives pixel-stable output on both. Mirrors the existing `typeBadge` pattern at AdminDashboardScreen.tsx:163-175
- [Phase 05]: Plan 05-05: EmptyState imports `LucideIcon` as a TYPE only (`import type {...}`) — no runtime cost, no accidental full-icon-registry pull; JSX destructuring rename `icon: Icon` is required because React parses lowercase identifiers as host elements
- [Phase 05]: Plan 05-05: EmptyState body capped at `maxWidth: 280` — keeps two-line copy readable on standard phone widths (375-414pt); longer copy wraps to 3+ lines and pushes the icon+title off-screen on iPhone SE form factor. `size={40}` on the icon stays literal-numeric (not a theme token) because Lucide treats icon sizing as a per-consumer decision; Plan 05-02 did not add it to the SIZES scale for a single call site
- [Phase 05]: Plan 05-05: Both components are pure presentational — no data fetching, no service calls, no business logic — and consume ONLY theme tokens (COLORS.moderation, TYPOGRAPHY, SIZES) plus translations via useLanguage(). Acceptance criteria lock zero hardcoded hex (count=0 after filtering COLORS.* references) on both files
- [Phase 05]: Plan 05-06: Dual-role delete contract resolved at the UI layer (RESEARCH §Pitfall 11) — QuickActionSheet predicate `hasBroker && hasLogistics` renders TWO distinct rows (deleteBrokerProfile + deleteLogisticsProfile), each with explicit `role` payload. Single-role fallback row computes role inline from the sole truthy provider-status; the `undefined` branch is belt-and-braces since `canDeleteProfile` disables the row but the guard prevents a future refactor silently posting an empty-role DELETE body
- [Phase 05]: Plan 05-06: ModerationActionPayload is a discriminated union on `action` across 4 variants — each variant carries the typed body shape (SuspendBody/UnsuspendBody/RevokeRoleBody/EditProfileBody) from ModerationService. Forces parent screens to exhaustively handle all 4 cases at compile time. delete_profile deliberately uses TypedConfirmationModal directly, NOT this modal (per UI-SPEC Component 4 table)
- [Phase 05]: Plan 05-06: All 3 components are purely presentational per D-08 — `grep -c 'ModerationService\.' returns 0 on every file; only ModerationActionModal imports ModerationService as a TYPE. Parent screens (Plans 05-07, 05-08, 05-09) own every runtime service call + optimistic row flip + rollback. Prevents any component from taking responsibility for the optimistic/rollback dance, which belongs at the row/screen level where state lives
- [Phase 05]: Plan 05-06: TypedConfirmationModal sentinel matching uses `input.trim().toLowerCase() === target.email.trim().toLowerCase()` — literal string equality, no regex. Hint interpolation uses String.prototype.replace('{email}', ...) — literal substring, not template. keyboardType='email-address' + autoCapitalize='none' + autoCorrect=false together prevent iOS autocorrect from turning a correctly-typed email into a mismatch
- [Phase 05]: Plan 05-06: Modal + overlay + stop-prop pattern mirrored from FilterModal.tsx across all 3 components — outer `<Pressable onPress={onClose}>` + inner `<Pressable onPress={() => {}}>`. RN Pressable swallows the press when onPress is set, so inner taps never bubble to the overlay. No preventDefault/stopPropagation calls needed
- [Phase 05]: Plan 05-06: editHasChanges uses `JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)` rather than reference equality — safely handles arrays (coverageAreas, timelines) vs undefined baseline without adding a deep-equal dependency. The `?? null` normalization prevents `undefined !== null` false positives across the before/after axes
- [Phase 05]: Plan 05-07: AdminModerationScreen SafeAreaView imported from `react-native-safe-area-context` (not stock `react-native`) — matches dominant project convention across HomeScreen/LoginScreen/SellCarScreen/SignupScreen/CarDetailsScreen/AdminManagementScreen. Plan PATTERNS code block used stock import but the screen follows the codebase pattern to preserve safe-area edge handling on display-cutout devices
- [Phase 05]: Plan 05-07: handleActionSubmit synchronously clears `actionTarget`/`actionType` before escalating `permanently_banned` suspend or `revoke_role` to TypedConfirmationModal — prevents a one-frame overlap where both the action modal AND the destructive confirmation would render simultaneously. Plan PATTERNS did not include this (Rule 1 auto-fix)
- [Phase 05]: Plan 05-07: Role-explicit delete pass-through enforced with TWO defensive guards — `handleQuickActionSelect` Alerts on missing `selection.role` and `TypedConfirmationModal.onConfirm` Alerts on missing `pendingDeleteRole`. The contract from QuickActionSheet (Plan 05-06) makes `selection.role` non-optional for delete_profile in practice; both guards are belt-and-braces against future refactors. Zero silent broker defaults exist in the screen (grep = 0 for `brokerStatus === 'APPROVED' ? 'broker' : 'logistics'`)
- [Phase 05]: Plan 05-08: AdminUserDetailScreen uses `ListHeaderComponent={StickySummaryCard}` + `stickyHeaderIndices={[0]}` — UI-SPEC §Component 3 LOCKED pattern avoids the anti-pattern of FlatList nested inside a ScrollView while keeping the summary pinned during history scroll. `stickyHeaderIndices` is `[]` when target is null to prevent a stuck empty-header render
- [Phase 05]: Plan 05-08: Optimistic history mutation is PREPEND-only on success path (`setHistory((curr) => [optimisticRow, ...curr])`) + full-restore on rollback (`setHistory(prevHistory)`); synthetic row id prefix `local-${Date.now()}` is grep-detectable (T-05-08-01). Discipline prevents append-only violation (D-15) while still giving instant visual feedback — pull-to-refresh is the reconciliation path
- [Phase 05]: Plan 05-08: Target-user lookup uses searchUsers({ q: targetUid, limit: 5 }) with strict localId match first, then users[0] fallback, then Alert + navigation.goBack() on total miss — belt-and-braces closure of T-05-08-03 (hand-crafted invalid targetUid) and T-05-08-08 (wrong-user fallback). Route param stays locked at `{ targetUid: string }` per D-09
- [Phase 05]: Plan 05-08: History card severity mapping only fires on `action === 'suspend'` with a real severity; non-severity actions (unsuspend/revoke_role/restore_role/edit_profile/delete_provider_profile) get `COLORS.accent` border as fallback. `severity === 'none'` is explicitly excluded from SeverityBadge rendering to avoid Severity-type narrowing bugs (ModerationActionRow.severity is `Severity | 'none'` per Plan 05-03)
- [Phase 05]: Plan 05-09: AdminManagementScreen repurposed (D-03) as a near-clone of AdminModerationScreen MINUS search/state-filter chips PLUS role-toggle chips ('All users' / 'Admins only'). `pendingDeleteRole` state channel mirrored verbatim so the dual-role delete contract (RESEARCH §Pitfall 11) holds uniformly across BOTH list screens — grep = 0 for `brokerStatus === 'APPROVED' ? 'broker' : 'logistics'` on both. Legacy AdminEntry + AuthService.getAdminUsers + Add/Remove admin modal flows removed in their entirety (admins are added via approval flow on AdminDashboardScreen per RESEARCH §AdminManagementScreen note)
- [Phase 05]: Plan 05-09: AdminDashboardScreen typed via `NativeStackNavigationProp<RootStackParamList, 'AdminDashboard'>` to make `navigate('AdminModeration')` compile-checked against the new route; aligns with Plans 05-07/05-08 convention. Existing tabBar / pending-request UI untouched — the card is purely additive between header and tabBar
- [Phase 05]: Plan 05-09: useDebouncedValue.test.ts kept at `.ts` extension (matching Plan 05-01 scaffold filename) by switching from JSX `<Text>...</Text>` to `React.createElement(Text, ...)` — react-native jest preset does not enable JSX transforms for plain `.ts` files. Alternative of renaming to `.tsx` was rejected to preserve scaffold filenames verbatim. All 4 tests green via `react-test-renderer` + `jest.useFakeTimers()`
- [Phase 05]: Plan 05-09: Existing Phase-4 Test 8 in ModerationService.test.ts (`'Not implemented — Phase 5 adds the /history route'`) updated to assert the real Phase 5 GET call instead — the Phase-4 stub assertion was directly contradicting Plan 05-03's real implementation (Rule 1 auto-fix). Dedicated path/param coverage lives in the new ModerationService.getHistory.test.ts file (this Plan's Task 3)
- [Phase 05]: Plan 05-09: 05-VALIDATION.md self-test row for 05-09-05 uses sentinel `placeholder-task-row` instead of literal `05-XX-XX` in its own grep command — acceptance criterion required `grep -c '05-XX-XX' 05-VALIDATION.md` to return 0, which a literal self-reference would break. Semantic intent preserved; the row still verifies no placeholder rows remain in the document
- [Phase 05]: Plan 05-09: MOB-01 + WR-02 BLOCKING grep guardrails CERTIFIED GREEN at final state — `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` = 0; `grep -rl "_skipModerationInterceptor" src/ | grep -v "__tests__"` lists EXACTLY 2 files (client.ts + AuthContext.tsx). Phase 5 end-to-end wired: AdminDashboard → nav card → AdminModeration → row tap → AdminUserDetail
- [Phase 05]: Plan 05-10: React 19 `await act(async)` hang on AdminManagementScreen/AdminModerationScreen solved by hybrid pattern — sync `act(() => TestRenderer.create(...))` + outside-act `setImmediate` microtask pump + bookending sync `act(() => {})` to satisfy state-update warnings. Codified as `settle()` helper shared across all 3 screen tests. Root cause: AbortController-wrapped axios effects keep React's scheduler queue alive past jest's 5s timeout inside async act
- [Phase 05]: Plan 05-10: LanguageContext jest.mock must return a STABLE Proxy reference (hoisted `const mockT = new Proxy(...)` with `mock*` prefix for babel-plugin-jest-hoist allowlist) — a fresh Proxy on every render rotates `T` identity, which rotates `runSearch` via `useCallback([T])`, which re-fires `useEffect([runSearch])`, which double-fires `searchUsers`, which breaks the AdminModerationScreen pagination guard test (got 4/6 calls vs expected 2/2). Mock hygiene lesson that applies to every future screen test
- [Phase 05]: Plan 05-10: Dual-role delete contract locked with 3 cases in QuickActionSheet.test.tsx AND 4 pass-through cases in screen tests — `grep -c "role: 'broker'"` = 6 across QuickActionSheet+AdminManagement+AdminModeration tests; `grep -c "role: 'logistics'"` = 6. Any future refactor that silently defaults to broker must break at least 7 tests. Combined Phase 5 test suite: 100 tests green, 16 suites, 1.8s — far exceeding the ≥50 acceptance threshold
- [Phase 05]: Plan 05-10: Phase 5 MOBILE SCOPE COMPLETE — 10/10 plans executed end-to-end. Backend plans 05-0a (GET /history) + 05-0b (GET /users/search) remain open in the separate carEx-services repo; they are the only blocker between this mobile code and a production-ready Phase 5. Phase 6 (Affected-User UX + Security Review) is gated on 05-0a/0b landing
- [Phase 05]: Plan 05-11: UAT Test 3 gap closed (D-11-01 through D-11-05) — AdminModerationScreen migrated from `useDebouncedValue`-driven auto-search to submit-driven search (raw TextInput + Search button + `onSubmitEditing`). `ModerationService.searchUsers` + `getHistory` gain a narrowly-scoped `isAbortError()` guard covering `axios.isCancel` + `CanceledError` + `AbortError`; write methods (suspend/revoke/delete/edit) continue to log all errors intentionally. Initial load STILL fires one `searchUsers({q: undefined})` to preserve "show all users matching filters" UX — the bug was per-keystroke fires, not initial load. `useDebouncedValue` hook + test deleted (zero in-tree consumers). RU/EN `actionSearch` added with parity. Grep invariants green: `useDebouncedValue` in `src/` = 0; `isAbortError(error)` in ModerationService = 2; `submittedQuery` in AdminModerationScreen = 8; `T.actionSearch` = 2; `actionSearch:` in translations = 2
- [Phase 05]: Plan 05-11: TDD RED/GREEN gates honored on both service + screen changes — 5 commits total (test→fix for Task 1; test→feat for Task 2; chore for Task 3). ModerationService 12/12 (was 10, +2 CanceledError tests); AdminModerationScreen 9/9 (was 5, +1 renamed mount test + 3 new submit-contract tests). Full Phase 5 suite minus pre-existing App.test.tsx navigation-stack failure: 20 suites / 149 tests green
- [Phase 05]: Plan 05-11: One deviation auto-fixed — inline comment that mentioned `useDebouncedValue` literally tripped the plan's `grep -c useDebouncedValue = 0` acceptance criterion; comment rephrased to "the previous debounced path" to satisfy the grep-verifiable invariant without losing explanatory intent. One pre-existing failure logged to deferred-items.md (`__tests__/App.test.tsx` — navigation/native-stack `usesNewAndroidHeaderHeightImplementation` TypeError; reproduces on clean main before any 05-11 change)
- [Phase 05]: Plan 05-12: Proactive refresh piggybacks on `refreshUserInternal` head-of-function (not standalone RN timer) — AppState `active` transition fires refreshUser (Plan 04-06); adding the 5-min-pre-expiry check there adds zero new lifecycle surface and inherits single-flight dedupe via the shared `idTokenRefreshInFlightRef`
- [Phase 05]: Plan 05-12: `logoutRef` forward-declaration pattern — mount useEffect registers refresh listener BEFORE `logout` is defined as a useCallback; `useRef<(() => Promise<void>) | null>(null)` + `useEffect([logout])` keeps listener closures stable. Plan's own action text called out this solution explicitly
- [Phase 05]: Plan 05-12: Two separate listener exports (`setIdTokenRefreshListener` + `setLogoutTrigger`) not one combined — cleanly separates "N parallel 401s share ONE refresh" from "second-401-in-a-row means session revoked, logout". Listener returns Promise<string | null>; trigger returns Promise<void>
- [Phase 05]: Plan 05-12: `saveToken` preserved in source for back-compat but DROPPED from both AuthContext test mocks (regression lock) — any future reintroduction via a caller would break Test 11 (`expect((AuthService as any).saveToken).toBeUndefined()`) instead of silently bypassing the new persistence path
- [Phase 05]: Plan 05-12: `refreshIdToken` stays on plain axios (not apiClient) per Firebase Identity Toolkit convention — key-in-query-string surface uses a different auth model than Bearer-in-header; Test 10 asserts `apiClient.post` was NOT called to lock this contract
- [Phase 05]: Plan 05-12: Rule 1 auto-fix — `__tests__/moderation.e2e.integration.test.tsx` mock extended to mirror the new `saveAuthSession` contract after Plan 05-12 migrated AuthContext off `saveToken`. Foreseeable side-effect; 3 previously-green e2e tests (3.1 / 4.1 / 4.3) restored in commit `1cfb50e`; final e2e suite 18/18 green
- [Phase 06]: Plan 06-01: Wave 0 test scaffolds land four files under `__tests__/` — three component scaffolds import from `src/components/moderation/{UserStatusBanner,FeatureGateOverlay,GatedScreenWrapper}` module paths that do not resolve until Wave 2, intentionally coupling the Wave 2 implementation to a compile-time wiring check
- [Phase 06]: Plan 06-01: `GatedScreenWrapper.test.tsx` locks BOTH the `apply_as_provider` frontend alias (resolves to `request_broker_role ∪ request_logistics_role`) AND the `all_writes` sentinel branch via explicit `test.todo` entries — prevents Wave 2 implementers from copying UI-SPEC's buggy implementation sketch; tests will fail if the capability predicate regresses to the single-key-only form (RESEARCH §Capability Contract Verification + §Pitfall 6)
- [Phase 06]: Plan 06-01: `translation-parity.test.ts` ships with REAL assertions (not `test.todo`) — 3/3 green against current 459-key baseline. Uses set-equality (Object.keys + filter) instead of hardcoded count; RESEARCH §Pitfall 8 confirms UI-SPEC's 455 figure is stale
- [Phase 06]: Plan 06-01: 45 combined `test.todo` entries across 3 component scaffolds (16+10+13+6 Task-1-extra beyond plan floor) cover AFF-01 render contract, AFF-02 reason + note, AFF-03 mailto + fallback (encodeURIComponent + setAt literal grep-verifiable), AFF-04 overlay + wrapper predicate. Zero `src/*` changes; zero deviations
- [Phase 06]: Plan 06-01: Requirement IDs AFF-01..04 + QUAL-01 NOT yet marked complete in REQUIREMENTS.md — scaffolds lock the contract but don't implement behavior. Later waves (06-03..06-09) convert `test.todo` → real assertions and land the components; requirement tickoff belongs to those plans
- [Phase 06]: Plan 06-02: Plan's "32 new keys" objective label was a miscount — enumerated action block lists 35 entries (3 banner titles + 1 appealCta + 4 mailto fallback + 2 expand/collapse + 1 restoreProfile + 4 capability families × 6 gate keys = 35). All grep-verifiable `<done>` criteria (gateCreateListing × 6, gateCreateOrder × 6, gateApplyProvider × 6, gateContactSeller × 6 per language) only hold with all 35. Followed enumerated action block (plan-body-wins); RU=EN=494 keys after this plan (not 491)
- [Phase 06]: Plan 06-02: UI-SPEC §Copywriting D-05 strings copied verbatim into both RU and EN blocks — zero paraphrasing, zero wordsmithing. Wave 2 component tests can assert literal string matches against t.bannerTitleFeatureLimited ('Доступ ограничен' / 'Access limited'), etc. if needed
- [Phase 06]: Plan 06-02: Struck keys (appealCopyEmail / appealCopied / appealCancel) confirmed absent (grep count = 0) — UI-SPEC Clipboard Decision definitive; RN 0.83 removed legacy @react-native-community/clipboard and CLAUDE.md forbids new libs this milestone. Single Alert button `appealOk` handles mailto-fallback UX per D-08
- [Phase 06]: Plan 06-02: Phase 5 and earlier keys preserved byte-identical — diff shows only additions at end of each language block; `reasonSpam` / `reasonPolicyViolation` / `reasonFraud` / `reasonOther` NOT re-added (Phase 5 ships them). Banner comment `// ---- Phase 6 — Affected-User UX (UI-SPEC §Copywriting) ----` appears exactly twice (one per language block)
- [Phase 06]: Plan 06-03: UserStatusBanner consumes useAuth() + useLanguage() directly (no moderation props threaded from App.tsx) — mirrors OfflineNotice.tsx global-banner pattern; self-gates on context state so parent mount is a single <UserStatusBanner /> line at Plan 06-06
- [Phase 06]: Plan 06-03: 4px left-accent bar implemented as absolute-positioned sibling View (not borderLeftWidth) so the accent color extends through the insets.top safe-area padding cleanly; UI-SPEC §Component 1 visual contract locked
- [Phase 06]: Plan 06-03: T-06-02 mitigation locked with grep count exactly 2 for encodeURIComponent — subject + body call sites only. Comment mentions scrubbed from source to keep mechanical acceptance grep accurate. Test decodes mailto body and asserts all three required lines (User ID / Reason category / Suspended setAt) present
- [Phase 06]: Plan 06-03: Severity icon + palette + title maps (STATE_TO_PALETTE_KEY / SEVERITY_ICON / STATE_TO_TITLE_KEY) copied verbatim from SeverityBadge.tsx to establish cross-surface consistency; FeatureGateOverlay (06-04) and GatedScreenWrapper (06-05) reuse AlertTriangle/ShieldAlert/Ban + COLORS.moderation
- [Phase 06]: Plan 06-03: Wave-0 scaffold's 16 test.todo entries converted to 19 real GREEN assertions on first run — split note-empty/note-null into two tests and added a third null-render guard for no-moderationStatus; all covered by react-test-renderer + stable Proxy mockT with a small known-overlay for keys needing literal post-interpolation assertions

### Pending Todos

None yet.

### Blockers/Concerns

- Backend language (JS vs. TS) not confirmed — resolve at start of Phase 1 planning (affects Zod inference strategy)
- Existing `Order` schema may lack `providerSnapshot` — inspect before writing Phase 1 migration to determine backfill shape
- Atlas cluster tier — confirm M10+ for txn + auditing support before Phase 1
- Audit note visibility (super-admin vs. all-admin) — decision needed at Phase 2 (Pitfall 12); if no super-admin tier, treat all admins as equal for this milestone
- Railway instance count — if >1 instance, rate limiter must use `rate-limit-redis` (relevant Phase 2)

## Deferred Items

Items acknowledged and carried forward:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Tech debt | Split AuthService.ts god-module | Deferred to future milestone | 2026-04-17 |
| Tech debt | Replace `user: any` typing in AuthContext | Deferred to future milestone | 2026-04-17 |
| Notifications | Email/push on moderation events | v2 — NOTF-01, NOTF-02 | 2026-04-17 |
| Release prep | Stripe pk_test_ → pk_live_ swap | Separate pre-release milestone | 2026-04-17 |

## Session Continuity

Last session: 2026-04-19T08:38:15.744Z
Stopped at: Phase 06 Plan 03 complete (Wave 2 UserStatusBanner component + 19 real test assertions). 2 commits: feat b8207e6 (UserStatusBanner.tsx 314 lines — non-dismissable severity-aware banner, mailto appeal CTA with encodeURIComponent + setAt + Alert fallback, LayoutAnimation expand, useFocusEffect collapse on blur), test ec11163 (16 test.todo → 19 real assertions, all GREEN first run). Delivers AFF-01/02/03. 3 label-level deviations auto-fixed (all comment-only to satisfy strict grep acceptance criteria on encodeURIComponent=2, canOpenURL=0, mailto-url literal); zero functional deviations. Phase 6 test surface: 23 todo (FeatureGateOverlay + GatedScreenWrapper scaffolds — future plans) + 22 passed (UserStatusBanner 19 + translation-parity 3) / 0 failed.
Resume file: (next) .planning/phases/06-affected-user-ux-security-review/06-03-PLAN.md — UserStatusBanner component + real assertions (AFF-01, AFF-02, AFF-03)
