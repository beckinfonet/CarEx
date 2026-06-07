# Phase 13: FCM Push Transport (native) - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Buyers receive OS push notifications (lock-screen) for their **instant** subscriptions when the app is closed, delivered via FCM, with taps routing to the correct screen from any app state (foreground / background / quit). The entire phase is **gated behind a proven iOS native-build spike** — `use_frameworks! :linkage => :static` must produce a Release archive that builds AND runs on a real device with Stripe checkout intact, or the phase aborts.

**In scope:** the gating Podfile spike; RNFB 24.x install (app+messaging locked-step); APNs `.p8` + iOS entitlements/capabilities; Android google-services + `POST_NOTIFICATIONS` + default channel; device-token lifecycle in AuthContext; backend firebase-admin send loop replacing the `fcm.send` stub; 3-state handling + cold-start deep-link; contextual permission pre-prompt (NPRF-06); denied-permission recovery UX.

**Out of scope (later phases / not this milestone):** daily-digest worker + scheduled delivery (Phase 14); any new notification *categories* beyond the Phase-12 instant set; re-attempting native push if the spike aborts (deferred to a future milestone).

</domain>

<decisions>
## Implementation Decisions

### Spike Gate & Failure Path (NPUSH-01)
- **D-01:** Spike timebox is **2 days**. That window is the hard abort trigger.
- **D-02:** **If the spike cannot produce a Stripe-intact Release build that runs on a real device within the timebox → ABORT & REVERT.** Use the pre-frameworks rollback checkpoint, ship Phase-12's in-app center as the only channel for this milestone, and re-attempt native push in a future milestone. Do NOT extend past the timebox and do NOT pivot to an alternative transport in this phase.
- **D-03:** The **notifee-fallback decision is the spike's output** — whether notifications render via `@notifee/react-native` vs RNFB's built-in display is decided/recorded inside the spike, not pre-locked here. (Note [[firebase_sdk_split]] memory: the spike exists precisely to de-risk adding RNFB given the known native-Firebase + Stripe/fmt/C++17 conflict.)

### Permission Pre-Prompt (NPRF-06)
- **D-04:** The soft in-app pre-prompt fires **once, on the first Watch OR first Save-search** (whichever the user does first). A single ask covers both subscription types — not one prompt per action.
- **D-05:** "Not now" means **never auto-re-ask.** After dismissal the app does not re-show the soft prompt on subsequent subscriptions; the user must opt in via the recovery path (see D-09). Pairs with the silent-by-default recovery stance.
- **D-06:** Pre-prompt copy is **plain & functional**, RU-first (e.g. "Включить уведомления, чтобы не пропустить новые совпадения?") — NOT the sharper UNHINGED market voice for this surface. Standard "Включить" / "Не сейчас" actions.

### Push Body Copy & Privacy (NPUSH-08)
- **D-07:** Bodies are **fully generic, one canonical line per category** — NO make/model, NO price, NO KGS amount. Same body text for every event of a given category (new saved-search match, price-drop, booked, sold, back-available).
- **D-08:** Structure is **category-specific title + generic body** (e.g. title "Цена снизилась" / body "Откройте, чтобы посмотреть"), not a single app-name-titled line.
- **D-08b:** **Hard-banned from any push payload regardless of category:** price amount (KGS), seller identity, and exact location. These must never reach the lock screen.

### Denied-Permission Recovery (NPRF-07 fallback)
- **D-09:** Re-enable path lives on **NotificationSettingsScreen** — a "Push notifications: Off — Enable in Settings" row that **deep-links to the OS app-settings page**. No nagging banner in the notification center.
- **D-10:** Recovery uses **deep-link to OS Settings** (the app cannot re-trigger the native dialog after a deny), not static text instructions.
- **D-11:** NotificationSettingsScreen **reflects live OS permission status** ("On"/"Off" read from the current permission state), so the screen is honest about whether push is actually enabled.

### Claude's Discretion
- Device-token model shape / multi-device handling, OAuth caching mechanics, exponential-backoff tuning, and channel/entitlement wiring details — all locked-in by NPUSH-02..06 requirements and left to research/planning.
- notifee adoption — deferred to spike (D-03).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 13 section (Goal, Depends-on, 5 Success Criteria). Phase 13 success criteria lock most of the *what* and much of the *how*.
- `.planning/REQUIREMENTS.md` — NPUSH-01..08 and NPRF-06 (acceptance phrasing for spike gate, install, APNs, token lifecycle, send loop, 3-state, deeplink, PII-safe bodies, pre-prompt).

### Upstream phase this builds on
- `.planning/phases/12-notification-domain-in-app-center/12-CONTEXT.md` — Phase-12 in-app center decisions; it is the denied-push fallback and the source of the `fcm.send` stub Phase 13 replaces. Tone/copy precedent (D-14 empty-state).

### Backend integration point
- `../backend-services/carEx-services/src/notifications/push/fcm.js` — the existing `fcm.send` **stub** that Phase 13's firebase-admin send loop (NPUSH-05) replaces. (Backend is a sibling repo — see [[backend_repo_location]]; Railway deploys backend `main`, mind the split-repo gotcha [[backend_deploy_gotcha]].)

### iOS native build (spike-critical)
- `ios/Podfile` — existing Stripe + fmt/C++17 post-install hooks that the `use_frameworks! :linkage => :static` switch must preserve.
- `index.js` — `setBackgroundMessageHandler` must register at the very top (NPUSH-06).
- `App.tsx` — existing `linking` config (`https://www.carexmarket.com`, `carex://`, `listing/:carId` → CarDetails) that `data.deeplink` routes through (NPUSH-07).

### Memory (must respect)
- [[firebase_sdk_split]] — native Firebase SDK is problematic; the spike is the explicit mitigation for adding RNFB. Do not add `@react-native-firebase` outside the spike-gated path.
- [[carex_audience_tone_tolerance]] — RU-first, KG audience, KGS som (not ruble), no Russia-specific terms. Applies to all user-facing strings.
- [[car_id_field_unreliable]] — server-side deeplinks built with `car._id || car.id || carId`, never bare `car.id`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NotificationSettingsScreen.tsx` — host for the denied-recovery row (D-09/D-10/D-11); already has the per-category toggle / settings layout pattern.
- `AuthContext` — token lifecycle hooks in (register on login/signup, unregister on logout *before* the idToken ref clears) per NPUSH-04.
- `NotificationService` / `NotificationContext` (Phase 12) — existing REST-based notification plumbing the pre-prompt and subscription flows attach to.
- Existing `linking` config in `App.tsx` — deeplink routing reused as-is for push taps (no new route wiring needed).

### Established Patterns
- Hybrid auth ([[firebase_sdk_split]]): mobile uses Identity Toolkit REST, NOT native Firebase — RNFB messaging is the *first* native Firebase dependency and is therefore spike-gated.
- All HTTP lives in `AuthService.ts` (despite the name) — device-token register/unregister endpoints likely belong there.
- i18n via `useLanguage().t`, RU default, strings in `src/constants/translations.ts` — pre-prompt + recovery + notification-status copy must have RU/EN parity.

### Integration Points
- `index.js` top → `setBackgroundMessageHandler` (must be outside the React tree).
- Backend `fcm.js` stub → firebase-admin `messaging().send()` per-token loop with prune-on-`UNREGISTERED`/`INVALID_ARGUMENT`.
- Send path → re-checks hide-hook/moderation status at send time (TOCTOU, NPUSH-08) before emitting any push.

</code_context>

<specifics>
## Specific Ideas

- Pre-prompt example copy (RU): "Включить уведомления, чтобы не пропустить новые совпадения?" with "Включить" / "Не сейчас".
- Push example (price-drop): title "Цена снизилась", body "Откройте, чтобы посмотреть" — illustrative; planner finalizes per-category lines with RU/EN parity, observing the D-08b hard-ban.
- Recovery row example: "Push-уведомления: выключены — включить в настройках" deep-linking to OS settings.

</specifics>

<deferred>
## Deferred Ideas

- **Re-attempting native push after a spike abort** — if D-02 abort fires, push transport returns in a future milestone, not this one.
- **UNHINGED-voice push copy** — sharper market-voice notification bodies were considered and rejected for this phase (D-06); could revisit as a later copy/tone polish.
- **In-notification-center re-enable banner** — considered (Area 4 option 2) and rejected in favor of the Settings-screen-only path (D-09); revisit only if re-enable conversion proves too low.

None of the above expand this phase's scope.

</deferred>

---

*Phase: 13-fcm-push-transport-native*
*Context gathered: 2026-06-06*
