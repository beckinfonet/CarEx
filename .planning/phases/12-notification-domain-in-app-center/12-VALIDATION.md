---
phase: 12
slug: notification-domain-in-app-center
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Split-repo: backend tests run in the sibling repo `carEx-services`; mobile tests run in this repo.

---

## Test Infrastructure

**Backend** (`carEx-services` — sibling repo):

| Property | Value |
|----------|-------|
| **Framework** | Jest `^29.7.0` (`testEnvironment: node`, `testTimeout: 30000`) |
| **Config file** | `package.json` `jest` field |
| **Quick run command** | `npx jest src/notifications/__tests__/<file>.test.js` |
| **Full suite command** | `npm test` |
| **DB fixture** | `mongodb-memory-server` (+ `__tests__/_helpers/mongoReplSet.js` for transactions) |
| **Estimated runtime** | ~30–60 seconds (quick), full suite longer |

**Mobile** (this repo):

| Property | Value |
|----------|-------|
| **Framework** | Jest (react-native preset, `@react-native`) |
| **Config file** | `package.json` test script |
| **Quick run command** | `npx jest path/to/file` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~20–40 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific new test file (`npx jest <file>`)
- **After every plan wave:** Run `npm test` in the touched repo
- **Before `/gsd-verify-work`:** Both repos' full suites must be green (backend tests run in the sibling repo — see split-repo deploy gotcha)
- **Max feedback latency:** ~60 seconds (quick run)

---

## Per-Task Verification Map

> Filled in during planning — task IDs assigned by the planner. Seeded from RESEARCH.md §Validation Architecture below.

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| NDOM-03 | Suppress emit for hidden/suspended/archived listing (plain `findById` null) | unit (backend) | `npx jest src/notifications/__tests__/guards.test.js` | ❌ W0 |
| NDOM-03 | Actor-exclusion (seller editing own price → 0 self-notifs) | unit (backend) | `npx jest src/notifications/__tests__/actorExclusion.test.js` | ❌ W0 |
| NDOM-03 | Dedup: 3 edits → ≤1 alert per watcher | unit (backend) | `npx jest src/notifications/__tests__/dedup.test.js` | ❌ W0 |
| NDOM-04 | `matchSavedSearches` pure-function matching | unit (backend) | `npx jest src/notifications/__tests__/matchSavedSearches.test.js` | ❌ W0 |
| NSUB-04 | Price-drop only on decrease (direction check) | unit (backend) | `npx jest src/notifications/__tests__/priceDirection.test.js` | ❌ W0 |
| NDOM-05 | Router uid-scoped from token, not admin-gated | integration (backend) | `npx jest src/notifications/__tests__/router.test.js` | ❌ W0 |
| NCEN-02 | Cursor pagination correctness | integration (backend) | `npx jest src/notifications/__tests__/feedCursor.test.js` | ❌ W0 |
| NI18N-03 | Backend RU/EN parity + KGS som | unit (backend) | `npx jest __tests__/notification-translations-parity.test.js` | ❌ W0 |
| NI18N-01 | `language` accepted by `PUT /api/users/:uid` | integration (backend) | `npx jest __tests__/userLanguage.test.js` | ❌ W0 |
| NI18N-02/03 | Mobile RU/EN parity for new keys | unit (mobile) | `npx jest __tests__/translation-parity.test.ts` | ✅ extend |
| NCEN-01/07 | Badge derives from context unread; feed renders | component (mobile) | `npx jest src/context/__tests__/NotificationContext.test.tsx` | ❌ W0 |
| NSUB-04 | Watch keys on `car._id\|\|car.id\|\|carId` | component (mobile) | `npx jest src/components/notifications/__tests__/WatchButton.test.tsx` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend `src/notifications/__tests__/` scaffolds for guards, actorExclusion, dedup, matchSavedSearches, priceDirection, router, feedCursor (`test.todo` placeholders importing not-yet-existing modules — mirrors Phase 5 Wave 0 pattern)
- [ ] Backend `__tests__/notification-translations-parity.test.js` (mirror mobile `translation-parity.test.ts`)
- [ ] Backend `__tests__/userLanguage.test.js`
- [ ] Mobile `src/context/__tests__/NotificationContext.test.tsx`, `src/components/notifications/__tests__/WatchButton.test.tsx`, `NotificationService` test
- [ ] Extend existing mobile `__tests__/translation-parity.test.ts` (already green; new keys auto-covered by set-equality)
- [ ] No framework install needed — jest present in both repos

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Header bell unread badge visual accuracy across login/logout | NCEN-01 | Visual + auth-state interaction; component test covers logic, not pixels | Log in as buyer with unread notifs → bell shows count; open feed → tap → badge decrements; log out/in → badge re-derives |
| Watch control visually distinct from Favorite heart | NSUB-02 | Visual distinction is a design judgment | Open CarDetails → confirm Watch control is visually separate from Favorite heart |
| Deep-link from Saved Search notification → results | NSUB-01 | Requires end-to-end nav from a real notification | Create saved search → trigger match → tap in-app notification → lands on filtered results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
