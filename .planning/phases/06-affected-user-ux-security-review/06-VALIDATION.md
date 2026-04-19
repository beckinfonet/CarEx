---
phase: 6
slug: affected-user-ux-security-review
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-19
updated: 2026-04-19
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled by planner during Step 8 from the Validation Architecture section of `06-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.6.3 (react-native preset) + `__tests__/` colocation pattern (mobile); k6 (cross-repo backend load test) |
| **Config file** | `jest.config.js` (mobile); `k6` scripts live in `backend-services/carEx-services/scripts/load-test/` (cross-repo) |
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 06-01 | 0 | AFF-01..03 | — | Banner scaffold locks 13+ behaviors before any code written | jest listTests | `npx jest __tests__/components/moderation/UserStatusBanner.test.tsx --listTests` | ✅ (created) | ⬜ pending |
| 06-01-02 | 06-01 | 0 | AFF-04 | T-06-03 | Overlay + wrapper scaffolds lock alias + all_writes sentinel | jest listTests | `npx jest __tests__/components/moderation/FeatureGateOverlay.test.tsx __tests__/components/moderation/GatedScreenWrapper.test.tsx --listTests` | ✅ (created) | ⬜ pending |
| 06-01-03 | 06-01 | 0 | QUAL-01 | — | Parity set-equality test runs green against Phase 5 baseline | jest real | `npx jest __tests__/translation-parity.test.ts` | ✅ (created) | ⬜ pending |
| 06-02-01 | 06-02 | 1 | QUAL-01 + AFF-* keys | T-06-02 | 32 RU keys added per UI-SPEC Copywriting | grep | `grep -c "bannerTitleFeatureLimited\|gateCreateListing\|appealOk\|restoreProfile" src/constants/translations.ts` | ⬜ | ⬜ pending |
| 06-02-02 | 06-02 | 1 | QUAL-01 | — | 32 EN keys added; parity test remains green | jest | `npx jest __tests__/translation-parity.test.ts` | ⬜ | ⬜ pending |
| 06-03-01 | 06-03 | 2 | AFF-01, AFF-02, AFF-03 | T-06-02 | Banner uses encodeURIComponent; setAt (not updatedAt); no canOpenURL | tsc + grep | `npx tsc --noEmit && grep -c "encodeURIComponent" src/components/moderation/UserStatusBanner.tsx` | ⬜ | ⬜ pending |
| 06-03-02 | 06-03 | 2 | AFF-01, AFF-02, AFF-03 | T-06-02 | Test suite locks mailto contract + severity icons + CTA visibility | jest real | `npx jest __tests__/components/moderation/UserStatusBanner.test.tsx` | ⬜ | ⬜ pending |
| 06-04-01 | 06-04 | 2 | AFF-04 | T-06-03 | Overlay uses dim rgba(15,17,21,0.7) + card borderLeft 4; CTA only on feature_limited | tsc + grep | `npx tsc --noEmit && grep -c "rgba(15, 17, 21, 0.7)\|borderLeftWidth: 4" src/components/moderation/FeatureGateOverlay.tsx` | ⬜ | ⬜ pending |
| 06-04-02 | 06-04 | 2 | AFF-04 | T-06-03 | Capability-key driven copy lookup works across 4×3 matrix | jest real | `npx jest __tests__/components/moderation/FeatureGateOverlay.test.tsx` | ⬜ | ⬜ pending |
| 06-05-01 | 06-05 | 2 | AFF-04 | T-06-03 | Wrapper predicate includes all_writes sentinel AND apply_as_provider alias | tsc + grep | `grep -c "all_writes\|request_broker_role\|request_logistics_role" src/components/moderation/GatedScreenWrapper.tsx` | ⬜ | ⬜ pending |
| 06-05-02 | 06-05 | 2 | AFF-04 | T-06-03 | 12+ tests green covering alias + sentinel + pass-through + pointerEvents | jest real | `npx jest __tests__/components/moderation/GatedScreenWrapper.test.tsx` | ⬜ | ⬜ pending |
| 06-06-01 | 06-06 | 3 | AFF-04 | T-06-03 | SellCarScreen wraps with capability="create_listing" | grep | `grep -c "<GatedScreenWrapper capability=\"create_listing\">" src/screens/SellCarScreen.tsx` | ⬜ | ⬜ pending |
| 06-06-02 | 06-06 | 3 | AFF-04 | T-06-03 | ServiceCartScreen + ServiceApplicationScreen wrap with correct capabilities; no per-role branch | grep + tsc | `grep -c "capability=\"create_order\"" src/screens/ServiceCartScreen.tsx && grep -c "capability=\"apply_as_provider\"" src/screens/ServiceApplicationScreen.tsx` | ⬜ | ⬜ pending |
| 06-07-01 | 06-07 | 3 | AFF-04 | T-06-03 | CarDetails inline gate on TWO CTAs; fade Modal with FeatureGateOverlay | grep | `grep -c "isContactGated\|FeatureGateOverlay capability=\"contact_seller\"" src/screens/CarDetailsScreen.tsx` | ⬜ | ⬜ pending |
| 06-08-01 | 06-08 | 4 | AFF-01 | — | Banner mounted in App.tsx before OfflineNotice + Android LayoutAnimation enable | grep | `grep -c "<UserStatusBanner />\|setLayoutAnimationEnabledExperimental" App.tsx` | ⬜ | ⬜ pending |
| 06-09-01 | 06-09 | 5 | QUAL-01 | — | Jest literal scanner passes against Phase-6-complete state; fault injection triggers failure | jest real | `npx jest __tests__/moderation-literals.test.ts` | ⬜ | ⬜ pending |
| 06-0a-01 | 06-0a | 6 | QUAL-02 | T-06-05 | Seed script idempotent; no hardcoded MONGO_URI | node -c + grep | `node -c backend-services/carEx-services/scripts/seed-moderation-load.js && grep -c "mongodb://\|mongodb+srv://" backend-services/carEx-services/scripts/seed-moderation-load.js` (expect 0) | ⬜ | ⬜ pending (cross-repo) |
| 06-0a-02 | 06-0a | 6 | QUAL-02 | — | verify-indexes.sh uses explain('executionStats') + IXSCAN assertion | bash -n + grep | `bash -n backend-services/carEx-services/scripts/verify-indexes.sh && grep -c "explain('executionStats')" backend-services/carEx-services/scripts/verify-indexes.sh` | ⬜ | ⬜ pending (cross-repo) |
| 06-0b-01 | 06-0b | 6 | QUAL-02 | T-06-05 | k6 harness declares p(95)<200 threshold + auth in setup() only | grep | `grep -c "'p(95)<200'\|export function setup" backend-services/carEx-services/scripts/load-test/admin-search.k6.js` (expect >= 2) | ⬜ | ⬜ pending (cross-repo) |
| 06-0b-02 | 06-0b | 6 | QUAL-02 | T-06-05 | .gitignore excludes load-test token files | grep | `grep -c "scripts/load-test" backend-services/carEx-services/.gitignore` | ⬜ | ⬜ pending (cross-repo) |
| 06-10-01 | 06-10 | 7 | QUAL-03 | T-06-01..05 | Operator collects grep evidence for all 5 ROADMAP §Phase-6 #6 sub-items | manual | Task collects outputs from 5+1 grep commands | N/A | ⬜ pending |
| 06-10-02 | 06-10 | 7 | QUAL-03 | T-06-01..05 | 06-SECURITY.md has exactly 5 sections (a)-(e); every section has Verdict PASS/FAIL | grep | `grep -c "^## (a)\|^## (b)\|^## (c)\|^## (d)\|^## (e)" 06-SECURITY.md` equals 5 | ⬜ | ⬜ pending |

---

## Wave 0 Requirements

- [x] `__tests__/components/moderation/UserStatusBanner.test.tsx` — stubs for AFF-01, AFF-02, AFF-03 (Plan 06-01 Task 1)
- [x] `__tests__/components/moderation/FeatureGateOverlay.test.tsx` — stubs for AFF-04 (Plan 06-01 Task 2)
- [x] `__tests__/components/moderation/GatedScreenWrapper.test.tsx` — stubs for AFF-04 + `all_writes` sentinel branch (Plan 06-01 Task 2)
- [x] `__tests__/translation-parity.test.ts` — QUAL-01 parity guard (Plan 06-01 Task 3) — REAL assertions, passes from day 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mailto opens the mail app with prefilled subject/body | AFF-03 | Requires a physical device with Mail (iOS) / Gmail (Android) installed | Run app, suspend a test user to `blocked_with_review`, tap Appeal CTA, verify mail composer opens with subject `CarEx moderation appeal — <uid>` and body containing UID + reason category + ISO suspended timestamp (setAt) |
| No-mail-app fallback shows Alert with email + UID | AFF-03 | Requires simulator/emulator with no mail app configured | Remove mail app (Android emulator: `adb shell pm disable-user com.google.android.gm`), tap Appeal CTA, confirm Alert shows `appealNoMailTitle` + body with UID |
| Banner live-region announces to VoiceOver/TalkBack | AFF-01 | Accessibility behavior not verifiable in jest | iOS: enable VoiceOver, suspend user, confirm banner is announced; Android: enable TalkBack, same flow |
| Gated screens render overlay without scroll/keyboard regressions | AFF-04 | Nested ScrollView + KeyboardAvoidingView interactions with `pointerEvents="none"` are device-specific | UAT on `SellCarScreen`, `ServiceCartScreen`, `ServiceApplicationScreen` — verify form is non-interactive while scroll still works on iOS + Android |
| CarDetails contact-seller CTAs dim + divert to modal when gated | AFF-04 | Visual + tap behavior on physical device | Suspend user with `contact_seller` in restrictedFeatures; open CarDetails; verify Telegram + WhatsApp buttons both show opacity 0.4, tap either → fade Modal opens with overlay card |
| Banner expand animation on Android | AFF-01 | LayoutAnimation is native-driven; visual inspection only | Suspend user, tap note area on Android; banner should animate height expansion smoothly (LayoutAnimation.easeInEaseOut) |
| Backend load test — P95 < 200ms on 10k-user corpus | QUAL-02 | Cross-repo execution; k6 run produces report artifact | Run `K6_BASE_URL=... K6_ADMIN_IDTOKEN=... k6 run scripts/load-test/admin-search.k6.js` in `backend-services/carEx-services`; verify P95 < 200ms and `explain()` via verify-indexes.sh confirms IXSCAN on 3 target indexes |
| Security review sign-off | QUAL-03 | Requires human verification against ROADMAP 5-criteria (a)-(e) | Operator runs Task 1 grep commands in both repos; writes evidence into 06-SECURITY.md; all 5 sections must PASS |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 component scaffolds + parity test)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (mobile), < 5 min (backend load test)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved (pending checker review)
