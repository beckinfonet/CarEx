---
phase: 15
slug: broadcast-new-listing-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 15-RESEARCH.md "## Validation Architecture". This is a split-repo phase —
> most logic lives in backend `carEx-services` (Jest, node env); the mobile side is one toggle.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | Jest, `testEnvironment: node`, `testTimeout: 30000` (config in `carEx-services/package.json` jest block) |
| **Framework (mobile)** | Jest, react-native preset (`carEx/package.json`) |
| **Config file** | backend: `package.json` jest block · mobile: `package.json` (react-native preset) |
| **Quick run command (backend)** | `npx jest src/notifications/__tests__/broadcast.test.js` (run from `carEx-services`) |
| **Quick run command (mobile)** | `npx jest src/screens/__tests__/NotificationSettingsScreen` (run from `carEx`) |
| **Full suite command** | backend: `npm test` (in `carEx-services`) · mobile: `npm test` + `npm run lint` (in `carEx`) |
| **Estimated runtime** | backend quick ~3–8s · backend full ~30–60s · mobile quick ~5s |

**Test style:** mirror `guards.test.js` dependency-injection — `emit(event, { Car, Notification, DeviceToken, User, fcm, matchSavedSearches })` with stubs, **no live DB**.

---

## Sampling Rate

- **After every task commit:** Run `npx jest src/notifications/__tests__/broadcast.test.js` (+ parity tests if `translations.js` touched)
- **After every plan wave (backend):** Run `npm test` in `carEx-services`
- **After every plan wave (mobile):** Run `npm test` + `npm run lint` in `carEx`
- **Before `/gsd-verify-work`:** Both full suites green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Task IDs are filled in by the planner; this maps each SPEC requirement to its automated proof.

| Req | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| Req 1 | 0→1 | Broadcast audience = token-holders, actor excluded | — | Seller never in resolved audience | unit | `npx jest .../broadcast.test.js -t "audience excludes actor"` | ❌ W0 | ⬜ pending |
| Req 2 | 0→1 | Saved-search-matched uid gets new_match only, not broadcast | — | No double-notify; saved-search wins | unit | `... -t "saved-search wins dedup"` | ❌ W0 | ⬜ pending |
| Req 3 | 0→1 | Each eligible non-capped recipient → 1 row + 1 fcm.send | — | Exactly one push + one in-app row | unit | `... -t "row + push per recipient"` | ❌ W0 | ⬜ pending |
| Req 4 | 0→1 | At cap → row written `pushSuppressed:true`, no fcm.send | T-cap-DoS | In-app uncapped; push suppressed at cap | unit | `... -t "over cap suppresses push not row"` | ❌ W0 | ⬜ pending |
| Req 4 | 0→1 | Cap counts since Asia/Bishkek morning boundary; cap value = user `dailyCap` (default 3) | — | Self-resetting date-bounded count | unit | `... -t "cap counts since bishkek boundary"` | ❌ W0 | ⬜ pending |
| Req 5 | 0→1 | `newListingEnabled:false`→no row/push; absent field→enabled | — | `$ne:false` legacy-doc default-on | unit | `... -t "opt-out suppresses; legacy doc enabled"` | ❌ W0 | ⬜ pending |
| Req 5 | 0→1 | `PUT /api/users/:uid` persists `notificationPrefs` (all toggles) | T-mass-assign | Allowlist + type-check; IDOR-safe on `req.params.uid` | unit/integration | `... -t "persists notificationPrefs"` | ❌ W0 | ⬜ pending |
| Req 6 | 0→1 | Hidden/non-active car → 0 broadcast rows/pushes | T-TOCTOU | Reuse hide-hook'd `visible` Car | unit | extend `guards.test.js` | ⚠ extend | ⬜ pending |
| Req 6 | 0→1 | No hide-hook bypass flag in broadcast branch source | T-bypass | grep gate `/includeAll(Users|ListingStatuses)/` never matches | grep gate | extend `guards.test.js:83` | ⚠ extend | ⬜ pending |
| Req 7 | 0→1 | `push_new_listing` RU/EN parity, no `{param}` token | T-PII-leak | Generic param-free copy | unit | `npx jest __tests__/push-copy-parity.test.js` | ✅ existing | ⬜ pending |
| Req 3/7 | 0→1 | dedupeKey `${carId}:new_listing_broadcast` ≠ `${carId}:new_match` | — | No collision with saved-search rows | unit | `... -t "broadcast dedupeKey no collision"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `carEx-services/src/notifications/__tests__/broadcast.test.js` — covers reqs 1–5 + dedupeKey isolation, DI-style (no DB)
- [ ] Extend `carEx-services/src/notifications/__tests__/guards.test.js` — assert the broadcast branch uses plain `Car.findById` and the grep gate still passes with the new branch present (req 6)
- [ ] Backend handler test for `PUT /api/users/:uid` persisting `notificationPrefs` (no existing prefs-handler test)
- [ ] Mobile: render/persist test for the new "New Listings" toggle calling `AuthService.updateBackendUser({ notificationPrefs: { newListingEnabled } })`
- [ ] `push-copy-parity.test.js` auto-covers the new `push_new_listing` key (scans all `push_*`) — confirm it includes it, no new file needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end: create active listing → second device receives OS push + bell entry, deep-links to `carex://search` | Req 3, D-07 | Real FCM delivery + OS push surface cannot be unit-tested | On a token-registered device (not the seller), create a new active listing from another account; confirm one push arrives, tapping opens newest-first browse, and the bell shows one new entry |
| Cap behavior across a real day boundary | Req 4 | Asia/Bishkek wall-clock rollover | Drive a user to cap (≥ dailyCap broadcasts in one Bishkek day), confirm further listings show in-bell but no push; after 08:00 Bishkek next day, confirm pushes resume |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (broadcast.test.js, guards extension, prefs-handler test, mobile toggle test)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
