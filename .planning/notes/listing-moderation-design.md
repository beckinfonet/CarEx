---
title: Admin Listing Moderation — Design Decisions
date: 2026-05-28
context: Pre-planning design exploration for LIST-01..02 carry-forward from v1.0
status: design-decided (not yet planned)
---

# Admin Listing Moderation — Design Decisions

Captured from `/gsd-explore` session on 2026-05-28. These decisions feed `gsd-spec-phase` and `gsd-plan-phase` when this work is picked up as part of the next milestone.

## Scope

Give admin users explicit moderation control over **car listings** (not users — that shipped in v1.0). Four distinct actions, with visible UI distinctions so admins reason clearly about intent.

## The four actions

| Action | Visual | When to use | Reversal |
|---|---|---|---|
| **Edit** | Neutral, pencil icon | Fix typos, correct policy issues, update on behalf of unresponsive seller | (just save) |
| **Suspend** | Warning, orange | Active concern — policy review, temporary timeout, awaiting investigation | "Unsuspend" → active |
| **Archive** | Neutral, gray | Seller went inactive / abandoned / no longer relevant. **Not punitive.** | "Restore" → active |
| **Delete** | Destructive, red + confirm | Spam / illegal / severe. Soft-removed from default views. | "Recover" from admin "Deleted" view |

True hard-delete (DB wipe) **stays off the UI** — backend op only when actually required.

## Data model (single status field)

All four actions write to one field on the listing document:

```
status: 'active' | 'suspended' | 'archived' | 'deleted'
moderationReason?: string
moderatedBy?: string   // admin uid (Firebase)
moderatedAt?: Date
lastEditedBy?: string  // admin uid when admin used Edit
```

Public GET endpoints filter to `status: 'active'`. Admin sees all and can filter by status.

## Audit trail

Reuse the v1.0 audit pattern. Either:
- Extend the existing `ModerationAction` collection (used for user moderation) to also accept listing-target rows, OR
- Add a sibling `ListingModerationAction` collection with the same append-only shape.

Either way, every state transition writes a row: `{ listingId, fromStatus, toStatus, adminUid, reason, timestamp }`. Append-only with the same Mongoose pre-hooks rejecting mutations (per Phase 1 of v1.0).

Restore is one logical operation — flip back to `'active'` regardless of source state. Don't build three separate restore endpoints.

## UI placement (v1)

- Inline on `CarDetails` behind a single admin-only "Moderate" badge → opens a bottom sheet with the 4 action buttons + reason dropdown
- Reuse `EditCarScreen` for the Edit action (open the existing seller form pre-filled) — pending research on field coverage (see `research/questions.md`)
- No new dedicated admin listings panel for v1; defer to v2

## Buyer/cart impact (pause, don't cancel)

Follow the v1.0 user-moderation rule:

- Cart with a non-`'active'` listing → banner + disabled checkout. Don't auto-clear the cart — let the buyer see what happened.
- Already-paid in-flight orders → listing reference stays intact, order proceeds. Admin can manually cancel if needed.
- Listing detail screen for affected buyer → shows a banner with status reason (severity-aware, like UserStatusBanner from v1.0 Phase 6).

## i18n

Reason taxonomy is a shared enum across Suspend / Archive / Delete (one dropdown, RU+EN parity). Keeps translation surface small. All button labels + banner copy go in `src/constants/translations.ts`.

## Backend endpoint shape

Under the established `/api/admin/moderation/listings/*` namespace:

- `PATCH /:carId/suspend` — body `{ reason }`
- `PATCH /:carId/archive` — body `{ reason }`
- `PATCH /:carId/delete` — body `{ reason }` (soft-delete only)
- `PATCH /:carId/restore` — flips status back to `'active'`
- `PATCH /:carId` — admin edit (full field set)
- `GET  /` — admin-only paginated list filtered by status

All routes require `firebase-admin.verifyIdToken()` + admin role check (same pattern as v1.0). No `callerUid`-in-body.

## What's deferred to v2

- Bulk admin listings panel (filter by status, batch actions)
- Hard-delete UI affordance
- Automated flagging queue (LIST-02) — e.g., 3 buyer reports → auto-suspend
- Listing-status email / push notifications to seller (rides on the NOTF-01..03 carry-forward)

## Mobile client surface (delta)

Three new methods on `AuthService.ts`:
- `archiveListing(carId, reason)`
- `restoreListing(carId)`
- `adminEditListing(carId, fields)`

Plus a fourth `suspendListing(carId, reason)` and `deleteListing(carId, reason)` if we're keeping all four explicit (yes — per the visible-distinctions decision).

So actually **five** new methods: `suspendListing`, `archiveListing`, `deleteListing`, `restoreListing`, `adminEditListing`.

## Open question (research-tracked)

Does the existing seller `EditCarScreen` form expose every field an admin would realistically need to edit (status, hidden flags, seller metadata)? Tracked in `.planning/research/questions.md`.

## Linked artifacts

- Carry-forward placeholder: `.planning/milestones/v1.0-REQUIREMENTS.md` → "LIST-01..02 — Listing-level moderation + automated flagging queue"
- v1.0 milestone summary: `.planning/MILESTONES.md` → patterns to reuse (cryptographic admin auth, append-only audit, severity-aware banner, dual-role contract style)
