# Phase 6: Affected-User UX + Security Review - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `06-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 06-affected-user-ux-security-review
**Areas discussed:** Banner layout & severity treatment, FeatureGateOverlay behavior, Appeal CTA + reason display

---

## Gray Area Selection

**Presented options:**

| Option | Description | Selected |
|--------|-------------|----------|
| Banner layout & severity treatment | Banner mount position (OfflineNotice analog locked), height, visual treatment per severity | ✓ |
| FeatureGateOverlay behavior | Overlay shape (opaque / faded / deny-at-nav), copy source, per-screen interaction, severity coverage | ✓ |
| Appeal CTA + reason display | Mailto prefill, no-mail-client fallback, reason layout in banner | ✓ |
| Quality gates execution strategy | Translation-audit tooling, cross-repo split for load test, security-review artifact format | (deferred to Claude's Discretion) |

---

## Banner Layout & Severity Treatment

### Q1 — Visual treatment per severity

| Option | Description | Selected |
|--------|-------------|----------|
| Solid severity bar | Full-width bar filled with severity bg; title + note in fg color. iOS/Android system alert styling. | |
| Tinted + left-accent | Soft tinted bg (~10% severity) + 4 px full-severity left border. Matches Phase 5 HistoryCard pattern. | ✓ |
| Icon-led minimal | Thin bar with severity icon + single-line title; tap to expand reason + note. | |

**User's choice:** Tinted + left-accent (recommended)
**Notes:** Visual echo of Phase 5 moderation HistoryCard drives cross-surface consistency. Captured in 06-CONTEXT.md §Specifics as a locked pattern.

---

### Q2 — Height behavior with variable note length

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-grow, truncated | Grows to fit title + reason + 2 lines of note; tap expands full note. | ✓ |
| Fixed compact | Always 2-line fixed height; long notes truncate with no expand path. | |
| Fully auto-grow | No truncation; long notes eat ≥20% screen height. | |

**User's choice:** Auto-grow, truncated (recommended)
**Notes:** Captured as D-02 — tap-to-expand is per-session (no AsyncStorage persistence), collapses on nav-away, non-dismissable per AFF-01.

---

### Q3 — Coexistence with OfflineNotice

| Option | Description | Selected |
|--------|-------------|----------|
| Stack: UserStatus above Offline | Both render independently above Stack.Navigator. | ✓ |
| Offline wins when offline | Hide UserStatusBanner while offline; reduces clutter but may imply suspension lifted. | |
| Single merged banner | One slot; priority rule. Tight coupling, reduced information parity. | |

**User's choice:** Stack: UserStatus above Offline (recommended)
**Notes:** Captured as D-03 — `<UserStatusBanner />` immediately before `<OfflineNotice />` in App.tsx.

---

## FeatureGateOverlay Behavior

### Q1 — Overlay shape on gated screens

| Option | Description | Selected |
|--------|-------------|----------|
| Opaque replacement | Full-screen overlay replaces form entirely; simplest testing. | |
| Faded + disabled | Form visible behind dim layer + `pointerEvents=none`; overlay card floats centered. | ✓ |
| Deny at navigation | Tap on entry shows Alert; gated screen never mounts. Inconsistent with deep links. | |

**User's choice:** Faded + disabled (NOT the recommended opaque option)
**Notes:** User deliberately chose context preservation over test simplicity. Captured in 06-CONTEXT.md §Specifics as a locked tradeoff — do not silently switch to replacement during planning. D-04 mandates a shared `GatedScreenWrapper` so the dim-layer + overlay pattern is centralized rather than copy-pasted per screen.

---

### Q2 — Copy source for overlay content

| Option | Description | Selected |
|--------|-------------|----------|
| Capability-key mapping | `<FeatureGateOverlay capability="create_listing" />` looks up copy from translations keyed by (capability, severity). | ✓ |
| Per-screen hard-coded copy | Each screen passes title/body/cta as props. | |
| Hybrid: shared defaults + per-screen override | Both sources coexist; two sources of truth. | |

**User's choice:** Capability-key mapping (recommended)
**Notes:** Captured as D-05 — capability keys must match Phase 1 `STATUS_POLICY` identifiers so mobile overlay and backend enforcement stay in lockstep.

---

### Q3 — Severity coverage (AFF-04 says feature_limited; what about the other two?)

| Option | Description | Selected |
|--------|-------------|----------|
| Same overlay, severity-aware copy | Overlay renders on ALL non-active severities; body adapts per severity. | ✓ |
| Overlay only for feature_limited | Banner-only for blocked_with_review / permanently_banned; gated screens render normal UI with server-side no-op. Produces dead-end screens. | |
| Block navigation for blocked_with_review / permanently_banned | Navigation refused; inconsistent enforcement across two mechanisms. | |

**User's choice:** Same overlay, severity-aware copy (recommended)
**Notes:** Captured as D-06 — banner = global reason; overlay = screen-specific next step. Complementary messages, not duplicative. Overlay body for blocked_with_review points users to the banner's Contact support CTA rather than duplicating the mailto button.

---

## Appeal CTA + Reason Display

### Q1 — Mailto prefill contents

| Option | Description | Selected |
|--------|-------------|----------|
| UID + reason + timestamp | Subject: `CarEx moderation appeal — {uid}`; body includes UID, reason category, ISO timestamp, placeholder. | ✓ |
| UID only | Subject: `CarEx moderation appeal`; body = `User ID: {uid}`. Minimal. | |
| UID + reason + note + timestamp | Adds admin's verbatim note to body. Duplicates banner content; admin-side wording may read oddly. | |

**User's choice:** UID + reason + timestamp (recommended)
**Notes:** Captured as D-07 — verbatim admin note intentionally NOT included in mailto body per §Specifics. All fields URL-encoded before passing to `Linking.openURL`.

---

### Q2 — No-mail-client fallback behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Alert + copy-to-clipboard | Alert.alert with support email + "Copy email" button that puts email + UID on clipboard. | ✓ |
| Alert with email address only | Simple alert; no clipboard. User must memorize or screenshot. | |
| Silent no-op + always-visible support email | Render support email as selectable text; button sometimes does nothing. Bad UX. | |

**User's choice:** Alert + copy-to-clipboard (recommended)
**Notes:** Captured as D-08 — Clipboard API choice (`@react-native-clipboard/clipboard` vs legacy `Clipboard` from `react-native`) left to planner based on existing dependency tree; no new dep added if avoidable per CLAUDE.md.

---

## Claude's Discretion

User explicitly deferred **Quality Gates Execution Strategy** to planner discretion. Defaults recorded in 06-CONTEXT.md §Claude's Discretion:

- QUAL-01 translation audit — jest translation-parity test + grep script for literal strings
- QUAL-02 load test — cross-repo split mirroring Phase 5 05-0a/0b pattern (mobile plans run here, backend plans `autonomous: false` execute in `backend-services/carEx-services`)
- QUAL-03 security review — `06-SECURITY.md` artifact mapping ROADMAP 6-criteria to PASS/FAIL evidence, informal self-review model

Additional Claude's-Discretion items: per-severity icon choices (`AlertTriangle` / `Shield` / `ShieldOff` from `lucide-react-native`), exact dim-layer opacity token, expanded-banner animation style, GatedScreenWrapper API shape vs a `useCapabilityGate` hook equivalent.

---

## Deferred Ideas

Surfaced during meta-analysis, captured in 06-CONTEXT.md §Deferred:

- In-app notification/modal on first post-moderation sign-in (not in milestone scope — banner on every screen is the commitment)
- Capability-map surface beyond the 4 ROADMAP-named screens (Claude's discretion during planning if map directly indicates)
- Deep-link-level nav guard (rejected in favor of component-level overlay pattern; revisit in future phase if needed)
- Backend 05-0a/0b landing as Phase 6 execution prerequisite (not Phase 6 scope; STATE.md tracks)
- Phase 5 `deferred-items.md` items (`App.test.tsx` nav-stack failure etc. — not Phase 6 scope; QUAL-03 may surface but not block)
