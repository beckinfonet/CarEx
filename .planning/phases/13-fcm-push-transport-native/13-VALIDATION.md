---
phase: 13
slug: fcm-push-transport-native
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `13-RESEARCH.md` § Validation Architecture. **Most NPUSH criteria are real-device, NOT Jest-testable** — they live in `13-HUMAN-UAT.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 (mobile: `preset: react-native`; backend: jest ^29.7.0) |
| **Config file** | mobile `jest.config.js`; backend `package.json` jest block |
| **Quick run command** | `npx jest path/to/file` |
| **Full suite command** | `npm test` (run in each affected repo) |
| **Estimated runtime** | ~30–60 seconds per repo |

---

## Sampling Rate

- **After every task commit:** `npx jest` on the touched test file (backend send loop, push-copy parity, PushService logic, pre-prompt logic).
- **After every plan wave:** `npm test` (full suite, each affected repo).
- **Before `/gsd-verify-work`:** Full suite green in BOTH repos AND the `13-HUMAN-UAT.md` real-device checklist signed off.
- **Max feedback latency:** ~60 seconds (automated); device UAT is gated, not sampled.

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | Where |
|--------|----------|-----------|-------------------|-------|
| NPUSH-01 | Release archive runs on device, Stripe checkout intact | manual (real device) | — | HUMAN-UAT |
| NPUSH-02 | RNFB installed; channel/perms/entitlements declared | build + manual | `cd ios && pod install`; gradle build | Wave 0 / UAT |
| NPUSH-03 | APNs delivers a push to a real device | manual (real device) | — | HUMAN-UAT |
| NPUSH-04 | token register/refresh/unregister ordering (unregister before idToken clears) | unit (logic) + manual (token) | `npx jest .../PushService.test` | Wave 0 |
| NPUSH-05 | send loop prunes bad tokens, never aborts fan-out, backs off on 429 | unit (backend, mock firebase-admin) | `npx jest src/notifications/push/fcm.test.js` | Wave 0 |
| NPUSH-06 | foreground / background / quit states handled | manual (real device) | — | HUMAN-UAT |
| NPUSH-07 | cold-start tap → correct CarDetails | manual (real device) | — | HUMAN-UAT |
| NPUSH-08 | generic PII-safe body; send-time TOCTOU moderation re-check | unit (backend: assert no PII tokens in push payload; parity) | `npx jest src/notifications/__tests__/push-copy-parity.test.js` | Wave 0 |
| NPRF-06 | pre-prompt fires once; "Not now" never auto-re-asks | unit (mobile, mock RNFB) | `npx jest .../prePrompt.test` | Wave 0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend src/notifications/push/fcm.test.js` — send loop: prune on `registration-token-not-registered` / `invalid-argument`, never-abort-on-one-bad-token, bounded backoff on 429 (mock firebase-admin) — covers **NPUSH-05**.
- [ ] `backend src/notifications/__tests__/push-copy-parity.test.js` — generic `push_*` keys RU/EN parity + ASSERT no `{makeModel}` / `{price}` tokens in push copy — covers **NPUSH-08 / D-08b**.
- [ ] `backend` device-token route tests (register/unregister; uid derived from verified Bearer, IDOR-safe).
- [ ] `mobile PushService.test.ts` — token register/unregister ordering vs logout idToken-clear — covers **NPUSH-04** logic.
- [ ] `mobile prePrompt.test.tsx` — fires once on first sub; "Not now" persists never-re-ask — covers **NPRF-06**.
- [ ] `13-HUMAN-UAT.md` — real-device checklist for NPUSH-01 / 03 / 06 / 07 (non-automatable criteria).

---

## Manual-Only Verifications (→ 13-HUMAN-UAT.md)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Static-frameworks Release archive builds + runs, Stripe checkout works | NPUSH-01 | Native build + real-device Release only | Build archive with `use_frameworks! :linkage => :static`; install on device; complete a Stripe test checkout |
| Real device receives an instant push with PII-safe body | NPUSH-03 | APNs/FCM transport needs real device | Trigger a saved-search/Watch match; confirm lock-screen body has NO make/model/price/location |
| Foreground / background / quit tap handling | NPUSH-06 | RNFB native handlers can't run in Jest | Send push in each app state; confirm each handled |
| Cold-start tap opens correct CarDetails | NPUSH-07 | `getInitialNotification()` requires real launch | Kill app; tap push; confirm correct car opens via `linking` |

---

## Validation Sign-Off

- [ ] All automatable requirements have a Wave 0 test or existing coverage
- [ ] Sampling continuity: no 3 consecutive automatable tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 test files + HUMAN-UAT)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 lands

**Approval:** pending
