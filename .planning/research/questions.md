# Open Research Questions

Append-only list of questions surfaced during exploration that need investigation before the corresponding work can be planned. Resolve into `.planning/research/*.md` or inline answers when answered.

---

## Q-001 — Admin Listing Edit: does the seller `EditCarScreen` cover all fields admins need?

**Raised:** 2026-05-28 (via `/gsd-explore` — LIST-01 design)
**Status:** open
**Blocks:** LIST-01 admin Edit action (mobile)

**Question.** Does the existing seller-facing `src/screens/EditCarScreen.tsx` (or the equivalent edit flow used to update a car listing) expose every field an admin would realistically need to modify when correcting a listing on a seller's behalf?

**Why it matters.** The design decision in `notes/listing-moderation-design.md` is to **reuse** `EditCarScreen` for the admin Edit action rather than build a parallel form. If the seller form hides fields admins legitimately need (e.g. listing `status`, hidden flags, seller-set vs. system-set fields, internal moderation metadata), we either:

1. Extend `EditCarScreen` with an `isAdminEditing` mode that shows additional fields, OR
2. Build a separate `AdminEditListingScreen` mirroring the seller form + extra fields.

Picking (1) is cheaper but pollutes the seller component; picking (2) keeps concerns separate but duplicates form code.

**Investigation steps.**
1. Read `src/screens/EditCarScreen.tsx` (or grep for the screen handling car edits — there may not be one named exactly this).
2. Compare its field set against the full car model schema on the backend (`backend-services/carEx-services` — sibling repo, see [Backend repo filesystem location memory]).
3. Identify any fields excluded from seller editing that an admin would need (status, moderation reason fields, audit fields, hidden listing flags).
4. Note any field-level access control that already exists.

**Answer destination.** When resolved, write findings to `.planning/research/LIST-01-admin-edit-field-coverage.md` and update this entry with a one-line summary + link.
