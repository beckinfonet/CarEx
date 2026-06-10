# Phase 15: Broadcast New-Listing Notifications - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

When a new active car listing is created, fan out a notification to all push-enabled users (not just those with a matching saved search or watch), gated by a per-user daily cap, with a new opt-out "New Listings" category. Builds on the v1.2 notification engine (`emit()`, FCM transport, in-app center, `User.notificationPrefs`). Does NOT add segmentation, admin curation, quiet-hours enforcement, or digest roll-over.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `15-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `15-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- All-users broadcast recipient resolution (push-enabled, category-enabled, actor-excluded)
- `new_listing` → broadcast `Notification` row creation + OS push
- Dedup so saved-search-matched users are removed from the broadcast audience for the same listing
- First real per-user daily-cap enforcement on the broadcast push path (in-app entry uncapped relative to push)
- New "New Listings" category toggle (default ON / opt-out) in `NotificationSettingsScreen` + per-user preference persistence
- RU/EN broadcast copy in `translations.js`
- Send-time hide-hook re-read + actor exclusion on the broadcast path

**Out of scope (from SPEC.md):**
- Audience segmentation (active-only, region/city match)
- Admin-curated / "featured" listing flagging
- Quiet-hours enforcement (`quietHours` stays persisted-not-enforced)
- Rolling cap-overflow into the daily digest
- Opt-in flows / first-run promotion of the new category
- Changing existing Saved Search / Watch behavior or copy (except dedup precedence)
- Backfilling / notifying about pre-existing listings

</spec_lock>

<decisions>
## Implementation Decisions

### Recipient set & in-app reach
- **D-01:** Broadcast recipients = **users who have push on** (at least one `DeviceToken` row) AND have not muted the New Listings category AND do not have `muteAll`. Both the OS push AND the in-app bell entry go to this same set.
- **D-02:** Users with **no device token get nothing** — no in-app bell entry. (We are NOT writing broadcast rows for the whole User collection.) This narrows SPEC req 1's "all push-enabled users" to token-holders and makes `DeviceToken` (distinct uids) the recipient source of truth, not a full User-collection scan.
- **D-03:** Always exclude the listing's actor (seller). Always exclude any uid who received a `new_match` (saved-search) notification for this same car in this emit cycle — **saved-search wins** the dedup (per SPEC req 2).

### Daily cap
- **D-04:** Cap = **5 broadcast pushes per user per day**. Counter resets **every morning on local Bishkek time (Asia/Bishkek)** — the same boundary the Phase-14 digest already uses. Not a rolling 24h window.
- **D-05:** The cap counts **only broadcast pushes** (dedicated budget), not all instant notifications — so saved-search/watch alerts never consume the broadcast budget and vice-versa. *(Claude's discretion — see below — chose a dedicated counter over reusing the shared `dailyCap` pref value as the live budget.)*
- **D-06:** When a user is over cap: still **write the in-app bell entry**, but **suppress the OS push**. The in-app entry is never capped (only the push is). Capped overflow is NOT rolled into the digest (per SPEC out-of-scope) — it simply lives in the bell list.

### Tap target & copy
- **D-07:** Tapping a broadcast opens a **list of new cars (search/browse results)**, NOT the single car's detail page. Deep-link follows the existing `new_match` pattern → `carex://search` (newest-first browse), not the watch-family `carex://listing/:carId`.
- **D-08:** Push copy is **generic and PII-free** (lock-screen safe, consistent with the Phase-12 D-07/D-08 policy `fcm.js` already enforces): a "New Listings" category title + one canonical body, no make/model/price/seller. RU-first with EN parity, new keys in `translations.js`.
- **D-09:** Copy is **neutral / informational tone — NOT personality-tier-aware** for this phase. (Tier voice is client-side only; server push has no tier signal. Tier-aware broadcast copy is deferred — see Deferred Ideas.)

### Trigger scope
- **D-10:** Broadcast fires **only on first creation** — it rides the existing `new_listing` emit (`server.js:~914`, after-commit). A listing that goes hidden→active again (re-list / un-hide) does **NOT** re-broadcast. No new trigger is added for re-activation.

### New preference field
- **D-11:** Add `newListingEnabled` (default `true`) to `User.notificationPrefs`, surfaced as a third "New Listings" toggle in `NotificationSettingsScreen` (RU label "Новые объявления"), persisted via the existing `AuthService.updateBackendUser` path — the same mechanism `savedSearchEnabled`/`watchEnabled` use. A user who never touched it is treated as enabled. `muteAll` still suppresses everything.

### Claude's Discretion
- **Cap counting mechanism:** how "pushes sent today" is counted is left to research/planning, BUT a hard constraint falls out of D-06: because the in-app row is written even when the push is suppressed, you **cannot** equate "broadcast rows created today" with "pushes sent today." Each broadcast row must record whether its push was actually sent (e.g. a `pushSuppressed`/`pushSent` marker), and the cap must count sent pushes — not rows. Confirm the cleanest representation during research.
- **Broadcast target shape inside `emit()`:** today every target carries a `sub` object; broadcast recipients have no subscription. The actor-exclusion and dedup code currently assume `t.sub.uid`. Planner decides whether to introduce a `{ uid }`-shaped target descriptor or a parallel broadcast branch — but it must preserve the existing guard order (hide-hook re-read → resolve → actor-exclude → dedup).
- **New eventType / dedupeKey for broadcasts:** needs its own event type (e.g. `new_listing_broadcast`) so its `${carId}:${eventType}` dedupeKey never collides with `new_match`. Exact name is Claude's discretion.
- **Recipient query performance:** the fan-out runs after-commit / off the car-create hot path (matching existing emit hooks); the DeviceToken→distinct-uid resolution and pref filtering approach is Claude's discretion as long as it isn't an O(N) blocking call on the create response.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements (read first)
- `.planning/phases/15-broadcast-new-listing-notifications/15-SPEC.md` — Locked requirements, boundaries, acceptance criteria. MUST read before planning.

### Backend — notification engine (where broadcast is added)
- `backend-services/carEx-services/src/notifications/notificationService.js` — the `emit()` engine + guard order (hide-hook re-read → resolveTargets → actor-exclude → dedup). The broadcast path is added here. ⚠ NEVER add hide-hook bypass flags to the `Car.findById` in this file (grep-gated).
- `backend-services/carEx-services/server.js` (~lines 908–920) — the `new_listing` emit site (after-commit, off-hot-path). Broadcast rides this same emit.
- `backend-services/carEx-services/src/notifications/push/fcm.js` — FCM fan-out; pulls `DeviceToken` rows per uid, renders GENERIC param-free copy (no PII on lock screen), bounded retry + dead-token prune. Category-mute/cap enforcement does NOT belong here — it belongs upstream in recipient resolution.
- `backend-services/carEx-services/src/models/DeviceToken.js` — `{ uid, token(unique), platform, ... }`, indexed on `uid`. The recipient source of truth (distinct uids).
- `backend-services/carEx-services/src/models/User.js` — holds `notificationPrefs` (`muteAll`, `savedSearchEnabled`, `watchEnabled`, `quietHours`, `dailyCap`). Add `newListingEnabled` here.
- `backend-services/carEx-services/src/notifications/translations.js` — server-side RU/EN push/feed copy; category title + canonical body pattern. Add New-Listings keys here.
- `backend-services/carEx-services/src/notifications/matchSavedSearches.js` — saved-search matcher; its output drives the saved-search-wins dedup exclusion set.
- `backend-services/carEx-services/src/notifications/digest.js` — Phase-14 digest worker; reference for the Asia/Bishkek morning boundary the cap reset reuses.

### Mobile — settings UI
- `src/screens/NotificationSettingsScreen.tsx` — existing master mute + per-category toggles (`savedSearchEnabled`/`watchEnabled`) persisting via `AuthService.updateBackendUser` to `user.notificationPrefs`. Add the "New Listings" toggle following this exact pattern.

### Prior phase context (same milestone family)
- `.planning/phases/12-notification-domain-in-app-center/12-CONTEXT.md` — domain models, emit guards, generic-copy/PII policy.
- `.planning/phases/13-fcm-push-transport-native/13-CONTEXT.md` — FCM transport, device-token lifecycle.
- `.planning/phases/14-daily-digest-scheduling/14-CONTEXT.md` — node-cron digest, Asia/Bishkek morning boundary, `digestPending` flush.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `emit()` in `notificationService.js`: extend with a broadcast branch for `new_listing`; reuse its guard order, dedup-row writing, and `fcm.send` call.
- `fcm.send({ uid, ... })`: already does per-uid DeviceToken fan-out + generic copy + retry/prune. Broadcast reuses it as-is — no changes to fcm.js copy/PII policy.
- `NotificationSettingsScreen` toggle pattern + `AuthService.updateBackendUser` persistence: the "New Listings" toggle is a near-copy of the existing `savedSearchEnabled`/`watchEnabled` toggles.
- `translations.js` category title + canonical body pattern: add New-Listings RU/EN keys alongside the existing `new_match`/`price_drop`/etc. entries.
- `digest.js` Asia/Bishkek boundary logic: reference for the daily-cap morning reset.

### Established Patterns
- After-commit emit, off-hot-path, wrapped in try/catch that logs but never throws into the request (`server.js` `[notify] ... emit failed`).
- Notification rows store i18n keys + params, NOT rendered text; deeplink is the only routable payload.
- Dedup via `dedupeKey = ${carId}:${eventType}`, one unread row per (uid, carId, eventType).
- Guard order is security-critical and grep-gated (no hide-hook bypass in `notificationService.js`).

### Integration Points
- `server.js` `new_listing` emit → `notificationService.emit()` → new broadcast branch → `fcm.send` → `DeviceToken` fan-out.
- New `newListingEnabled` pref flows User model → `getBackendUser` merge → `NotificationSettingsScreen` and → backend recipient filtering.

</code_context>

<specifics>
## Specific Ideas

- Daily cap number: **5/user/day** (broadcast-only budget).
- Cap reset boundary: **Asia/Bishkek morning**, matching the Phase-14 digest — keep them on the same clock so behavior is consistent.
- Tap destination: a **new-arrivals / browse list** (`carex://search`), deliberately NOT the single car — the goal is to pull users into browsing, not one listing.
- New-Listings toggle defaults **ON** (opt-out), label "Новые объявления" (RU) / "New Listings" (EN).

</specifics>

<deferred>
## Deferred Ideas

- **Personality-tier-aware broadcast copy** — make the New-Listings push voice match the user's chosen personality tier (neutral/UNHINGED/etc.). Server push currently has no tier signal and copy is generic/PII-free; wiring tier into server-rendered push is its own effort. Revisit as a future enhancement.
- **In-app feed entry for users without push** — broadening the bell "new cars" feed to people who declined OS push (considered in D-02, chosen against for this phase). A future "in-app new-arrivals feed" could cover them without sending pushes.
- **Audience segmentation / region targeting, admin-curated featured listings, quiet-hours enforcement, digest roll-over of capped overflow** — all explicitly out per SPEC.md; recorded here so future phases know they were intentionally excluded.

None of the above are in this phase — discussion stayed within the SPEC boundary.

</deferred>

---

*Phase: 15-broadcast-new-listing-notifications*
*Context gathered: 2026-06-10*
