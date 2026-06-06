# Requirements: CarEx — v1.2 Notifications

**Defined:** 2026-06-06
**Core Value (milestone):** Buyers get alerted to relevant inventory and watched-car events without re-checking the app — via an in-app notification center and OS push.
**Design spec:** [docs/superpowers/specs/2026-06-06-notifications-system-design.md](../docs/superpowers/specs/2026-06-06-notifications-system-design.md)
**Research:** [.planning/research/v1.2/SUMMARY.md](research/v1.2/SUMMARY.md)

## v1 Requirements

Continues phase numbering from v1.1 (Phases 7–11). v1.2 spans **Phases 12–14**.

### Notification Domain — Backend (NDOM)

- [ ] **NDOM-01**: Three Mongoose models exist with the documented indexes — `DeviceToken` (globally-unique `token`, `{uid}` index), `Subscription` (`{kind,active,criteria.makeId,criteria.modelId}`, `{kind,carId,active}`, `{uid,active}`), `Notification` (`{uid,createdAt}`, `{uid,read}`, `{digestPending}`, `dedupeKey`).
- [ ] **NDOM-02**: `notificationService.emit()` is called AFTER commit (not in a Mongoose post-save hook) at the six trigger points: `POST /api/cars`, `PUT /api/cars/:id`, `PATCH /api/cars/:id/status`, `confirmBooking` (post-transaction), admin `editListing` (post-commit), and the booked→active transition.
- [ ] **NDOM-03**: Every emit applies three guards — (a) hide-hook respect by re-reading the Car with a plain `findById` (no bypass flags) and suppressing if null/non-active, (b) actor-exclusion (never notify `event.actorUid`), (c) dedup per `(uid, carId, eventType)`.
- [ ] **NDOM-04**: A pure, unit-testable `matchSavedSearches` resolves matching active Saved Searches via the indexed query, off the request hot path.
- [ ] **NDOM-05**: `/api/notifications/*` router is mounted, uid-scoped (uid taken from the verified ID token, NOT a body param; not admin-gated).
- [ ] **NDOM-06**: Notifications older than 90 days are pruned (job lands in Phase 14 cron; policy defined here).

### Subscriptions (NSUB)

- [ ] **NSUB-01**: User can create and manage a **Saved Search** with criteria (make, model, price min/max, year min/max, body type); new searches default to **instant** cadence.
- [ ] **NSUB-02**: User can **Watch** a specific car and receive its lifecycle events — **price drop (decrease only)**, **booked**, **sold**, **back-available** (booked→active only, not admin archived→active restores).
- [ ] **NSUB-03**: Each Saved Search has a cadence of **instant** or **daily digest** (selector present in v1.2; daily delivery enforced in Phase 14). Watch events are always instant.
- [ ] **NSUB-04**: Watch subscriptions key on `car._id || car.id || carId` (never bare `car.id`); price-drop fires only on a decrease (direction-checked against captured old price).

### In-App Notification Center (NCEN)

- [ ] **NCEN-01**: A bell icon with an unread-count badge is present in the app header.
- [ ] **NCEN-02**: `NotificationsScreen` shows a reverse-chronological feed with cursor pagination (reuse the house base64 `{createdAt,_id}` cursor).
- [ ] **NCEN-03**: Tapping a notification deep-links to its target (car detail or saved-search results) via the existing `linking` config.
- [ ] **NCEN-04**: Notifications mark read on open; a "mark all read" action exists; read vs unread are visually distinct.
- [ ] **NCEN-05**: An onboarding empty state guides first-time users ("Save a search or watch a car to get alerts").
- [ ] **NCEN-06**: A **Watch** control on `CarDetailsScreen` (visually disambiguated from the local Favorite heart) and a **"Notify me about new matches"** action on the Home/filter results create the respective subscriptions.

### Preferences & Permission UX (NPRF)

- [ ] **NPRF-01**: A `NotificationSettingsScreen` provides a master mute and per-category toggles (saved-search / watch).
- [ ] **NPRF-02**: User can list, edit the cadence of, and delete their subscriptions.
- [ ] **NPRF-03**: **Quiet hours** suppress non-urgent push overnight and queue them to the morning.
- [ ] **NPRF-04**: A **soft per-user daily cap (2–3/day)** applies to instant saved-search push; overflow rolls into the daily digest; Watch/transactional events are exempt.
- [ ] **NPRF-05**: **Dedup + actor-exclusion** are user-visible-correct: a user never gets duplicate alerts for the same listing event and is never notified about their own action.
- [ ] **NPRF-06**: A **soft in-app pre-prompt** (with "Not now") precedes the native OS permission dialog; push permission is **never** requested on launch — only contextually on first Watch/Save-search.
- [ ] **NPRF-07**: When OS push is denied, the in-app center remains fully functional as the fallback (no dead-end).

### Internationalization (NI18N)

- [ ] **NI18N-01**: A `language` field is added to the `User` model and accepted by `PUT /api/users/:uid`; server-rendered push uses it (default RU).
- [ ] **NI18N-02**: `LanguageContext` persists the user's language to the backend and AsyncStorage (currently in-memory only).
- [ ] **NI18N-03**: A backend translations map renders notification title/body from keys+params with **RU/EN parity** (enforced by a backend parity test); currency formatted as KGS som.

### OS Push Transport — FCM (NPUSH) · Phase 13

- [ ] **NPUSH-01**: A timeboxed iOS Podfile spike switches to `use_frameworks! :linkage => :static`, keeps the existing Stripe + fmt/C++17 post-install hooks, and proves a **Release archive builds AND runs on a real device** with Stripe checkout intact — committed behind a rollback checkpoint; notifee-fallback decision made within the spike.
- [ ] **NPUSH-02**: `@react-native-firebase/app` + `/messaging` (24.x, locked-step) are installed; iOS deployment target raised to ≥15; Android `google-services` plugin applied (bottom of `app/build.gradle`), `POST_NOTIFICATIONS` declared, default channel created.
- [ ] **NPUSH-03**: APNs `.p8` auth key uploaded to Firebase; `aps-environment` entitlement + Push/Background-modes capabilities configured; verified delivering on a real device.
- [ ] **NPUSH-04**: Device-token lifecycle is wired into `AuthContext` — register on login/signup, refresh on `onTokenRefresh`, unregister on logout (token captured before the idToken ref clears).
- [ ] **NPUSH-05**: Backend sends push via `firebase-admin.messaging().send()` in a per-token loop (cached OAuth, exponential backoff on 429), pruning `DeviceToken` rows on `UNREGISTERED`/`INVALID_ARGUMENT`; one bad token never aborts the fan-out.
- [ ] **NPUSH-06**: Foreground, background, and **quit** states are all handled — `setBackgroundMessageHandler` registered at the top of `index.js`, `getInitialNotification()` handled for cold-start.
- [ ] **NPUSH-07**: A push tap (including cold-start) routes `data.deeplink` through the existing `linking` config to the correct screen; deeplinks built server-side with `car._id || car.id || carId`.
- [ ] **NPUSH-08**: Send-time re-checks the hide-hook/moderation status (TOCTOU) and uses generic, PII-safe push bodies (no lock-screen leakage).

### Daily Digest & Scheduling (NDIG) · Phase 14

- [ ] **NDIG-01**: An in-process `node-cron` job runs in the Express service, gated by `require.main === module` so tests don't start it.
- [ ] **NDIG-02**: The digest aggregates each user's pending (`digestPending`) notifications atomically — snapshot `createdAt <= runStart`, claim, send, clear only sent ids (crash-safe, no double-send/drop).
- [ ] **NDIG-03**: Daily-cadence saved searches, daily-cap overflow, and quiet-hours-queued items are delivered in the digest; one localized push per user (`digest_title {count}`).
- [ ] **NDIG-04**: The digest fires at a fixed Asia/Bishkek morning hour (no per-user timezone field exists).
- [ ] **NDIG-05**: The cron prunes dead device tokens and notifications older than 90 days (satisfies NDOM-06).

## v2 Requirements

Deferred to a future milestone. Tracked, not in this roadmap.

### Notifications v2 (NOTF2)

- **NOTF2-01**: `@notifee/react-native` for rich foreground banners + named Android importance channels.
- **NOTF2-02**: Seller-side notifications ("your listing got a watcher / an inquiry").
- **NOTF2-03**: Marketing/broadcast send dashboard.
- **NOTF2-04**: In-app feed differentiators — day grouping, swipe-to-dismiss.
- **NOTF2-05**: Per-user timezone field for precise digest timing.
- **NOTF2-06**: Multi-instance-safe cron (advisory lock) if Railway scales beyond one instance.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email / SMS notification channels | Push + in-app only this milestone; Twilio is OTP-only. |
| Price-*increase* alerts | Buyers don't want them; only decreases are valuable. |
| New-photo / description-edit alerts | Exactly the noise dedup is meant to suppress. |
| Unfiltered "all new listings" firehose | Spam; saved searches always carry at least a make. |
| Free-text / NLP saved search | Structured criteria only in v1.2. |
| Digest-as-default cadence | Loses deals for a car marketplace; instant is default. |
| Web push | Mobile app only. |
| Separate Railway worker for cron | In-process node-cron is sufficient at current scale. |
| Native re-prompting after denial | App Store-hostile; in-app center is the fallback. |

## Traceability

Pre-mapped from research; the roadmapper confirms and adds success criteria.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NDOM-01..06 | Phase 12 | Pending |
| NSUB-01..04 | Phase 12 | Pending |
| NCEN-01..06 | Phase 12 | Pending |
| NPRF-01..02, 05, 07 | Phase 12 | Pending |
| NPRF-03..04 (plumbing) | Phase 12 | Pending |
| NPRF-06 (prompt) | Phase 13 | Pending |
| NI18N-01..03 | Phase 12 | Pending |
| NPUSH-01..08 | Phase 13 | Pending |
| NDIG-01..05 | Phase 14 | Pending |

**Coverage:**
- v1 requirements: 32 total (NDOM 6, NSUB 4, NCEN 6, NPRF 7, NI18N 3, NPUSH 8, NDIG 5 — NPRF-06 prompt-side lands in Phase 13)
- Mapped to phases: 32
- Unmapped: 0
