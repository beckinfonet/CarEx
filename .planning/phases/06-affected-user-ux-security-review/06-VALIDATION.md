---
phase: 6
slug: affected-user-ux-security-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled by planner during Step 8 from the Validation Architecture section of `06-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.6.3 (react-native preset) + `__tests__/` colocation pattern (mobile); k6 (cross-repo backend load test) |
| **Config file** | `jest.config.js` (mobile); `k6` scripts live in `backend-services/carEx-services/loadtest/` (cross-repo) |
| **Quick run command** | `npx jest --findRelatedTests <changed-files>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (mobile unit/component); ~5 minutes (k6 10k-user load run, manual) |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --findRelatedTests <changed-files>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green; QUAL-02 load test report attached; QUAL-03 security review signed
- **Max feedback latency:** ~30 seconds (mobile); ~5 minutes (backend load test, runs once per phase)

---

## Per-Task Verification Map

> Filled by gsd-planner during Step 8. One row per task across all Phase 6 plans.
> Columns: Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

---

## Wave 0 Requirements

> Planner fills with the exact test stub file list needed before feature work begins.
> Expected set (from research):
- [ ] `__tests__/components/moderation/UserStatusBanner.test.tsx` — stubs for AFF-01, AFF-02, AFF-03
- [ ] `__tests__/components/moderation/FeatureGateOverlay.test.tsx` — stubs for AFF-04
- [ ] `__tests__/components/moderation/GatedScreenWrapper.test.tsx` — stubs for AFF-04 + `all_writes` sentinel branch
- [ ] `__tests__/translation-parity.test.ts` — QUAL-01 parity guard (set equality on RU vs EN keys)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mailto opens the mail app with prefilled subject/body | AFF-03 | Requires a physical device with Mail (iOS) / Gmail (Android) installed | Run app, suspend a test user to `blocked_with_review`, tap Appeal CTA, verify mail composer opens with subject `CarEx moderation appeal — <uid>` and body containing UID + reason category + ISO suspended timestamp |
| No-mail-app fallback shows Alert with email + UID | AFF-03 | Requires simulator/emulator with no mail app configured | Remove mail app (Android emulator: `adb shell pm disable-user com.google.android.gm`), tap Appeal CTA, confirm Alert shows `t.appealNoMailTitle` + body with UID |
| Banner live-region announces to VoiceOver/TalkBack | AFF-01 | Accessibility behavior not verifiable in jest | iOS: enable VoiceOver, suspend user, confirm banner is announced; Android: enable TalkBack, same flow |
| Gated screens render overlay without scroll/keyboard regressions | AFF-04 | Nested ScrollView + KeyboardAvoidingView interactions with `pointerEvents="none"` are device-specific | UAT on `SellCarScreen`, `ServiceCartScreen`, `ServiceApplicationScreen` — verify form is non-interactive while scroll still works on iOS + Android |
| Backend load test — P95 < 200ms on 10k-user corpus | QUAL-02 | Cross-repo execution; k6 run produces report artifact | Run `k6 run loadtest/admin-moderation.js` in `backend-services/carEx-services`; verify P95 < 200ms and `explain()` confirms index use on `moderationStatus.state`, `ModerationAction.targetUid+createdAt`, `ModerationAction.adminUid+createdAt` |
| Security review sign-off | QUAL-03 | Requires human verification against ROADMAP 5-criteria (a)-(e) | Produce `06-SECURITY.md` per template from research; human marks PASS/FAIL on each sub-item with grep/test evidence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (mobile), < 5 min (backend load test)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
