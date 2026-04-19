# Phase 6: Affected-User UX + Security Review - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers the mobile-side affected-user experience for moderated users plus three merge-gate quality checks. Two deliverable halves:

**Half A — Affected-user mobile UX** (AFF-01..04)
- A non-dismissable `UserStatusBanner` rendered above `Stack.Navigator` whenever `user.moderationStatus.state !== 'active'`. Copy + CTA adapt to severity (`feature_limited` / `blocked_with_review` / `permanently_banned`).
- A `FeatureGateOverlay` on every screen gated by the Phase 1 capability map (`src/moderation/capabilities.js` / `STATUS_POLICY`) — `SellCarScreen`, `ServiceCartScreen`, `ServiceApplicationScreen`, and the "Contact seller" CTA on `CarDetailsScreen` at minimum. Overlay renders on any non-active severity, not only `feature_limited`.
- An `mailto:support@carexmarket.com` appeal CTA inside the banner for `blocked_with_review`; none for `permanently_banned`.

**Half B — Merge-gate quality checks** (QUAL-01..03)
- RU/EN translation audit across every new user-facing string introduced in Phases 5 and 6.
- Backend load test with 10,000 synthetic users against admin search + moderation history endpoints (cross-repo execution; sister to Phase 5 05-0a/0b pattern).
- Dedicated security review before merge to `main`.

**In scope:**
- `UserStatusBanner` component (mobile) + mount point in `App.tsx` above `OfflineNotice`
- `FeatureGateOverlay` component (mobile) + integration into 4 gated screens
- Capability-keyed overlay copy in `src/constants/translations.ts` (RU + EN)
- Appeal CTA with mailto prefill + no-mail-client fallback
- Translation audit tooling/artifact — QUAL-01
- Backend load test plan + seeding script + pass/fail report — QUAL-02 (backend repo, cross-repo execution)
- Security review artifact (`06-SECURITY.md`) mapping the ROADMAP 6-criteria checklist to verification evidence — QUAL-03

**Out of scope (deferred to future work):**
- Email or push notifications on moderation — deferred per PROJECT.md (in-app only this milestone)
- In-app appeal/ticket form — user appeals via email only
- AuthService god-module split, `user: any` typing, and other tech-debt items called out in CONCERNS.md — separate milestone
- Stripe `pk_test_` → `pk_live_` swap and App Store release prep — separate milestone
- Pre-existing `App.test.tsx` navigation-stack mock failure (logged in Phase 5 `deferred-items.md`) — remains out of scope unless Phase 6 security review explicitly surfaces it

</domain>

<decisions>
## Implementation Decisions

### Area 1 — UserStatusBanner layout & severity treatment

- **D-01:** **Tinted background + 4 px left-accent** visual treatment. Banner bg = severity color at ~10% opacity; left border = severity color at full opacity, 4 px wide. Title + reason category on line 1, truncated note on line 2. Mirrors the Phase 5 moderation `HistoryCard` left-accent pattern (D-13 of 05-CONTEXT) so the admin + affected-user surfaces look like one visual system.
- **D-02:** **Auto-grow to 2 lines of note with truncation + tap-to-expand.** Default height fits title + reason category + up to 2 lines of the admin's verbatim note (ellipsis past that). Tapping the banner body toggles an expanded state showing the full note. Expanded state is per-session (no AsyncStorage persistence) and collapses on navigation away. Non-dismissable per AFF-01 — tap does NOT hide the banner, only toggles expansion.
- **D-03:** **Stack UserStatusBanner above OfflineNotice** when both apply. `App.tsx` wires `<UserStatusBanner />` immediately before `<OfflineNotice />` inside `NavigationContainer` and above `Stack.Navigator`. No merged-banner logic, no severity-vs-connectivity priority rule. Both render independently; both take their own vertical slice.

### Area 2 — FeatureGateOverlay behavior on gated screens

- **D-04:** **Faded + disabled shape.** Gated screen renders its original form beneath a semi-transparent dim layer (~50% opacity, theme-appropriate) with `pointerEvents="none"` on the underlying content. A centered overlay card floats with severity icon + title + body + CTA. Chosen over full-opaque replacement to preserve context ("here's what you would fill in if unrestricted") at the cost of every gated screen needing to render its normal UI in a non-interactive state. Planning should introduce a shared `GatedScreenWrapper` (or equivalent hook) so the dim-layer + overlay-card pattern is reused verbatim across the 4+ gated screens rather than copy-pasted per screen.
- **D-05:** **Capability-key-driven copy.** `<FeatureGateOverlay capability="create_listing" />` — the component looks up title/body/CTA copy from `translations.ts` keyed by `(capability, severity)`. Callers pass only the capability key; no per-screen prop strings. New capability keys added centrally in the translations file. Capability keys must match the identifiers used in Phase 1's `STATUS_POLICY` map so the backend enforcement decisions and the mobile overlay messages stay in lockstep.
- **D-06:** **Same overlay for all non-active severities, severity-aware copy.** FeatureGateOverlay renders on the gated screen regardless of whether the severity is `feature_limited`, `blocked_with_review`, or `permanently_banned`. Body copy adapts:
  - `feature_limited` — resolvable instruction (e.g., "Re-submit your verification documents to restore listing.")
  - `blocked_with_review` — appeal-path message pointing to the banner's Contact support CTA (avoids duplicating the mailto button inside the overlay — the banner owns the CTA).
  - `permanently_banned` — permanent-ban language, no appeal CTA.
  Banner = global reason (ALWAYS visible when state !== active). Overlay = screen-specific next step (visible only on gated screens). The two messages are complementary, not duplicative.

### Area 3 — Appeal CTA + reason display

- **D-07:** **Mailto prefill = Subject `CarEx moderation appeal — {uid}`; body includes `User ID`, `Reason category`, ISO `Suspended` timestamp, and a `[Your message here]` placeholder.** Concrete template:
  ```
  Subject: CarEx moderation appeal — {user.localId}
  Body:
  User ID: {user.localId}
  Reason category: {reasonCategory}
  Suspended: {user.moderationStatus.updatedAt as ISO8601}

  [Your message here]
  ```
  Full templated string assembled with `encodeURIComponent` before passing to `Linking.openURL`. The admin's verbatim note is NOT included in the body (it's already visible in the banner and may read oddly when echoed back by the user).
- **D-08:** **No-mail-client fallback = `Alert.alert` + copy-to-clipboard.** When `Linking.canOpenURL('mailto:...')` returns `false`, show an `Alert.alert` titled "No mail app installed" with a body explaining the user should email `support@carexmarket.com`. The alert has two buttons: "Copy email" (copies `support@carexmarket.com` + UID to clipboard via `@react-native-clipboard/clipboard` if already a dep — otherwise `Clipboard` from `react-native` legacy API; planner chooses based on what's already in the project) and "Cancel". Tapping the CTA button when openURL succeeds opens the mail app normally — the fallback path only fires on the canOpenURL-false branch.

### Claude's Discretion

The user deferred the "Quality gates execution strategy" gray area to planner discretion. Locked defaults + discretion areas:

- **QUAL-01 translation audit tooling** — Claude's discretion. Recommended default: a jest test file (`__tests__/translation-parity.test.ts`) that asserts `Object.keys(translations.RU)` and `Object.keys(translations.EN)` are identical sets, plus a `scripts/audit-literal-strings.sh` grep that scans new moderation files for user-facing literals not wrapped in `t.*`. Pick whichever tooling fits the existing test harness best; may be split across two plans (audit + fix).
- **QUAL-02 cross-repo load test split** — Mirror the Phase 5 D-16 pattern. Plan files live in `.planning/phases/06-affected-user-ux-security-review/` with `autonomous: false` frontmatter for the backend-repo plans (e.g., 06-0a-PLAN.md for the k6/autocannon harness, 06-0b-PLAN.md for seeding script). Mobile-repo plans proceed independently. Pass criteria (ROADMAP §Phase 6 success criterion 5): P95 < 200 ms on admin search + history endpoints with 10k seeded users; `explain()` confirms index use on `moderationStatus.state`, `ModerationAction.targetUid+createdAt`, and `ModerationAction.adminUid+createdAt`.
- **QUAL-03 security review artifact format** — Produce a `06-SECURITY.md` file in the phase directory. Structure: one section per ROADMAP 6-criteria checklist item (verifyIdToken on every admin route / no-trust of body `callerUid` / transactional suspend + confirm-booking / ModerationAction append-only at application layer / no new hardcoded secrets / [one more from ROADMAP]). Each section: (a) what was verified, (b) grep/test evidence, (c) PASS/FAIL verdict. Informal self-review model (no external auditor) unless project stakes justify one.
- **UserStatusBanner icon per severity** — e.g., `AlertTriangle` for `feature_limited`, `Shield` for `blocked_with_review`, `ShieldOff` or `Ban` for `permanently_banned`. Planner picks from `lucide-react-native` (already in stack).
- **Exact dim-layer opacity + color** for D-04 faded overlay (suggest `rgba(17, 24, 39, 0.55)` for dark-theme; planner adjusts against actual theme tokens).
- **FeatureGateOverlay icon/CTA glyph** and expanded-state animation (fade vs slide) for the banner expand gesture.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + requirements
- `.planning/PROJECT.md` — Admin moderation milestone spec, Core Value, Key Decisions (notification-to-affected-user rows, severity model)
- `.planning/REQUIREMENTS.md` — AFF-01..04 + QUAL-01..03 acceptance text (lines 55-64, 151-157, 170)
- `.planning/ROADMAP.md` §Phase 6 — goal + 6 ROADMAP success criteria (see `**Phase 6: Affected-User UX + Security Review (Both)**`)

### Prior phase contracts this UI consumes
- `.planning/phases/01-schema-security-baseline-backend/01-05-SUMMARY.md` (or equivalent) — `STATUS_POLICY` capability map location in backend repo (`src/moderation/capabilities.js`). Mobile overlay keys MUST match backend capability identifiers.
- `.planning/phases/04-mobile-plumbing-mobile/04-CONTEXT.md` — `user.moderationStatus` shape on AuthContext user object; `ModerationError`; 403 interceptor + AppState refresh flow. Banner + overlay read state from the same user object that the 403 interceptor already mutates.
- `.planning/phases/05-admin-moderation-ui-mobile/05-CONTEXT.md` — severity palette defined in `src/constants/theme.ts` under `COLORS.moderation.{active, featureLimited, blockedReview, permaBanned}` with `bg/fg/border` sub-keys. `UserStatusBanner` + `FeatureGateOverlay` MUST import these tokens, not define new colors.
- `.planning/phases/05-admin-moderation-ui-mobile/05-LEARNINGS.md` — §Patterns "Severity palette as single source of truth across phases" + §Decisions "Severity palette defined once in theme.ts for Phase 6 reuse" are load-bearing for this phase's visual consistency.

### Source files being modified or created
- `App.tsx` — banner mount point (above `OfflineNotice`, inside `NavigationContainer`, above `Stack.Navigator`)
- `src/components/OfflineNotice.tsx` — analog for banner mount pattern (already uses `useNetwork` hook inside `NavigationContainer`)
- `src/context/AuthContext.tsx` — exposes `user.moderationStatus`; banner consumes via `useAuth()`
- `src/screens/SellCarScreen.tsx` — gated screen, receives `FeatureGateOverlay` via GatedScreenWrapper
- `src/screens/ServiceCartScreen.tsx` — gated screen
- `src/screens/ServiceApplicationScreen.tsx` — gated screen
- `src/screens/CarDetailsScreen.tsx` — gated "Contact seller" CTA (not full-screen gate; overlay targets the CTA surface only — planner confirms exact gating surface)
- `src/constants/theme.ts` — severity palette (existing, reused verbatim)
- `src/constants/translations.ts` — capability-keyed overlay copy, banner severity copy, mailto placeholder text, audit-reference for QUAL-01
- `src/components/moderation/UserStatusBanner.tsx` (new) — per D-01/D-02/D-03
- `src/components/moderation/FeatureGateOverlay.tsx` (new) — per D-04/D-05/D-06
- `src/components/moderation/GatedScreenWrapper.tsx` (new, recommended per D-04) — shared faded-overlay wrapper

### Platform + library docs
- React Native `Linking.canOpenURL` / `Linking.openURL` — mailto handling for D-07/D-08
- React Native `Clipboard` (legacy) OR `@react-native-clipboard/clipboard` — D-08 fallback clipboard copy (planner picks based on what's already installed; no new dep if avoidable per CLAUDE.md)
- React Native `Modal` with `animationType="fade"` — overlay card animation; matches existing Phase 5 modal patterns
- `lucide-react-native` — severity icons; already in dependency tree per Phase 5

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`OfflineNotice` (App.tsx:86)** — mount pattern for a non-dismissable banner inside `NavigationContainer` above `Stack.Navigator`. `UserStatusBanner` follows the exact same wiring; nothing about the provider stack needs to change.
- **`COLORS.moderation` palette** (`src/constants/theme.ts`, created in Phase 5 Plan 05-02) — `active / featureLimited / blockedReview / permaBanned`, each with `bg / fg / border`. Both banner and overlay read from these tokens; no new color constants required.
- **`EmptyState` component** (`src/components/EmptyState.tsx`, extended in commit `b65ab91`) — has `icon`, `title`, `body`, and `action` props. `FeatureGateOverlay`'s content layout is very close to this shape; planner may reuse `EmptyState` as the inner card of the overlay (wrapped in the dim layer) rather than defining a new card component.
- **`Alert.alert` + legacy `Clipboard`** — available in React Native out of the box; D-08 fallback uses these (no new dep).
- **`useAuth()` hook** — exposes `user.moderationStatus.{state, reasonCategory, note, updatedAt}` on the AuthContext user object. Both banner and overlay consume this directly; no new state wiring.

### Established Patterns
- **Severity-color mapping uses `user.moderationStatus.state` as the discriminator** (established Phase 5 Plan 05-02). Banner + overlay must match admin-side severity color so users see the same thing admins see.
- **Non-dismissable banner pattern** = render unconditionally when the predicate is true; no dismiss state, no AsyncStorage persistence. Established by `OfflineNotice`.
- **Provider stack order** (App.tsx:79-86): `GestureHandlerRootView → SafeAreaProvider → AuthProvider → CartProvider → StripeProvider → LanguageProvider → NavigationContainer → Stack.Navigator`. Banner needs `AuthProvider` (for `user.moderationStatus`) + `LanguageProvider` (for `t.*`) + `NavigationContainer` (for mount location); those are all above the `Stack.Navigator` so the banner wire-up at line 86 is the correct layer.
- **MOB-01 guardrail** (Phase 4, preserved in Phase 5) — all moderation HTTP lives in `ModerationService`. Phase 6 does NOT add new HTTP surface; the banner + overlay are purely presentational. No `AuthService` or `ModerationService` methods change.
- **Capability-key naming** should match the strings used in backend `STATUS_POLICY` so a grep across both repos returns the same hits (Phase 1 Plan 01-04).

### Integration Points
- **Mount point:** `App.tsx` line 86 — `<UserStatusBanner />` inserted immediately before `<OfflineNotice />`.
- **Gated-screen wrapping:** 4 screens (`SellCarScreen`, `ServiceCartScreen`, `ServiceApplicationScreen`, CarDetails "Contact seller" CTA). Planner introduces `GatedScreenWrapper` (or a `useCapabilityGate(capability)` hook) as the integration seam — keeps each screen's diff small and centralizes the dim-layer + pointerEvents logic.
- **Capability-copy table** lives in `src/constants/translations.ts` under two new top-level keys (`gateCopy` / `bannerCopy`), each keyed by `{capability}.{severity}` for overlay and `{severity}` for banner. QUAL-01 audit scopes itself to these two sub-trees plus any `Text` literals in the new components.
- **Appeal mailto** uses existing React Native `Linking` module; no navigation changes.

</code_context>

<specifics>
## Specific Ideas

- **Banner visual echo of admin HistoryCard** — user deliberately chose D-01 (tinted + left-accent) to match the Phase 5 moderation HistoryCard. This is a cross-surface visual consistency commitment, not just a stylistic preference; planner/researcher should treat it as a locked pattern and not re-litigate.
- **"Context preservation over test simplicity"** — D-04 (faded + disabled overlay shape) was chosen over the opaque-replacement alternative specifically because the user wants gated users to see what they're missing. Testing the dim-layer + pointerEvents path is more work than a clean replacement — accept that cost; do not silently switch to replacement during planning.
- **Banner + overlay messages are complementary** (D-06) — banner = global "why you're here", overlay = screen-local "what to do next". Avoid duplicating the mailto CTA inside the overlay card; the banner owns it.
- **Appeal body must NOT echo the admin's verbatim note** (D-07) — the note is already visible to the user in the banner; echoing it back in their email opener can read oddly and biases their appeal wording.

</specifics>

<deferred>
## Deferred Ideas

Ideas that came up during the meta-analysis but belong in other phases or later milestones:

- **In-app notification (push or modal) on sign-in after a moderation action lands** — user might not notice the banner immediately if they're deep in a flow. A one-time modal on first post-moderation sign-in was considered but deferred; the banner on every screen is the milestone's commitment to "no email or push". Revisit if Phase 6 UAT surfaces that users miss the banner.
- **Capability-map surface beyond the 4 called-out screens** — other screens may host "gate-worthy" actions (MyListings edit buttons, ServiceDetails booking button, etc.). The ROADMAP success criteria name 4 specific surfaces; extending beyond them is Claude's discretion during planning if the capability map directly indicates it, but not a required scope item.
- **Deep-link guard for gated screens** — a user with `feature_limited` tapping a `carex://listing/:id` link and then the "Contact seller" CTA should still see the overlay (ordinary component-level gating handles this). A stricter variant where the navigation itself is denied was considered in the overlay question (option "Deny at navigation") and rejected in favor of the per-screen overlay pattern. If future phases need a hard nav-level gate, design it against the navigation listener, not the component.
- **Backend 05-0a/0b landing as Phase 6 execution pre-requisite** — not a scope item for Phase 6, but the mobile UX cannot be validated end-to-end until those two Phase 5 backend plans ship in `backend-services/carEx-services`. STATE.md already tracks this as the Phase 6 execution blocker. Discussion-time is fine; execution-time must wait.
- **Deferred tech-debt items from Phase 5 `deferred-items.md`** — `App.test.tsx` navigation-stack failure, `AdminDashboardScreen` `react-hooks/exhaustive-deps` lint error, the 16 inline-styles warnings, `ModerationService.restoreRole` dead method. None are Phase 6 scope; the security review (QUAL-03) may surface them but does not block on them.

</deferred>

---

*Phase: 06-affected-user-ux-security-review*
*Context gathered: 2026-04-18*
