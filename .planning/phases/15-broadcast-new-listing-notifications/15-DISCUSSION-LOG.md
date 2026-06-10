# Phase 15: Broadcast New-Listing Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 15-broadcast-new-listing-notifications
**Areas discussed:** In-app reach for non-push users, Daily-cap reset, Tap target, Re-list/trigger scope

> Note: questions were re-asked in plainer language at the user's request (dropping file/decision-code references). Initial multiSelect "which areas to discuss" was replaced with direct plain-language decisions.

---

## In-app reach for non-push users

| Option | Description | Selected |
|--------|-------------|----------|
| Everyone | Even people who turned push off see new listings in the in-app bell list | |
| Only people with push on | Bell entry created only for people who allowed notifications (token-holders) | ✓ |

**User's choice:** Only people with push on
**Notes:** Recipient source of truth becomes the DeviceToken collection (distinct uids). Narrows SPEC req 1's "all push-enabled users" to token-holders; no full User-collection scan.

---

## Daily-cap reset

| Option | Description | Selected |
|--------|-------------|----------|
| Every morning (local time) | Count resets each morning on Asia/Bishkek time, same as the Phase-14 digest | ✓ |
| Rolling 24 hours | Per-person window is the last 24h from their own alerts | |

**User's choice:** Every morning (local Bishkek time)
**Notes:** Cap = 5 broadcast pushes/user/day. Reuses the digest's morning boundary for consistency.

---

## Tap target

| Option | Description | Selected |
|--------|-------------|----------|
| That car's detail page | Opens the specific new listing (carex://listing/:carId) | |
| A list of new cars | Opens search/browse results (carex://search) | ✓ |

**User's choice:** A list of new cars
**Notes:** Follows the existing new_match → SearchResults deep-link pattern, not the watch-family CarDetails pattern. Goal is to pull users into browsing.

---

## Re-list / trigger scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only brand-new cars alert | Fires once at creation; hidden→active re-list stays quiet | ✓ |
| Re-shown cars can alert again | Un-hiding a car sends a fresh alert | |

**User's choice:** Only brand-new cars alert
**Notes:** Broadcast rides the existing new_listing emit at creation only. Prevents sellers toggling visibility to re-notify.

---

## Claude's Discretion

- Cap counting mechanism / `pushSent` marker on broadcast rows (constraint: cannot equate rows-created with pushes-sent, since capped rows still write the bell entry).
- Broadcast target shape inside `emit()` (`{ uid }` descriptor vs parallel branch) preserving guard order.
- New eventType / dedupeKey name for broadcasts (e.g. `new_listing_broadcast`).
- Recipient-query performance approach (off-hot-path, after-commit).

## Deferred Ideas

- Personality-tier-aware broadcast push copy (server has no tier signal today).
- In-app new-arrivals feed for users without push (broader reach without sending pushes).
- Segmentation/region targeting, admin-curated featured listings, quiet-hours enforcement, digest roll-over of capped overflow — all explicitly out per SPEC.md.
