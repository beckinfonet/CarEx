# Roadmap: CarEx

## Milestones

- ✅ **v1.0 — Admin Moderation** — Phases 1-6 (shipped 2026-04-30) — see [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Admin Listing Moderation** — Phases 7-11 (shipped 2026-06-06) — see [.planning/milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 📋 **v1.2 — Notifications** — Phases 12-14 (planning) — in-app notification center + FCM push; design spec at [docs/superpowers/specs/2026-06-06-notifications-system-design.md](../docs/superpowers/specs/2026-06-06-notifications-system-design.md)

## Phases

<details>
<summary>✅ v1.0 Admin Moderation (Phases 1-6) — SHIPPED 2026-04-30</summary>

- [x] Phase 1: Schema + Security Baseline (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 2: Admin Moderation Endpoints (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 3: Backend Enforcement (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 4: Mobile Plumbing (Mobile) — 7/7 plans — completed 2026-04-18, real-device UAT 2026-04-30
- [x] Phase 5: Admin Moderation UI (Mobile + cross-repo) — 14/14 plans — completed 2026-04-18
- [x] Phase 6: Affected-User UX + Security Review (Both) — 10/12 plans (06-0a + 06-0b deferred per QUAL-02) — security review APPROVED 2026-04-19

</details>

<details>
<summary>✅ v1.1 Admin Listing Moderation (Phases 7-11) — SHIPPED 2026-06-06</summary>

- [x] Phase 7: Listing Schema + Security Baseline (Backend) — 6/6 plans — completed 2026-05-29
- [x] Phase 8: Admin Listing Moderation Endpoints (Backend) — 6/6 plans — completed 2026-05-29
- [x] Phase 9: Backend Read-time + TOCTOU Enforcement — 5/5 plans — completed 2026-05-29
- [x] Phase 10: Mobile Plumbing + Admin Listing UI — 12/12 plans — completed 2026-05-29
- [x] Phase 11: Buyer-affected UX + Quality + Security Review — 8/8 plans — security review APPROVED, completed 2026-05-29

</details>

### 📋 v1.2 Notifications (Phases 12-14) — IN PLANNING

Design spec: [docs/superpowers/specs/2026-06-06-notifications-system-design.md](../docs/superpowers/specs/2026-06-06-notifications-system-design.md). Research: [.planning/research/v1.2/SUMMARY.md](research/v1.2/SUMMARY.md). Phase numbering continues from v1.1 (which ended at Phase 11).

- [ ] **Phase 12: Notification Domain + In-App Center (pure REST, zero native)** — 3-model domain, after-commit emit hooks with guards, subscriptions (Saved Search + Watch), in-app feed/bell, preferences, server-side i18n. `fcm.send` is a no-op stub; the in-app center is fully usable standalone (the denied-permission fallback).
- [ ] **Phase 13: FCM Push Transport (native)** — iOS Podfile static-frameworks gate spike (first, rollback-checkpointed, real-device Release archive), RNFB 24.x install, APNs config, firebase-admin send loop, device-token lifecycle, 3-state handling, contextual permission prompt, cold-start deep-link.
- [ ] **Phase 14: Daily Digest & Scheduling** — in-process `node-cron` digest worker, atomic per-user flush, fixed Asia/Bishkek morning hour, 90-day prune. Enables the daily-cadence selector shipped disabled in Phase 12.

## Phase Details

### Phase 12: Notification Domain + In-App Center
**Goal**: Buyers can subscribe to inventory (Saved Search) and watch specific cars, then see relevant events in an in-app notification center — entirely over REST, with zero native code, so the center works standalone as the eventual denied-push fallback.
**Depends on**: Phase 11 (reuses v1.1 hide-hook, base64 `{createdAt,_id}` cursor, ModerationService split precedent, `firebase-admin` already installed for later send creds, `confirmBooking` TOCTOU pattern).
**Requirements**: NDOM-01..06, NSUB-01..04, NCEN-01..06, NPRF-01..05, NPRF-07, NI18N-01..03
**Success Criteria** (what must be TRUE):
  1. A buyer who taps "Notify me about new matches" from filtered results gets a Saved Search; when a *new* matching active listing is created, exactly one in-app notification appears in their feed (deep-linkable to results), and broad searches can be switched to daily cadence (selector present, delivery deferred to Phase 14).
  2. A buyer who Watches a car (control visually distinct from the local Favorite heart) receives instant in-app alerts for price-drop (decrease only), booked, sold, and back-available (booked→active only) — keyed on `car._id || car.id || carId`, never bare `car.id`.
  3. A seller editing their own listing's price three times produces ZERO notifications to themselves (actor-exclusion) and AT MOST ONE price-drop alert to each watcher (dedup per `(uid, carId, eventType)`); a notification is never emitted for a hidden/suspended/archived listing (emit re-reads the Car with a plain `findById` and suppresses on null).
  4. The header bell shows an accurate unread badge; opening `NotificationsScreen` shows a reverse-chronological cursor-paginated feed; tapping marks read (with "mark all read" available), and a first-time empty state guides the user — all functional with `fcm.send` as a no-op stub.
  5. A `NotificationSettingsScreen` exposes master mute + per-category toggles + subscription management (list/edit-cadence/delete); the user's language persists to `User.language` and AsyncStorage, and backend-rendered notification strings have RU/EN parity (backend parity test) with currency formatted as KGS som.
**Plans**: TBD
**UI hint**: yes

### Phase 13: FCM Push Transport (native)
**Goal**: Buyers receive OS push notifications (lock-screen) for their instant subscriptions when the app is closed, delivered via FCM, with taps routing to the correct screen from any app state — gated behind a proven iOS native-build spike.
**Depends on**: Phase 12 (the emit pipeline, Notification rows, `User.language`, and the `fcm.send` stub it replaces).
**Requirements**: NPUSH-01..08, NPRF-06
**Success Criteria** (what must be TRUE):
  1. The FIRST task — a timeboxed iOS Podfile `use_frameworks! :linkage => :static` spike — produces a Release archive that BUILDS AND RUNS on a real device with the existing Stripe + fmt/C++17 post-install hooks intact and Stripe checkout still working; a pre-frameworks rollback checkpoint is committed before the switch, and the notifee-fallback decision is recorded inside the spike. (This gates the rest of the phase.)
  2. After RNFB 24.x install (app+messaging locked-step), iOS target ≥15, Android google-services + `POST_NOTIFICATIONS` + default channel, and the APNs `.p8` uploaded to Firebase, a real device receives a push for an instant saved-search/Watch event with a generic PII-safe body (no lock-screen detail leakage).
  3. A push tap from the QUIT (cold-start) state opens the correct car detail on a real device — `setBackgroundMessageHandler` is registered at the top of `index.js`, `getInitialNotification()` is handled, and `data.deeplink` (built server-side with `car._id || car.id || carId`) routes through the existing `linking` config; foreground and background taps work too.
  4. Device tokens register on login/signup, refresh on `onTokenRefresh`, and unregister on logout (token captured before the idToken ref clears); the backend send loop (firebase-admin, cached OAuth, exponential backoff on 429) prunes `UNREGISTERED`/`INVALID_ARGUMENT` tokens and never aborts the whole fan-out on one bad token.
  5. Push permission is NEVER requested on launch — only contextually on first Watch/Save-search, preceded by a soft in-app pre-prompt with a "Not now" option; if the user denies OS push, the Phase-12 in-app center remains fully functional with no dead-end; send-time re-checks the hide-hook/moderation status (TOCTOU).
**Plans**: TBD
**UI hint**: yes

### Phase 14: Daily Digest & Scheduling
**Goal**: Buyers with daily-cadence saved searches (plus daily-cap overflow and quiet-hours-queued items) receive one localized morning digest push per day, delivered crash-safely by an in-process scheduled worker.
**Depends on**: Phase 13 (uses its `fcm.js` send path) and Phase 12 (the `digestPending` flag, cadence selector, daily cap, quiet-hours plumbing).
**Requirements**: NDIG-01..05
**Success Criteria** (what must be TRUE):
  1. An in-process `node-cron` job runs inside the Express service, gated by `require.main === module` so the test suite never starts it, and fires at a fixed Asia/Bishkek morning hour (no per-user timezone field exists).
  2. A user with three daily-cadence matches plus two daily-cap-overflow items receives exactly ONE localized push (`digest_title {count}`) the next morning — daily saved searches, instant-cap overflow, and quiet-hours-queued items are all delivered together.
  3. A simulated crash mid-run causes neither a double-send nor a drop: the digest snapshots `createdAt <= runStart`, claims, sends, and clears only the successfully-sent ids (`digestPending` cleared per-id).
  4. The same cron run prunes dead device tokens and notifications older than 90 days (satisfying NDOM-06's retention policy), and the digest flush re-checks the hide-hook so a listing hidden overnight is not pushed.
**Plans**: TBD

## Progress

### v1.2 Notifications (Phases 12-14)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 12. Notification Domain + In-App Center | 0/TBD | Not started | - |
| 13. FCM Push Transport (native) | 0/TBD | Not started | - |
| 14. Daily Digest & Scheduling | 0/TBD | Not started | - |

## Backlog / Carry-forward candidates

Documented in `.planning/milestones/v1.0-REQUIREMENTS.md` v2 section + `.planning/milestones/v1.1-REQUIREMENTS.md` v2 section + `.planning/REQUIREMENTS.md` v2 section (NOTF2-01..06).

- **NOTF2-01..06** — Notifications v2: notifee rich foreground banners, seller-side notifications, broadcast dashboard, feed differentiators (day grouping / swipe-dismiss), per-user timezone field, multi-instance-safe cron advisory lock
- DEBT-01..04 — AuthService split, typed User, expanded test coverage, error handling
- REL-01, REL-03 — Stripe live key, env-config cleanup
- MOD2-01..06 — Extended moderation (CSV export, IP/device fingerprint, bulk select, super-admin tier, etc.)
- LIST-02 — Automated listing-flagging queue (paired with LIST-01)
- QUAL-02 — 10k-user backend load test (deferred from v1.0)
- UX: UserStatusBanner visibility cramped by navbar avatar + logo (captured during Phase 04 UAT 2026-04-30)
- v1.1 carry-forward: bulk admin listings panel + hard-delete UI affordance + listing edit-history diff replay UI
