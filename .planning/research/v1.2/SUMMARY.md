# v1.2 Notifications — Research Synthesis

**Milestone:** v1.2 Notifications (in-app center + FCM push) — Phases 12–14
**Synthesized:** 2026-06-06
**Source of truth:** `docs/superpowers/specs/2026-06-06-notifications-system-design.md` (approved design)
**Inputs:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md (all v1.2)
**Overall confidence:** HIGH on domain/architecture/feature scope; MEDIUM on the one-time iOS native integration (Podfile `use_frameworks!` switch) that gates Phase 13.

The research **validates the spec's core architecture and corrects four things**. Where it corrects the spec, it is called out explicitly as a refinement below.

---

## Headline Findings

1. **The plan-changing risk is not version compatibility — it's the iOS Podfile.** `react-native-firebase` 24.x is **compatible** with RN 0.83.1 + React 19.2 (wildcard peer deps, TurboModule-interop on New Arch). But RNFB forces `use_frameworks! :linkage => :static`, and this app has Stripe + an fmt/C++17 `post_install` hook and currently does **not** use frameworks. This single native switch is the highest-risk step of the entire milestone and must be a timeboxed, rollback-checkpointed spike at the **open of Phase 13**, before any JS.

2. **`firebase-admin@13.8.0` is ALREADY installed on the backend** (verified in source, used for `verifyIdToken`). This **refines** STACK.md (which proposed adding `google-auth-library` and treated firebase-admin as only "likely present") and satisfies the spec's "no server SDK" intent on the *send wire* while reusing existing credential plumbing. **Do not add `google-auth-library`** — reuse firebase-admin for service-account/JWT/OAuth-token minting; keep the actual send as FCM HTTP v1 REST if the "no server SDK send" constraint is held strictly, or use `firebase-admin.messaging().send()` if the operator relaxes it. Either way, **zero new backend send deps**.

3. **Instant must be the DEFAULT cadence, daily is opt-in.** This is a **refinement / correction**. Well-priced used cars get a first inquiry in ~10 min; a digest-default product loses deals and breaks trust. Watch events are always instant; new Saved Searches default to instant; daily digest is the opt-in pressure valve for *broad* searches. PITFALLS.md's earlier "default toward daily" phrasing is overruled by FEATURES.md's evidence — **instant default**.

4. **Quiet hours + a per-user daily cap should be promoted to table stakes.** Notification fatigue is the #1 opt-out cause (the spec's own top risk). Overnight push is the single most-resented behavior. Promote: (a) **quiet hours** (suppress non-urgent push overnight, queue to morning), (b) **2–3 push/day soft cap** for instant saved searches with overflow rolling into the daily digest, (c) **soft in-app pre-prompt** before the one-shot native iOS permission dialog. Watch (transactional) events are exempt from the cap.

5. **Use explicit `notificationService.emit()` after-commit — NOT Mongoose `post('save')` hooks.** Verified against source: the codebase has zero side-effect lifecycle hooks. post-save can't see the *before* price, fires inside (and on retries of) the `confirmBooking` transaction, and lacks request context (actor uid). All emit calls go in existing route handlers/services **after** `await save()` / after the transaction commits.

6. **Hide-hook respect is enforced by OMITTING the bypass flags.** The Car model's `pre(/^find/)` hide hooks gate visibility. Every admin read in the codebase *adds* a bypass flag; the notification pipeline must *omit* it — re-read the Car with a plain `findById` (no `setOptions`) at send time; if it returns null, the listing is hidden → suppress. This inversion must be documented loudly. It also handles the v1.1 TOCTOU pattern (re-check at match time AND send time, since status can change in between).

7. **Phase 12 ships zero native code and is fully usable standalone.** No new mobile packages; the in-app center reuses axios `apiClient`, a new `NotificationContext` (Cart pattern), `useLanguage`, existing `linking`. This isolates all native risk in Phase 13 and means the in-app center is the guaranteed denied-permission fallback.

8. **`User.language` persistence and `LanguageContext` persistence are NEW work, not assumptions.** Verified: `User.js` has no `language` field, and `LanguageContext` holds language in-memory only (no AsyncStorage, no backend write). Server-side push render needs the user's language, so both must be added — this is a MODIFIED-item surprise the spec glosses.

---

## Stack Decisions

**Phase 12 (in-app center): ZERO new mobile packages.** Reuse axios `apiClient`, new `NotificationContext`, `useLanguage().t`, `lucide-react-native` (bell/badge), existing `linking`. New `NotificationService.ts` (follow the `ModerationService` split precedent — do NOT bolt onto AuthService).

**Phase 13 (FCM push) — RN 0.83 verdict: COMPATIBLE.**

| Package | Version | Notes |
|---|---|---|
| `@react-native-firebase/app` | `^24.1.0` | peer deps wildcard; no upper RN bound; New-Arch tested. |
| `@react-native-firebase/messaging` | `^24.1.0` | Must match `app` exactly (locked-step). Install both at the same minor. |

- No version-pin gymnastics; no need for a `react-native-notifications`/OneSignal fallback provider — RNFB works on RN 0.83.
- **iOS deployment target → 15** (RNFB v23+ raised the floor from 13). App is currently iOS 13.4 — must bump (`min_ios_version_supported` / project target; changes `project.pbxproj`, which already churns on archive).
- **Android:** minSdk 24 is fine (RNFB needs 23). Add `com.google.gms.google-services` classpath + apply plugin at the **bottom** of `android/app/build.gradle`. Declare `POST_NOTIFICATIONS`; default channel acceptable for v1.2.
- **`@notifee/react-native`: DEFER.** Bare `messaging` covers background/quit + basic foreground. Add notifee later only if rich foreground banners or named Android channels are required (low-cost to add later).

**Backend send path — REFINEMENT (firebase-admin already present):**
- **Reuse `firebase-admin@13.8.0`** (already installed for `verifyIdToken`) for credential/OAuth-token minting. **Do NOT add `google-auth-library`** (STACK.md's proposal is superseded by the verified presence of firebase-admin).
- Keep the OAuth access token **cached** (~3600s, refresh ~5 min before expiry) — never re-mint per send.
- FCM HTTP v1 has **no batch/multicast** (removed June 2024): loop one request per token, concurrency 100–500 over HTTP/2, exponential backoff on 429.

**Digest (Phase 14):** `node-cron@^4.x` **in-process** in the existing Express service, gated by `require.main === module` so tests don't start it. No separate Railway worker. (Single-instance Railway assumption — confirm before relying on in-process cron without an advisory lock.)

**What NOT to add:** No Expo modules; no `expo-notifications`; no new state-management or networking lib; no `react-native-notifications`/OneSignal; no `google-auth-library`; no notifee in v1.2; no separate Railway worker; no email/SMS channels (out of scope).

---

## Feature Scope

**Saved-Search alerts**
- **Table stakes:** make+model+price+year+body criteria; one-tap "Notify me about new matches" from filters (THE conversion moment); **instant default**; fire-once-per-(subscription, listing) dedup; never-notify-actor; hide-hook respect; per-user daily cap (promoted).
- **Differentiator:** add `yearMax` (spec only has `yearMin` — low cost, common "2015–2018" intent); "suggest daily for broad searches."
- **Anti-feature:** unfiltered all-listings firehose; free-text/NLP search; **digest-as-default**.

**Watched-item alerts** (all instant)
- **Table stakes:** price-drop (**decrease only** — direction-check the hook), sold, booked.
- **Differentiator (well-chosen):** back-available (booked→active only, not admin archived→active restores) — fits CarEx's fall-through booking reality.
- **Anti-feature:** price-*increase* alerts; new-photo/description-edit alerts (these are exactly what dedup suppresses).
- **Correctness:** Watch keys on `carId` — use `car._id || car.id || carId`, never bare `car.id` (project memory: bare `car.id` caused a silent prod booking-status bug).

**In-app center**
- **Table stakes:** bell + unread badge; reverse-chron feed; tap → deep-link; mark-read-on-open + mark-all-read; unread/read styling; onboarding empty state ("Save a search or watch a car to get alerts"); cursor pagination (reuse base64 `{createdAt,_id}` house cursor); **history retention policy** (decide a 30–90 day window + prune in cron — spec is silent, unbounded growth bloats the free-tier).
- **Differentiator:** day grouping; swipe-dismiss; live badge while open (foreground poll is enough).

**Preferences & permission UX**
- **Table stakes:** master mute; per-category toggles (saved-search / watch); manage subscriptions (list/delete/edit cadence); per-search instant/daily; **quiet hours (promoted)**; in-app-only fallback when push denied; never-prompt-on-launch; contextual trigger on first Watch/Save-search; **soft pre-prompt + "Not now" (promoted)** before the one-shot native iOS dialog.
- **Anti-feature:** email/SMS channels; native re-prompting; shadow/silent suppression with no user control.

**Regional (KG/RU):** Avito/OLX mental model means no user education needed for the primitives. KGS som (not ruble); техпаспорт not ПТС, ГАИ not ДПС; sharper-than-US tone tolerated. Quiet-hours default from the existing device-timezone→city signal (no GPS). Digest reference timezone = fixed local-morning hour for Asia/Bishkek (no per-user TZ field exists).

---

## Architecture & Integration

**Data model — 3 models VALIDATED** (`DeviceToken`, `Subscription`, `Notification`), all NEW in `src/models/`. Digest-as-flag (`digestPending` on Notification rows) confirmed — no fourth collection.
- `DeviceToken.token` unique **globally** (not per-uid): same device re-logins as different users; upsert on token, last-writer-wins on uid. Add `{ uid: 1 }` index for fan-out.
- `Subscription.criteria.makeId/modelId` as `ObjectId` (match Car's ObjectId refs, not the legacy denormalized name strings). Index `{ kind, active, criteria.makeId, criteria.modelId }` (match), `{ kind, carId, active }` (watch), `{ uid, active }` (manage).
- `Notification`: index `{ uid, createdAt }`, `{ uid, read }`, `{ digestPending }`; add a `dedupeKey` (`${carId}:${eventType}`).

**Emit, not hooks (REFINEMENT of spec's implied flow):** explicit `notificationService.emit()` placed AFTER commit in existing handlers:
- `POST /api/cars` (new_listing) · `PUT /api/cars/:id` (price_drop, capture oldPrice before `Object.assign`) · `PATCH /api/cars/:id/status` (booked/sold/back-available, capture old status) · `confirmBooking.js` after `withTransaction` returns (booked, exclude buyer) · `listingService.js editListing` after commit (admin price_drop, uses existing `fieldDiff.price {before,after}`).

**Guards inside emit:** (1) **hide-hook respect by OMITTING bypass flags** (re-read Car plain; suppress if null) at match AND send time (TOCTOU); (2) actor-exclusion (`subscription.uid === event.actorUid` dropped); (3) dedup window per `(uid, carId, event)`.

**New `src/notifications/` dir** (mirrors `src/moderation/`): `notificationService.js`, `matchSavedSearches.js` (pure, unit-testable), `translations.js` (backend RU/EN map, key-parity with mobile), `router.js` (`/api/notifications/*`, per-user uid-scoped — NOT requireAdmin; enforce uid from verified token), `push/fcm.js` (Phase 13), `digest.js` (Phase 14). `fcm.send` injected as a Phase-12 no-op stub so the in-app feed ships standalone.

**MODIFIED items (the surprises):**
- `User.js` — **add `language` field** (currently absent). Extend `PUT /api/users/:uid` to accept it; render push from `User.language`, default RU.
- `LanguageContext.tsx` — currently in-memory only; **add persistence** to backend (`NotificationService.setLanguage`) + AsyncStorage (closes a pre-existing gap).
- `App.tsx` — insert `NotificationProvider` after `FavoritesProvider` (depends on `useAuth`); register 2–3 new screens; optional `notifications` linking entry.
- `AuthContext.tsx` (Phase 13) — device-token register on login/signup, refresh on `onTokenRefresh`, unregister on logout (capture token **before** clearing idToken ref).
- `CarDetailsScreen` (Watch button — note: distinct from the local-only Favorite heart; needs visual disambiguation), `HomeScreenV2`/`SearchResultsV2`/`FilterModal` (Save-search action), `navigation.ts`, `translations.ts` (parity-enforced).

**NEW mobile:** `NotificationService.ts`, `NotificationContext.tsx` (Cart-pattern auto-clear on uid change), `NotificationsScreen`, `NotificationSettingsScreen`, `NotificationBell` component; (Phase 13) `useDeviceToken`.

---

## Top Risks & Mitigations (ranked)

1. **#1 — iOS `use_frameworks! :linkage => :static` collides with Stripe + fmt hooks (Phase 13, HIGH).** RNFB forces static frameworks; the app doesn't use them and has Stripe + an fmt/C++17 `post_install` hook. The historically fatal `FollyConvert.h not found` break (stripe-react-native #2065) is **fixed** and the app is on Stripe 0.62+ (past the broken 0.50.3), so it's resolvable — but switching is the riskiest step. **Mitigation:** dedicated timeboxed Podfile spike at the **open of Phase 13**, commit a pre-frameworks rollback checkpoint first, keep both existing hooks and re-validate them, build a **Release archive on a real device** (not just debug sim), and decide the **notifee + bare FCM fallback inside the spike** if the combo won't build.

2. **#2 — Missing/wrong APNs `.p8` auth key → silent iOS no-delivery (Phase 13, HIGH).** FCM proxies APNs; without the `.p8` uploaded to Firebase + `aps-environment` entitlement + Push/Background-modes capability, FCM reports success and nothing arrives — no error, no log. **Mitigation:** explicit Phase 13 ops checklist (upload auth key, add capabilities, flip `aps-environment` dev→prod for TestFlight/release), test on a **real device**.

3. **#3 — Notification spam / fatigue → opt-out (Phase 12 + 14, HIGH).** Fan-out + per-edit pings + back-available churn drowns users; denied push is unrecoverable without a Settings trip. **Mitigation:** instant-default with **2–3/day soft cap** (overflow → digest), **quiet hours**, dedup per `(uid, carId, event)`, actor-exclusion, master + per-category toggles, **soft pre-prompt** before the native dialog.

4. **#4 — Dead-token accumulation + cross-user leakage (Phase 13, HIGH).** No multicast in HTTP v1; tokens churn. **Mitigation:** prune DeviceToken rows on FCM 404 `UNREGISTERED` / 400 `INVALID_ARGUMENT` (only when payload is well-formed) inside the send loop; delete token on logout before clearing auth; per-token try/catch so one bad token never aborts the fan-out.

5. **#5 — Cold-start deep-link from a push tap (Phase 13, HIGH).** Three app states use three different RNFB APIs; `getInitialNotification()` (quit→tap) is the forgotten one and dumps users on Home. **Mitigation:** register `setBackgroundMessageHandler` at top of `index.js`; handle all three states; route `data.deeplink` through the existing `linking` config; construct deeplinks server-side with `car._id || car.id || carId`; test quit→tap on a real device.

6. **#6 — Server-side i18n (Phase 12/13/14, HIGH).** Push rendered server-side needs `User.language` (a NEW field) and a backend translations map with **RU/EN parity** (the existing jest literal scanner only covers mobile). **Mitigation:** add `language` field + persist from LanguageContext; add a backend parity test; KGS som formatting; default RU.

7. **#7 — Digest correctness + timezone (Phase 14, HIGH).** Crash mid-run double-sends or drops; UTC cron gives KG users odd-hour digests. **Mitigation:** snapshot `createdAt <= runStart`, claim-then-send, clear only sent ids; fixed Asia/Bishkek morning hour.

---

## Phase Assignment

**Phase 12 — Domain + in-app center (pure REST, zero native).** All findings: 3-model data model + indexes; `notificationService.emit()` after-commit hooks (6 placements); guards (hide-hook-omit-bypass, actor-exclusion, dedup); match-engine indexed query off the request path; `User.language` field + `PUT /api/users/:uid` extension; backend translations map + RU/EN parity test; `/api/notifications/*` router (uid-scoped); mobile `NotificationService` + `NotificationContext` + screens + bell; Watch button; Save-search action; `LanguageContext` persistence; instant-default cadence; daily cap + quiet-hours plumbing; retention policy; `yearMax` add. **`fcm.send` is a no-op stub here.** Pitfalls: #14–19, #22–24 (spam, dedup, actor, hide-hook match-time, fan-out, race, i18n keys/parity/KGS).

**Phase 13 — FCM push transport (native).** **GATE FIRST:** Podfile `use_frameworks!` static-linkage spike (rollback checkpoint, Release-archive on device, notifee fallback decided here). Then: RNFB 24.x install (locked-step app+messaging); iOS target → 15; Android google-services plugin (bottom) + `POST_NOTIFICATIONS` + default channel; APNs `.p8` upload + entitlements + capabilities; `firebase-admin`-backed FCM HTTP v1 send (cached OAuth token, per-token loop, prune dead tokens); device-token lifecycle in AuthContext (register/refresh/unregister); foreground/background/quit 3-state handling (`setBackgroundMessageHandler` in `index.js`); contextual permission prompt + soft pre-prompt + denied fallback; cold-start deep-link routing; send-time hide-hook re-check (TOCTOU); generic PII-safe push bodies; store declarations. Pitfalls: #1–13, #17 (send-time), #25–29.

**Phase 14 — Daily digest.** In-process `node-cron` under `require.main === module`; `node-cron` dep added; atomic per-user flush (snapshot/claim/clear-sent-only); localized `digest_title {count}`; send via Phase 13 `fcm.js`; fixed Asia/Bishkek hour; enable the instant/daily cadence selector (shipped disabled in Phase 12); digest-flush hide-hook re-check; prune stale tokens / old notifications in the cron. Pitfalls: #17 (digest-flush), #20, #21; #10/#13 reused for digest send.

---

## Open Verification Items

1. **[HIGH — Phase 13 open] On-device iOS Podfile build with `use_frameworks! :linkage => :static`.** Switch Podfile, keep fmt + Stripe hooks, clean `pod install --repo-update`, build a **Release archive on a real device**, verify Stripe checkout still builds AND runs. Commit a rollback checkpoint first. This is the gating spike — do not assume `pod install` == done.
2. **[MED] iOS deployment target resolves to >= 15** after RNFB v24; bump if lower.
3. **[MED] Re-validate the fmt c++17 + Stripe `-Wno-error` post-install hooks** survive the frameworks switch.
4. **[MED] Backend send-SDK posture call:** firebase-admin is present — confirm whether to use `firebase-admin.messaging().send()` (simpler, reuses installed dep) or keep a hand-rolled FCM HTTP v1 REST send for strict "no server SDK send" adherence. Operator/design decision.
5. **[LOW] Railway instance count** — confirm single-instance before relying on in-process node-cron without an advisory lock.
6. **[LOW] Locked-step RNFB version** — verify `@react-native-firebase/app` and `messaging` resolve to the SAME version at install.
7. **[LOW] Android channel** — default channel acceptable for v1.2, or pull in notifee/native step for a named importance channel?
8. **[UX] Watch (server subscription) vs Favorite (local heart) disambiguation** on CarDetails; bell placement vs header crowding; whether subscription management is its own screen or folded into NotificationSettings.

---

## Confidence Assessment

| Area | Confidence | Basis |
|---|---|---|
| Stack (versions, RN-0.83 verdict) | HIGH | npm-verified versions; RNFB peer deps + New-Arch status confirmed. |
| iOS native integration (Podfile switch) | MEDIUM | Resolvable but unverified on-device; gating spike required. |
| Backend send path | HIGH | firebase-admin@13.8.0 verified present in source. |
| Feature scope | MEDIUM-HIGH | Industry patterns cross-source agreement; regional KG specifics LOW. |
| Architecture / data model / hooks | HIGH | Verified against actual backend + mobile source, line numbers checked. |
| Pitfalls (native/FCM mechanics) | HIGH | Firebase docs + RNFB/Stripe issue trackers + project memory. |

**Gaps to address during planning:** the on-device iOS build (item 1) is the only thing that could materially change the Phase 13 shape; everything else is plan-ready.

---

## Sources

Aggregated from the four research files. Highest-signal:
- react-native-firebase (GitHub, rnfirebase.io install + v23 migration) — RN-0.83/New-Arch status, iOS 15 floor.
- stripe-react-native #2065 (FollyConvert + static frameworks, fixed via #2129); RNFB #7011 (use_frameworks static).
- Firebase: FCM HTTP v1 send API, token-management best practices, error codes (UNREGISTERED / INVALID_ARGUMENT).
- npm registry (verified 2026-06-06): RNFB app/messaging 24.1.0, notifee 9.1.8, node-cron 4.2.1, firebase-admin 13.10.0 (13.8.0 installed), stripe-react-native 0.66.0.
- Marketplace/UX: Flipify, CarSnipe, AutoTempest, AutoTrader, Cars.com (Carson), eBay/Swoopa, Plotline/Hurree/OneSignal (opt-in), Sashido/Retenshun/Courier (fatigue), PatternFly/Setproduct (in-app center).
- Project memory: KG/RU audience + KGS som; no per-user TZ field; `car.id` unreliable; v1.1 hide-hook/TOCTOU.
- Verified source reads: backend `server.js`, `confirmBooking.js`, `listingService.js`, `Car.js`, `User.js`; mobile `CartContext`, `FavoritesContext`, `AuthContext`, `LanguageContext`, `App.tsx`.
