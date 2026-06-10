# Phase 15: Broadcast New-Listing Notifications — Specification

**Created:** 2026-06-10
**Ambiguity score:** 0.17 (gate: ≤ 0.20)
**Requirements:** 7 locked

## Goal

When a new active car listing is created, every push-enabled user (except the seller and except users who already received a saved-search match for that listing) receives exactly one OS push and one in-app feed entry — gated by a per-user daily cap — without the user having created any saved search or watch.

## Background

The v1.2 Notifications milestone (Phases 12–14) shipped a complete subscription-based notification system on `main` and on backend `origin/main`:

- **Emit pipeline:** Car creation fires a `new_listing` event (`carEx-services/server.js:911-921`) which the `NotificationService` fans out **only to matching Saved Searches** (`src/notifications/notificationService.js:98-110`, matcher in `matchSavedSearches.js`).
- **Subscription model:** `kindEnum = z.enum(['saved_search', 'watch'])` (`src/notifications/schemas.js:17`). There is **no broadcast/all-users path** — every recipient today comes from a `Subscription` row the user explicitly created.
- **Transport:** FCM push (Phase 13, firebase-admin send loop) + in-app notification center / bell (Phase 12 `Notification` model) + daily-digest worker (Phase 14, `node-cron`, `digestPending` flag).
- **Guards:** NDOM-02 hide-hook re-read at send time (re-reads the Car with no bypass flags so a listing hidden between create and send is suppressed, `notificationService.js:165-168`); NDOM-03 actor exclusion (the listing's creator never gets a notification for it, `notificationService.js:174`).
- **Preferences:** `NotificationSettingsScreen` exposes two category toggles — "Saved Searches" and "Watched Cars". A per-user `dailyCap` preference and `quietHours` exist but are **persisted, not enforced on the instant-push path** (only the digest consumes `digestPending`).
- **i18n:** Push copy is server-side, RU-first with EN parity, one canonical body per category + a category-specific title, zero interpolation tokens / no PII (`src/notifications/translations.js:52-53`).

**The gap:** There is no way to notify a user about a new listing they did not explicitly subscribe to. This phase adds an all-users broadcast recipient path (sourced from the User collection, not `Subscription`), a new default-on opt-out category, dedup against saved-search matches, and the first real per-user daily-cap enforcement on the instant-push path.

## Requirements

1. **Broadcast recipient resolution**: A `new_listing` event resolves recipients as all push-enabled users, not just matching subscriptions.
   - Current: `new_listing` only resolves `Subscription` rows of `kind: 'saved_search'`; there is no User-collection recipient path
   - Target: `NotificationService` resolves the broadcast audience by querying the User collection for users who have a registered device token / push enabled and have not muted the New Listings category, **excluding the listing's actor (seller)**
   - Acceptance: For a new active listing created by seller S, every push-enabled user except S is in the resolved broadcast audience; S is never in it

2. **Dedup against Saved Search**: A user who already gets a saved-search match for a listing is not also broadcast to for the same listing.
   - Current: No broadcast path exists, so no dedup exists
   - Target: When resolving the broadcast audience for a `new_listing` event, any user who received a saved-search match notification for that same listing is removed from the broadcast audience (saved-search copy wins)
   - Acceptance: A user whose Saved Search matches listing L receives exactly one notification for L (the saved-search match), not two; a user with no matching Saved Search receives exactly one broadcast for L

3. **Push + in-app feed entry**: Each broadcast creates a persistent in-app notification and (cap permitting) an OS push.
   - Current: Only subscription-driven events create `Notification` rows + pushes
   - Target: Each eligible broadcast recipient gets a `Notification` row (visible in the in-app center/bell, deep-linkable to the listing) and, if under cap, one OS push
   - Acceptance: After a broadcast, each eligible non-capped recipient has exactly one new `Notification` row and received exactly one OS push; the row deep-links to the listing's CarDetails

4. **Per-user daily cap enforcement (push)**: Broadcast pushes are capped per user per day; the in-app entry is never capped.
   - Current: `dailyCap` preference is persisted but not enforced on the instant-push path
   - Target: Broadcast OS pushes are counted against the user's `dailyCap` (default 5/user/day); once a user is at cap for the day, further broadcasts that day write the in-app `Notification` row but send **no** OS push
   - Acceptance: A user at their daily broadcast cap receives the in-app feed entry for a new listing but receives zero additional OS pushes for the rest of that day; the next day the cap resets

5. **New "New Listings" category (default ON, opt-out)**: Users can mute broadcasts independently of Saved Searches and Watches.
   - Current: `NotificationSettingsScreen` has only "Saved Searches" and "Watched Cars" toggles
   - Target: A third "New Listings" category toggle exists, defaults ON for users who have never set it, and persists to the per-user notification preferences; muting it suppresses both the OS push and the in-app feed entry for broadcasts
   - Acceptance: A user who has never touched the toggle is treated as enabled and receives broadcasts; toggling it OFF stops all subsequent broadcast pushes AND feed entries for that user; Saved-Search and Watch notifications are unaffected by the toggle

6. **Send-time moderation guards preserved**: Broadcasts honor the existing hide-hook and actor-exclusion guards.
   - Current: NDOM-02 (hide-hook re-read) and NDOM-03 (actor exclusion) protect saved-search fan-out
   - Target: The broadcast path re-reads the Car at send time with no bypass flags (suppressing a listing hidden/suspended/sold between create and send) and excludes the actor
   - Acceptance: A listing hidden or suspended between creation and send produces zero broadcast pushes and zero broadcast feed entries; the seller receives zero broadcast notifications for their own listing

7. **RU/EN broadcast copy**: Broadcast push/feed copy exists in both languages with no PII.
   - Current: No broadcast category copy exists in `translations.js`
   - Target: A New-Listings category title + one canonical body (zero interpolation tokens, no PII), RU-first with EN parity, following the existing `push_*` category pattern
   - Acceptance: Broadcast copy renders correctly for a `User.language = 'RU'` and a `User.language = 'EN'` recipient; the body contains no listing-specific PII (price, VIN, seller name)

## Boundaries

**In scope:**
- All-users broadcast recipient resolution from the User collection (push-enabled, category-enabled, actor-excluded)
- `new_listing` → broadcast `Notification` row creation + OS push
- Dedup so saved-search-matched users are removed from the broadcast audience for the same listing
- First real per-user daily-cap enforcement on the broadcast push path (in-app entry uncapped)
- New "New Listings" category toggle (default ON / opt-out) in `NotificationSettingsScreen` + per-user preference persistence
- RU/EN broadcast copy in `translations.js`
- Send-time hide-hook re-read + actor exclusion on the broadcast path

**Out of scope:**
- Audience segmentation — active-users-only, region/city match, or any targeting beyond "all push-enabled, opt-out" — deferred; the only location signal is device-timezone→city and product chose full broadcast
- Admin-curated / "featured" listing flagging — not building an admin gate this phase; all new active listings broadcast
- Quiet-hours enforcement — `quietHours` remains persisted-not-enforced; only the daily cap gates pushes here
- Rolling cap-overflow into the daily digest — overflow simply drops the push and keeps the in-app entry (no digest change)
- Opt-in flows / first-run promotion of the new category — category just defaults ON
- Changing existing Saved Search or Watch behavior or copy — untouched except for dedup precedence
- Backfilling / notifying about listings that already exist at ship time — broadcasts fire only for listings created after this ships

## Constraints

- **No new state-management or networking libraries** (per milestone constraint) — reuse axios/AsyncStorage on mobile, Mongoose/firebase-admin on backend.
- **Reuse existing infra:** FCM transport, `Notification` model, `NotificationService` fan-out, `NotificationSettingsScreen` toggle pattern. Broadcast is **not** a new `Subscription` kind — recipients come from the User collection.
- **Recipient resolution must not be O(N) per-listing on the hot request path** — the broadcast fan-out runs after-commit / off the car-create response (consistent with the existing after-commit emit hooks), and the User query is indexed on push-enabled + category-enabled.
- **Daily cap default = 5 broadcast pushes/user/day**, driven by the user's existing `dailyCap` preference value where set.
- **i18n:** RU-first, EN parity, one canonical body per category, zero interpolation tokens, no PII (matches `translations.js` D-07/D-08 pattern).
- **No regression** to signup/login, listing browse, cart, Stripe checkout, or existing Saved-Search/Watch notifications.

## Acceptance Criteria

- [ ] Creating a new active listing produces exactly one in-app `Notification` row for every push-enabled, category-enabled user except the seller and except users who received a saved-search match for that same listing
- [ ] Each eligible non-capped recipient receives exactly one OS push for that listing
- [ ] A user at their daily broadcast cap receives the in-app feed entry but zero additional OS pushes for the rest of that day
- [ ] Muting the "New Listings" category stops both pushes and feed entries for that user; a user who never set it defaults to enabled
- [ ] Saved-Search and Watch notifications are unchanged for a user who mutes "New Listings"
- [ ] A listing hidden/suspended/sold between create and send produces zero broadcast pushes and zero broadcast feed entries
- [ ] The seller of a listing receives zero broadcast notifications for it
- [ ] Broadcast copy renders in RU and EN with a category-specific title + canonical body and contains no listing PII

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                  |
|--------------------|-------|------|--------|--------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | All-users, instant push, daily-capped, default-on      |
| Boundary Clarity   | 0.82  | 0.70 | ✓      | Segmentation/admin-curation/quiet-hours explicitly out |
| Constraint Clarity | 0.78  | 0.65 | ✓      | Reuse infra; cap enforcement net-new; User-collection path |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 8 pass/fail criteria                                   |
| **Ambiguity**      | 0.17  | ≤0.20| ✓      |                                                        |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective       | Question summary                          | Decision locked                                      |
|-------|-------------------|-------------------------------------------|------------------------------------------------------|
| 1     | Researcher        | Who receives a broadcast?                 | All users (opt-out), not segmented                   |
| 1     | Simplifier        | How to prevent spam on every-listing fire?| Instant push + per-user daily cap                    |
| 1     | Simplifier        | Default state of new category?            | Default ON (opt-out)                                 |
| 2     | Failure Analyst   | Dedup vs Saved Search double-notify?      | Saved Search wins, suppress broadcast                |
| 2     | Boundary Keeper   | Transport — push only or in-app too?      | Push + in-app feed entry (Notification row)          |
| 2     | Failure Analyst   | Cap-overflow behavior?                    | Drop push, keep in-app feed entry                    |

---

*Phase: 15-broadcast-new-listing-notifications*
*Spec created: 2026-06-10*
*Note: v1.2 Notifications milestone (Phases 12–14) is complete. This phase is net-new and not yet in ROADMAP.md — it opens v1.3 (or a carry-forward). Add it to a milestone before discuss-phase if you want roadmap tracking.*
*Next step: /gsd-discuss-phase 15 — implementation decisions (how to build what's specified above)*
