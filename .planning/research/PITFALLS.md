# Pitfalls Research

**Domain:** Admin moderation on a React Native + Express/Mongo car marketplace (post-approval user control: suspend, revoke role, delete/edit provider profile, audit trail, in-app banner)
**Researched:** 2026-04-17
**Confidence:** HIGH on authorization + data-integrity items (verified with Firebase docs, MongoDB auditing docs, GDPR Art. 17 guidance, and the existing codebase); MEDIUM on mobile UX / status-propagation specifics (derived from stack constraints and general patterns).

This file is scoped to the subsequent moderation milestone. It is opinionated about *this* codebase, not moderation in general. Every pitfall references the specific existing-code reality that makes it likely here.

## Critical Pitfalls

### Pitfall 1: Admin endpoints still trust `callerUid` from the request body

**What goes wrong:**
The current admin-auth pattern passes `callerUid` in body/query and the backend calls `getAdminStatus(callerUid)` to gate the action (see `src/services/AuthService.ts:245-287` — `approveRequest`, `rejectRequest`, `addAdminUser`, `removeAdminUser` all send `callerUid` in the body). The server never verifies that the caller actually *is* that UID. Anyone with a valid Firebase UID for any admin in the system (which is trivially leaked — admin UIDs show up in `/api/admin/users` responses and audit rows) can POST `callerUid: <anyAdminUid>` from curl and execute moderation. Adding `suspend`, `revoke`, `deleteProfile` to this pattern turns a latent auth hole into an *anyone-can-ban-anyone* hole.

**Why it happens:**
The existing pattern already shipped and "works." Copy-pasting `callerUid` into new moderation routes feels consistent with the current code. Firebase integration uses the REST API, not the Admin SDK, so there's no drop-in `verifyIdToken` helper wired up — adding it feels like yak-shaving during a moderation milestone. Consistency with the broken pattern beats fixing it.

**How to avoid:**
- Ship a backend middleware `requireAdmin(req)` that (a) reads `Authorization: Bearer <idToken>`, (b) verifies it via Firebase Admin SDK `auth().verifyIdToken(idToken)`, (c) extracts `uid` from the *decoded token* (never body), (d) checks `isAdmin(uid)` against the admin collection, (e) attaches `req.adminUid` for downstream handlers. Every new moderation endpoint uses this middleware. `callerUid` in body is ignored.
- Mobile side: `AuthService` already has `getToken()` returning the Firebase idToken stored in AsyncStorage. Attach it as `Authorization: Bearer ${token}` to every admin request. Do *not* keep passing `callerUid` in body for new endpoints.
- Firebase idTokens are short-lived (1h). Wire token refresh into the axios interceptor so admin sessions don't silently 401 mid-action; refresh via `POST https://securetoken.googleapis.com/v1/token` with the stored refreshToken.
- Backend: install `firebase-admin`, initialize with a service account, expose verification through a single `auth.ts` module. Do not reinvent JWT verification.

**Warning signs:**
- Any new route handler reading `req.body.callerUid`.
- PR diff that adds a route under `/api/admin/moderation/*` but does not import the new `requireAdmin` middleware.
- Integration test that can POST a moderation action with only a UID and no bearer token.

**Phase to address:**
Phase 1 (Backend foundation). Must land *before* any moderation route is implemented. Retrofitting auth after endpoints exist is what got us into the current `callerUid` pattern — do not do this twice.

---

### Pitfall 2: Race condition — admin suspends mid-checkout, payment succeeds against a suspended seller

**What goes wrong:**
Buyer opens a listing, tap Pay, mobile calls `POST /api/payments/create-payment-intent`. Admin clicks Suspend on that seller in the same second. Payment intent already exists client-side; Stripe confirms; mobile calls `POST /api/payments/confirm-booking`. If `confirm-booking` doesn't re-read the seller's moderation status inside the same transaction as order creation, money moves and an order is created against a banned seller. Worse: banner shows seller is suspended, buyer has paid, order exists, seller can't fulfil because they can't log in.

**Why it happens:**
Natural boundary thinking: "auth was checked at `create-payment-intent`, so we're good." Mongo isn't a SQL DB so developers skip the `findOneAndUpdate` with a status guard and rely on a prior read. No transaction wrapping the confirm step. The existing order/payment flow does not re-check provider state at confirmation time.

**How to avoid:**
- On `POST /api/payments/confirm-booking`: re-read seller + all providers (broker/logistics) targeted by the cart in a single Mongoose transaction (`session.startTransaction()` against a replica set — Atlas supports this). If any is not `active`, reject with a specific error code (`provider_suspended`) and *do not capture the charge* — cancel the PaymentIntent or refund if already captured.
- Use `findOneAndUpdate({ _id, status: 'active' }, { $inc: { inFlightOrders: 1 } })` to atomically claim provider capacity at order creation; if document not matched, the status changed under you — abort.
- On `POST /api/admin/moderation/:targetUid` (suspend/revoke): within the same transaction that flips `user.moderation.status`, set a short-lived `moderation.statusVersion` bump so downstream reads can detect the change; also mark any orders in `pending_payment` state as `cancelled_due_to_provider_suspension` and trigger refund for anything already captured in that window.
- Mobile: surface `provider_suspended` error code as "This seller is no longer available. You have not been charged." — do not let the generic error handler swallow it into "Payment failed, try again."

**Warning signs:**
- `confirm-booking` handler reads provider status once at the top of the function, then does async work, then writes an order — classic TOCTOU.
- No transaction wrapping in moderation routes.
- Admin tooling lacks a "recent suspensions" view showing in-flight orders affected.

**Phase to address:**
Phase 2 (Suspend action) and Phase 3 (Provider delete). Cannot be bolted on after UI lands — the re-check must be in the *existing* payment/order routes, which is cross-cutting work.

---

### Pitfall 3: Cascading deletes destroy order history and accounting records

**What goes wrong:**
Admin clicks "Delete provider profile" on a broker. Naive implementation runs `Broker.deleteOne({ firebaseUid })` and `Order.deleteMany({ providerUid: firebaseUid })` "to clean up." The buyer's order history now has holes. Stripe receipts reference an order ID the backend no longer has. Financial reporting (which revenue quarter did this broker's orders fall in?) breaks silently. GDPR right-to-erasure doesn't require this — in fact, legitimate business purpose (tax, dispute resolution, accounting) *requires* retention.

**Why it happens:**
"Delete" feels like it should delete. Mongoose makes `deleteMany` trivially easy. Developers conflate "remove provider from search" with "remove all trace of provider." The PROJECT.md requirement says "delete provider profile" and reads as a single action.

**How to avoid:**
- Define the deletion scope explicitly in the data model. Only the `Broker` / `Logistics` profile *document* is hard-deleted. `User` document persists with `role: 'user'` and `deletedProviderProfile: { type, deletedAt, deletedBy }`.
- `Order` documents never change on profile delete. Instead, at read time, orders display `providerName: order.providerSnapshot.name` (denormalized at order creation — must add this field if not already present) with a "Provider no longer listed" note. Add `providerSnapshot: { name, avatarUrl, companyName }` to the Order schema *before* enabling delete.
- Anonymize by replacing live joins with frozen snapshots, not by nulling references. The `providerUid` stays on the order as a stable ID for accounting; the UI falls back to snapshot if the live profile is gone.
- For hard GDPR erasure of the *user account itself* (separate from profile delete), anonymize `User`: set `email = 'deleted-{hash}@anonymized.local'`, `phone = null`, `displayName = 'Deleted User'`, keep `firebaseUid` as the key. Orders still resolve via snapshot.
- Audit log rows are never deleted or anonymized in this milestone — legal basis is legitimate interest (fraud prevention, operator accountability). Document this decision in Key Decisions.

**Warning signs:**
- Any `deleteMany` on collections other than `brokers` / `logistics_providers`.
- Order schema lacks snapshot fields at the point delete is implemented.
- "What does the buyer see?" is not covered in the delete user story.

**Phase to address:**
Phase 0 (Schema migration: add `providerSnapshot` to Order, `moderation` subdocument to User). Must happen before Phase 3 (Delete action) is implementable.

---

### Pitfall 4: Audit log tampering — the same admin who takes the action can edit or delete the record

**What goes wrong:**
Moderation audit rows are stored in a regular `moderation_audit` collection owned by the same DB user the app uses for reads/writes. A rogue admin (or anyone with DB credentials) can `db.moderation_audit.updateOne({...}, { $set: { note: '' } })` or `deleteOne`. When a dispute arises ("I never suspended that user"), the log is useless as evidence because its integrity is unverifiable.

**Why it happens:**
Mongoose gives you `Model.findByIdAndUpdate` by default — append-only is a discipline, not a built-in. The same app user owns all collections, so there's no DB-level enforcement. MongoDB's built-in auditing (BSON audit events, Atlas database auditing) is a separate system from application audit; developers confuse the two.

**How to avoid:**
- Application-layer discipline: wrap the audit collection behind a module `auditLog.ts` that exposes only `append(row)` and `readByTarget(uid)`. No update/delete exports. Add a runtime assertion in a pre-update hook on the Mongoose model that throws `Error('audit log is append-only')`.
- Schema-level: each audit row includes `prevHash` (SHA-256 of the previous row's contents) and `hash` (SHA-256 of this row). Periodically verify chain. Tampering requires rewriting the tail — detectable.
- DB-level (stretch, low cost on Atlas): create a second DB user `audit_writer` with `insert` privilege only on `moderation_audit`, and have the app connect as this user *only* for audit writes. Main app user has no write permission on that collection. Implementation: a second Mongoose connection instance scoped to audit inserts.
- Enable MongoDB Atlas database auditing on the `moderation_audit` collection for meta-audit (who modified the audit table). Atlas M10+ tier supports this.
- Document in Key Decisions: audit rows are append-only by contract. Any bug requiring retroactive edit is handled by appending a corrective row, not mutating the original.

**Warning signs:**
- Any code path calling `ModerationAudit.updateOne` / `findByIdAndUpdate` / `deleteOne`.
- Audit row schema lacks `prevHash` / `hash`.
- Single DB user handles both app writes and audit writes.

**Phase to address:**
Phase 1 (Audit log schema + append-only module). Has to ship before any moderation action writes its first row, otherwise retrofitting append-only over existing mutable rows is painful.

---

### Pitfall 5: Status propagation lag — user keeps acting between suspension and next login

**What goes wrong:**
Admin suspends user at 10:00:05. User's mobile app is open; `AsyncStorage.userData` still says `{ moderation: { status: 'active' } }`; the UI lets them tap "Contact seller" at 10:00:10. Backend rejects. App shows a generic error. User tries again, thinks the app is broken, logs a support ticket. Worse: if the suspended user is a *seller* with an active listing, they can keep responding to messages, updating listing details, etc., for up to the Firebase idToken lifetime (1h default) before a forced refresh. This is a trust/safety hole, not just a UX glitch.

**Why it happens:**
Client-side state is cached (AsyncStorage `userData`). Navigation guards check the cached state, not the server. Firebase idTokens are long-lived enough to outlive a moderation event. The app doesn't have a server-push channel (no FCM integration for moderation per out-of-scope), so it won't hear about the change proactively.

**How to avoid:**
- **Server-side authoritative status check on every mutating endpoint.** Not just login. Middleware `requireActiveUser(req)` runs after `requireAuth`, reads `user.moderation.status` from DB on every write request, and rejects with `403 { code: 'user_suspended', severity, reason, category }`. Adds one indexed read per write, negligible cost on Atlas M-series.
- **Short moderation-status version on the user document.** `user.moderation.statusVersion: number`. Mobile stores the last known version in AsyncStorage. On every successful response, backend echoes current `X-Moderation-Version` header; if it changed, mobile refetches `/api/users/:uid` and updates local state + navigates to the moderation banner screen if status is no longer `active`.
- **Axios response interceptor on mobile.** On any `403 user_suspended` response, clear in-memory auth state, navigate to the moderation banner screen, show the severity-appropriate message. This catches the case where the user is mid-action when they get suspended.
- **Don't rely on token expiry alone.** 1h is too long for moderation enforcement. The status-check middleware makes token lifetime irrelevant for authorization decisions — the token only proves *who*, the DB decides *whether*.
- Tell the user clearly. The 403 response body includes the same severity + reason the banner will show. Don't let the error get flattened to "Network error."

**Warning signs:**
- Any mutating route that doesn't go through `requireActiveUser`.
- Mobile guards like `if (user.moderation.status === 'active')` reading only from AsyncStorage.
- No 403-with-suspension-code handling in the axios interceptor.

**Phase to address:**
Phase 1 (middleware) and Phase 4 (mobile reactive handling). Core foundation — the whole feature is meaningless if a suspended user can still act.

---

### Pitfall 6: Unsuspend leaves listings hidden — `listing.active = false` was never reversed

**What goes wrong:**
Suspending a seller also sets `listing.active = false` on their listings (so they stop showing in browse). Admin unsuspends. Seller logs in, sees "You're unsuspended" banner, then notices *their listings are still invisible to buyers*. They think the unban didn't work. Support ticket. Admin checks the DB and has to manually fix each `listing.active` row.

**Why it happens:**
Suspension is a mutation with side effects across collections. Unsuspension is often written as "just flip user.moderation.status back to active" and forgets the fan-out. The two code paths grow apart. Further: naive suspension might overwrite the *user's own* `listing.active = false` (a manual pause they set before suspension) so even a perfect unsuspend can't know whether to restore to true.

**How to avoid:**
- Don't write to `listing.active` on suspend at all. Leave listings as-is at the data layer. Instead, *filter at read time*: the public listing query joins on `User.moderation.status` and excludes sellers whose status isn't `active`. One-line change to the listings aggregation; zero data to roll back on unsuspend.
- If filtering at read time is too expensive for the scale (unlikely at this stage), use a separate field `listing.hiddenByModeration: boolean` that is orthogonal to the user-controlled `listing.active`. Suspend sets `hiddenByModeration: true`, unsuspend sets it to false. The user's own active/paused toggle is preserved.
- Same pattern for broker/logistics directory visibility.
- Integration test: "suspend → verify listings hidden → unsuspend → verify listings visible again with the same `active` value the seller had before suspension."

**Warning signs:**
- Suspend handler writes to `listings` or `broker_services` collections.
- Unsuspend handler is only a few lines (if it's simple, it probably forgot something).
- No symmetry test ("suspend then unsuspend returns to prior state").

**Phase to address:**
Phase 2 (Suspend implementation). Must choose the read-time-filter pattern up front; retrofitting is a data migration.

---

### Pitfall 7: Mobile cache shows full UI while backend rejects every action

**What goes wrong:**
User is suspended. AsyncStorage `userData` is stale. App launches, reads cached data, renders the full Home/Cart/Profile UI as if everything's fine. User taps "Add to cart" — 403. Taps "Create listing" — 403. Every action fails with a generic error because the mobile screen trusted the cache. From the user's perspective: "The app is broken." From the admin's perspective: "We suspended them; they should see a banner." Neither happens.

**Why it happens:**
Offline-first patterns and AsyncStorage caching are good defaults for performance. But they conflict with moderation, which *requires* the client to know current server truth before rendering gated UI. The existing app boots from AsyncStorage and does not revalidate user status on foreground/resume.

**How to avoid:**
- **Boot-time revalidation.** On app start and on every `AppState → 'active'` transition, fire `GET /api/users/:uid` *before* rendering screens that depend on status. Show a full-screen loading state for ~200-500ms. If status is not `active`, route to the moderation banner screen, not Home.
- **Version-based quick-check.** Store last-known `moderation.statusVersion` in AsyncStorage. Backend exposes a lightweight `GET /api/users/:uid/status-version` returning `{ version, status }`. Mobile hits this on resume; if version matches cached, render from cache; if not, full refetch. Cheap and fast.
- **Treat every 403 with `code: 'user_suspended'` as a cache-invalidation signal.** Axios interceptor clears cached `userData`, refetches user, routes to banner.
- **Do not render navigation/cart/payments before the auth+status check resolves.** The AuthProvider should gate the provider chain on a "status known" signal, not just "token exists."

**Warning signs:**
- App's first screen renders before `GET /api/users/:uid` returns.
- No status refetch on `AppState` change to `active`.
- 403 responses don't clear AsyncStorage.

**Phase to address:**
Phase 4 (mobile reactive handling / banner integration). Depends on backend status endpoint (Phase 1).

---

### Pitfall 8: Admin accidentally suspends themselves (or the last admin suspends the only other admin)

**What goes wrong:**
Admin fat-fingers a row, hits "Suspend" on their own account. They get logged out of the admin panel; their own status is `feature_limited`; they can't log back in to unsuspend themselves. Worse variant: admin A suspends admin B; admin A's session expires; admin B was the only other admin — now there are zero admins who can act on anyone.

**Why it happens:**
Admin moderation UI lists all users; the admin's own row looks like any other row; the "Suspend" action has no guard. Admins are users too in the data model, so `POST /api/admin/moderation/:targetUid` with `targetUid === callerUid` is syntactically valid.

**How to avoid:**
- **UI guard:** in `AdminManagementScreen` and the new moderation screen, do not render the Suspend/Revoke/Delete controls when `row.firebaseUid === currentUser.firebaseUid`. Render a disabled tooltip "You cannot moderate yourself."
- **Backend guard:** in `requireAdmin` middleware or at the top of every moderation route, `if (req.adminUid === req.params.targetUid) return res.status(400).json({ code: 'cannot_moderate_self' })`. UI can be bypassed; backend must hold the line.
- **Admin count guard:** suspending/revoking an admin account requires at least one *other* active admin to remain. Query `admins.countDocuments({ status: 'active' })` in the transaction. If the action would drop the count to zero, reject with `code: 'last_admin_protected'`.
- **Audit these rejections** — attempted self-moderation is a signal worth logging.

**Warning signs:**
- No self-check in the handler.
- Moderation UI doesn't special-case the current admin's row.
- No test "admin suspends own account → rejected."

**Phase to address:**
Phase 2 (Suspend) and Phase 4 (UI). Low effort, high impact.

---

### Pitfall 9: Inconsistent role revoke — user demoted but broker profile still live in search

**What goes wrong:**
Admin revokes broker role on user X. `user.role` is set to `'user'`. But the `brokers` collection still contains `{ firebaseUid: X, active: true, ... }`. Buyers browsing brokers still see X in the directory. They book a service. Payment succeeds. Backend tries to look up the provider for the order — user X has role `'user'` now; order goes into an ambiguous state.

**Why it happens:**
Two sources of truth: the role flag on `User` and the existence of the provider profile document. "Revoke role" naturally means "update User" and doesn't touch the profile. PROJECT.md explicitly says "revoke role — downgrade broker/seller/logistics back to regular user; provider profile preserved" — which is correct for data retention but must not mean "still visible in search."

**How to avoid:**
- Split preservation from visibility. Revoke role *preserves* the profile record (for historical orders to resolve) but sets `broker.listed = false` / `logistics.listed = false`. The directory query filters on `listed: true AND user.moderation.status === 'active' AND user.role includes the role`.
- Add a documented Single Source of Truth rule: a provider profile is "live" iff (a) corresponding role is on the user, (b) `profile.listed === true`, (c) user is `active`. Everywhere that reads the directory enforces all three. Write one helper `isProviderLive(profile, user)` and call it.
- The symmetric bug on re-granting the role: do *not* auto-set `listed = true` on re-grant; make the admin explicitly restore visibility. Prevents surprise reappearance in search.
- Integration test: "revoke broker → search doesn't return them → past orders still resolve to their profile via `providerUid` lookup."

**Warning signs:**
- Directory queries filter on `user.role` only, not on the provider profile's `listed` field.
- Revoke handler doesn't touch the provider profile at all.
- Re-grant silently relists.

**Phase to address:**
Phase 2/3 (Revoke + Delete actions). Requires schema change: add `listed: boolean` to broker/logistics profiles.

---

### Pitfall 10: Overloaded `status` / `moderation.status` field — conflated with KYC, phone verification, completeness

**What goes wrong:**
A single `user.status` field ends up holding values like `'active'`, `'pending_otp'`, `'feature_limited'`, `'kyc_incomplete'`, `'permanently_banned'`. Six months later, nobody knows whether `status = 'feature_limited'` means "admin suspended them" or "they didn't finish phone verification." Queries like "all active users" miss people. The banner screen shows the wrong copy for the wrong cause.

**Why it happens:**
Enum reuse feels tidy. `user.status` already exists for OTP-pending signup; adding `'feature_limited'` to it seems natural. Separate subdocuments feel like over-engineering at implementation time.

**How to avoid:**
- **Moderation is its own namespace.** Add `user.moderation: { status, severity, reasonCategory, reasonNote, appliedBy, appliedAt, statusVersion }` as a subdocument. Never merge with phone-verification or KYC flags.
- Leave existing status fields alone. `user.phoneVerified: boolean`. `user.emailVerified: boolean`. `user.profileComplete: boolean`. Each orthogonal.
- The "can this user do X?" check is a composed boolean: `user.moderation.status === 'active' && user.phoneVerified` etc. Centralize this in one server-side helper `userCapabilities(user)` returning a capability map `{ canListCar: bool, canBookService: bool, canContactSeller: bool }`. Every route and the mobile UI consume the same map.
- Mobile gates UI off the capability map, not off `moderation.status` directly. Adds a layer of indirection but prevents the "50 screens check moderation.status individually" problem (Pitfall 11).

**Warning signs:**
- Moderation state added as an enum value to an existing `user.status` field.
- Two different code paths that both check `user.status === 'active'` for different reasons.
- No central `userCapabilities` helper.

**Phase to address:**
Phase 0 (Schema design). Getting this wrong at schema time is a data migration later.

---

### Pitfall 11: Feature-limited gating logic sprawls across 50 screens

**What goes wrong:**
"Feature-limited" is the interesting severity level — user can log in but can't do X, Y, Z. Developer adds `if (user.moderation.status === 'feature_limited') hideButton` in one screen. Next week, two more screens. Six months later, the rule "feature-limited users can view but not create listings, can view but not contact sellers, can view orders but not create new ones" is implemented in 17 different places, each slightly different. A change to the rule requires finding all 17. Inevitably one is missed.

**Why it happens:**
React Native screens are often self-contained and conditionally render UI inline. The first `if` feels innocuous. There's no natural "policy" abstraction in the codebase.

**How to avoid:**
- **Single capability map.** Backend `userCapabilities(user)` returns the full map. Mobile `useCapabilities()` hook exposes it. Every screen reads from the hook, never checks `moderation.status` directly.
- **Same map enforced server-side.** The hook-based UI gating is just UX — the real enforcement is at the route layer, where each mutating endpoint asserts the corresponding capability. UI-only enforcement is a security hole (someone with the mobile app debugger can flip the flag).
- **One config file defines the capability matrix.** `src/config/capabilities.ts` (mobile) mirrors the backend file, structure: `{ [severity]: { canListCar: bool, ... } }`. Change-once-apply-everywhere.
- **Lint rule or code review checklist:** flag any direct `moderation.status` read outside the capability module.

**Warning signs:**
- More than one file references `moderation.status === 'feature_limited'`.
- Mobile code uses string comparisons on severity in render logic.
- Backend rule and mobile rule drift (UI hides button but backend accepts the call anyway).

**Phase to address:**
Phase 1 (capability map design) and Phase 4 (mobile integration). Cheap if done early, expensive as retrofit.

---

### Pitfall 12: Under-permissioned audit log reads — every admin sees every other admin's notes

**What goes wrong:**
Admin B opens a user's moderation history and sees: "Admin A wrote note: 'Suspected fraud, working with legal, do not unsuspend — see case #4421'." Admin B is a contractor who shouldn't see the legal case reference. Or admin B is the admin in question's direct report and now has visibility into their moderation patterns. Default "all admins see all audit" can leak sensitive operator context.

**Why it happens:**
Audit-log-as-truth philosophy says "everyone with audit access sees everything." In practice, audit *existence* and audit *full content* are two different things. The milestone doesn't scope admin roles (super-admin vs. admin), so "audit is fully public to admins" becomes the default.

**How to avoid:**
- **Two-tier read model by default.**
  - Summary visible to all admins: action, severity, target, timestamp, preset reason category, author admin UID.
  - Note (free-text) visible only to the author admin and super-admins.
- If the existing admin model doesn't distinguish super-admin, add a `superAdmin: boolean` flag on the admin record. Bootstrap: the first admin is super. Super-admins can grant super-admin to others.
- For the UI: show the note with a "restricted" placeholder when the viewer isn't the author or a super-admin. Link to "request access" (out of scope for this milestone, but the placeholder makes the design clean).
- If the org really wants fully open audits, make it an explicit Key Decision — not an accidental default.

**Warning signs:**
- `GET /api/admin/moderation/:targetUid/history` returns `reasonNote` unconditionally.
- No consideration of who authored the note vs. who's reading it.
- No super-admin concept yet the product already has multi-admin.

**Phase to address:**
Phase 2 (Audit log read endpoint). Getting the permission model right at the API layer prevents schema rework.

---

### Pitfall 13: GDPR hard-delete confusion — unclear what must go, what can stay, what must be kept

**What goes wrong:**
User invokes right-to-erasure. Admin deletes everything. Six months later, Stripe requires order records for a chargeback investigation — gone. Or: admin refuses to delete anything because "we have order history" — user complains to DPA, fine. Or: admin anonymizes User but leaves `reasonNote` with the user's real name in the audit log — partial deletion, still identifying.

**Why it happens:**
GDPR Art. 17 has carve-outs (Art. 17(3) — legitimate interest, legal obligation) that are easy to misread. The mobile app already has `deleteAccount` (see AuthService `DELETE /api/users/{firebaseUid}`) but its current implementation scope is unclear; adding moderation brings in audit logs and buyer order history in parallel.

**How to avoid:**
- **Explicit policy document in Key Decisions.** What goes, what stays, legal basis for each:
  - Hard-delete / null-out: email, phone, displayName, avatar, addresses, any PII on User document. Replace email with `deleted-{hash}@anonymized.local`. Set `gdprErasedAt` timestamp.
  - Hard-delete: broker/logistics profile record (company name, contact, service descriptions). Already the scope of "delete provider profile."
  - **Preserve (legal basis — legitimate interest + legal obligation):** Order documents with denormalized `providerSnapshot` already populated. Orders carry no *live* PII to the erased user; they reference a stable `firebaseUid` and a snapshot.
  - **Preserve (legal basis — legitimate interest for fraud/accountability):** moderation audit log. Strip free-text notes that contain names — on erasure, *replace* `reasonNote` with `[redacted per GDPR request on {date}]`, keep the rest (admin UID, action, timestamp, category).
- **"Erasure request" is an admin action**, not a self-service action. User requests via email; admin executes via a dedicated "GDPR erase" control separate from "delete provider profile" and separate from "permanently ban." These three actions sound similar and will be conflated if the UI doesn't distinguish.
- Add a dry-run preview to the erasure action showing every field that will be mutated. Makes the scope reviewable.

**Warning signs:**
- No documented data-retention policy in the repo.
- Erasure and profile-delete are the same button.
- Audit notes retain arbitrary PII that can't be scrubbed.

**Phase to address:**
Phase 3 (Delete scope design). Coordinate with legal before coding.

---

### Pitfall 14: Admin search on users is O(n) without indexes

**What goes wrong:**
Moderation screen supports search by email / phone / UID. With 10k users the naive regex `/{query}/i` on `User.email` takes 2-5 seconds on Atlas M10 and hammers the DB under admin load. Search by phone misses users who typed the number in different formats.

**Why it happens:**
Mongoose queries are easy to write without an index. Text search on email looks like a regex at first glance. Phone numbers are stored in whatever format the user typed.

**How to avoid:**
- Add indexes before the search endpoint ships:
  - `{ email: 1 }` (already should exist for login; verify)
  - `{ phone: 1 }` (after normalization)
  - `{ firebaseUid: 1 }` (unique, likely exists)
  - `{ 'moderation.status': 1, 'moderation.appliedAt': -1 }` for "recently moderated" view
  - Optional text index on email + displayName for prefix search
- Normalize phone numbers on write (E.164 format — `libphonenumber-js` on mobile, same on backend). Store and search the normalized form.
- Use prefix/anchor queries (`{ email: { $regex: `^${escape(q)}`, $options: 'i' } }`) not unanchored, so the index is usable. Anchored regex with a case-insensitive collation index works on Atlas.
- Paginate with a sane limit (50) and skip/limit or cursor-based pagination. Never return all users.
- Load-test with 10k seeded users before shipping.

**Warning signs:**
- Search route uses `RegExp(query)` without anchoring.
- No indexes declared in schema definitions for the fields being searched.
- Phone search matches different formats inconsistently.

**Phase to address:**
Phase 4 (Moderation screen with deep search).

---

### Pitfall 15: Appeal email flooding — banner CTA spam-clicks `support@carexmarket.com`

**What goes wrong:**
User sees "blocked with review" banner with a "Contact support" CTA that opens `mailto:support@carexmarket.com`. Out of frustration they send 50 emails in 10 minutes, or it deep-links to their mail app with the same prefilled body and they hit send repeatedly. Support inbox is flooded. No rate limiting because mailto: bypasses the app's backend entirely.

**Why it happens:**
`mailto:` handoff is the simplest implementation — zero backend. Feels like "the mail app is the user's problem, not ours." Meanwhile the support address in the Twilio/email infra is a shared inbox that was never designed for moderation appeals.

**How to avoid:**
- **Throttle at the CTA.** Mobile app tracks last-tapped timestamp per user in AsyncStorage; CTA is disabled for 10 minutes after tap, shows "We received your request — please allow up to 48h for a response."
- **Prefill the email body with a unique case token** (e.g., `user.firebaseUid` + short timestamp hash). Supports can tell which emails refer to the same case and de-dupe on the inbox side.
- **Don't use `mailto:` alone.** Send a `POST /api/moderation/appeals` call *first*, which records the appeal intent server-side (for rate limiting and tracking), then optionally opens the mail app with prefilled body. Server rate-limits to 3 per user per 24h.
- This is Out of Scope per PROJECT.md — flag it clearly in the research so the roadmap can decide whether to fold it in or accept the risk.

**Warning signs:**
- CTA is a raw `Linking.openURL('mailto:...')` with no guard.
- Support inbox has no automation for moderation appeals.
- No backend record that the user saw the banner.

**Phase to address:**
Phase 4 (banner UI) — light throttle at minimum; full appeal workflow is explicitly Out of Scope but the throttle is not.

---

### Pitfall 16: Reason text leaks into notifications (future risk, scope flag)

**What goes wrong:**
This milestone is in-app-only, but the next one will likely add push/email. If the banner reason text is reused as push body ("You were suspended for 'Suspected fraud — working with legal on case #4421'"), notification previews on lockscreens leak sensitive context to anyone looking at the phone. Or the push payload is cached by APNs/FCM providers.

**Why it happens:**
Reason text is already nicely formatted for the banner; reusing it for push is tempting. Push payload size limits also push developers toward "just put the reason in the body."

**How to avoid (for when scope expands):**
- Push bodies are generic ("Your account status has changed — open CarEx for details"). Full reason lives server-side, fetched only when the app opens.
- Email: reason in body is OK but subject line is generic.
- Flag this in the roadmap's "future milestone: notifications" so it's not rediscovered the hard way.

**Warning signs:**
- Push payload includes `moderation.reasonNote`.
- Email subject line includes the target user's name.

**Phase to address:**
Out of scope for this milestone. Document as a forward-looking constraint in the research so notification-milestone planners see it.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems. Scored against *this* codebase.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep passing `callerUid` in body for new moderation routes (consistency with existing admin pattern) | No backend auth refactor; ships faster | Entire moderation system is trivially spoofable; can never be trusted for enforcement; mandatory rewrite the day you adopt real enforcement (e.g., App Store review flags insecure auth) | **Never** — this milestone is the trigger to move off the pattern |
| Mutate `listing.active` on suspend to hide listings | One-line implementation in suspend handler | Unsuspend bug (Pitfall 6); conflates user intent with moderation intent; needs data migration to separate | Never — read-time filter is the same effort up front |
| Overload `user.status` with moderation values | Zero schema change | Pitfall 10; six months later every query is ambiguous; requires migration | Never |
| Let audit rows be regular Mongoose documents (no append-only enforcement) | Ship the schema in an hour | Pitfall 4; legally weak; retrofit is painful because existing rows are already mutable | Never for the moderation audit collection specifically |
| Client-side only capability gating | Mobile PR is self-contained, backend untouched | Pitfall 11 extended: insecure — anyone with a patched app bypasses all moderation | Never for mutating actions; acceptable for hiding UI only if backend also enforces |
| Hard-delete orders on "delete provider" | Simplest interpretation of "delete" | Pitfall 3; accounting and buyer history lost permanently | Never |
| Skip integration tests of suspend → unsuspend round-trip | Faster phase completion | Pitfall 6 in production; support burden | If you ship an automated symmetry test that covers all severity levels, can skip manual QA |
| Use `console.error` for moderation auth failures | Familiar pattern from existing code | No way to investigate a post-incident "who kept trying to suspend admins" trail | Only acceptable if the audit log itself captures rejected-self-moderation attempts |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Firebase Identity Toolkit (REST)** | Trust the UID from the client; assume idToken is optional because "we're using REST not Admin SDK" | Install `firebase-admin` on backend *just* for `verifyIdToken`. One import, one service-account JSON, no other SDK usage. Do this once across the whole moderation milestone. |
| **Firebase idToken lifetime** | Assume 1h is short enough for moderation enforcement | Token lifetime is irrelevant for authorization decisions — the DB-side `user.moderation.status` read on every mutating request is what enforces suspension. Token just proves identity. |
| **MongoDB / Mongoose** | Moderation writes without transactions; rely on single-doc atomicity and hope | Use `session.withTransaction()` for any action that writes to `users` + `orders` + `moderation_audit` together. Atlas M0+ supports replica-set transactions. |
| **MongoDB / Mongoose** | Regex search without anchor and without index | Anchor (`^query`) + index + case-insensitive collation. Paginate. |
| **Stripe PaymentIntent** | `confirm-booking` trusts the pre-existing PaymentIntent and doesn't re-check seller status | On `confirm-booking`, re-read all provider statuses inside a transaction. If suspended, cancel the PaymentIntent (`stripe.paymentIntents.cancel`) if not captured, or refund if already captured, and surface a specific error code. |
| **Stripe** | Using the hardcoded `pk_test_` key means moderation will be tested against test-mode payments only, and prod bugs may hide | Out of scope per CONCERNS.md but noted — plan moderation tests assuming live-mode behavior. Do not let test-mode softness mask race bugs. |
| **AsyncStorage** | Bootstrap app from cached userData without revalidating status | Boot-time and `AppState → active` revalidation. Status-version endpoint for cheap check. |
| **axios (mobile)** | No central response interceptor; each call handles its own errors | Add interceptor: on `401` refresh idToken once; on `403 user_suspended` clear state + route to banner; on network error surface to UI. |
| **Twilio / `support@carexmarket.com`** | Assume the shared inbox can absorb moderation-appeal traffic | Throttle at the CTA; future milestone adds a real appeal workflow. |
| **S3 (avatars)** | GDPR erasure doesn't delete avatar from S3; only nulls the reference in Mongo | On GDPR erase, also delete the S3 object. Add to the erase procedure checklist. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unindexed user search in moderation screen | Admin search takes >1s; Atlas CPU spikes during moderation work | Indexes on email, phone (normalized), firebaseUid, moderation.status | ~5k users |
| `requireActiveUser` reads full user doc on every request | Latency creep across all write endpoints | Project only `moderation.status` and `moderation.statusVersion`; cache in a 30-second in-memory LRU keyed by UID, invalidated on moderation write | ~100 req/s per admin panel session |
| Directory queries that join user + profile + moderation status at read time | Listings browse gets slow as user count grows | Denormalize `seller.status` onto `Listing` at suspend/unsuspend time (fan-out write) OR use a single aggregation with proper indexes; pick one consistently | ~50k listings |
| Audit log full scan for a user's history | History tab takes >500ms | Index on `moderation_audit.targetUid`; paginate history with cursor | ~10k audit rows per user (unlikely but possible for prolific targets) |
| Denormalized `providerSnapshot` on every new order even when cheap | Write amplification on the hot path | Accept it — snapshot is ~200 bytes, order writes are not hot enough to matter at this scale | Only breaks at millions of orders |
| Polling `/status-version` too aggressively | Unnecessary traffic; battery drain | Poll on resume only, not on interval | Any scale |

## Security Mistakes

Beyond the authorization-hole Pitfall 1 (covered above).

| Mistake | Risk | Prevention |
|---------|------|------------|
| Moderation endpoints return detailed error codes to all callers | Info leak: non-admins enumerate admin UIDs by probing responses | All admin routes return `403 forbidden` with opaque body for non-admin callers. Detailed codes only for authenticated admins. |
| Audit log exposes admin UIDs to target user | Target user now knows which admin suspended them, enables targeted retaliation or social engineering | Banner/banner-API shows the severity + reason category + note. Never the admin UID or name. Audit log with admin identity is admin-only. |
| Reason note allows HTML/markdown that renders in the banner | Stored XSS if mobile uses `dangerouslySetInnerHTML` or equivalent | React Native's default text rendering is safe (no HTML interpretation), but do not introduce a markdown/HTML renderer for reason text. Plain text only. |
| Rate limit missing on admin moderation endpoints | One compromised admin creds = mass-ban all users in minutes | Rate limit: 100 moderation actions / admin / 10 min. Anything over → 429 + alert. |
| GDPR erasure is irreversible but UI doesn't say so | Admin accidentally erases wrong user, can't undo | Confirm dialog with typed confirmation ("type EMAIL to confirm"), 5-second "undo" grace period server-side, audit the erasure intent before executing. |
| Self-moderation bypass via direct API call | UI guard only, backend doesn't reject self-moderation | Backend guard (Pitfall 8). |
| Deep-link `carex://listing/:carId` reachable by suspended users from external source | Suspended user opens shared listing link, app renders CarDetails screen before status check | Deep-link handler runs the same auth + status boot-check as cold start before navigating. |
| Leaking moderation state via public endpoints | `GET /api/brokers/{uid}` returns 404 only when suspended, 200 otherwise → external enumeration of who's suspended | Return 404 for "not listed" regardless of cause (deleted, never existed, suspended). Don't distinguish. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Banner is dismissable and the user dismisses it, then forgets | User confused about why every action fails | Banner is persistent for "blocked with review" and "permanent ban"; dismissable only for "feature-limited" and re-appears on every app open |
| Banner says "You are suspended" with no context | User rage-quits the app | Show severity-appropriate guidance: feature-limited → "Here's what to do"; blocked-with-review → "Here's how to appeal"; permanent → "This decision is final" |
| Admin moderation screen requires multiple taps to take action | Moderation velocity low; admin burns out | One-tap severity picker with reason preset. Undo button for 10 seconds after action. |
| No indication in admin UI which users are suspended | Admin re-suspends already-suspended user; audit log clutters | Color badge + status pill on every user row; filter by status in search |
| Admin clicks "Revoke role" and it silently succeeds with no feedback | Admin unsure if action took effect; taps again | Toast + row refresh + audit history entry appears in the drawer |
| Past orders for a deleted seller show "Unknown provider" | Buyer panics, thinks they were scammed | Show `providerSnapshot.name` with a subtle "(provider no longer listed)" note; orders still track-able by orderId |
| "Feature-limited" user sees the same UI as active user with random buttons disabled | Feels like the app is broken | Dedicated restricted-mode UI: banner at top, clear list of what they can/can't do, CTA to resolve |
| Admin suspends → target user logs in → banner shows → user immediately taps "Contact support" → mailto opens → user floods inbox | Support overwhelmed | Throttle (Pitfall 15) |
| RU-default banner text missing EN parity or vice versa | Half the users see untranslated strings | Add both RU and EN translation keys for every severity × every reason category, enforce in i18n lint |
| Admin UI doesn't confirm dangerous actions | Accidental "delete provider profile" destroys a legitimate provider | Confirm modal for delete + revoke + permanent ban with target name echoed back |

## "Looks Done But Isn't" Checklist

- [ ] **Suspend endpoint:** Often missing re-check at payment-confirm time — verify `confirm-booking` rejects if any provider's status changed between intent creation and confirmation.
- [ ] **Suspend endpoint:** Often missing transaction boundary — verify suspending a seller with in-flight orders either pauses all of them atomically or fails atomically.
- [ ] **Unsuspend:** Often missing symmetry — verify listings and broker directory entries are visible again with the seller's original active/paused state preserved.
- [ ] **Delete provider profile:** Often missing order snapshot — verify past orders still render the provider's name via `providerSnapshot`, and that this was populated at order creation time for *pre-moderation* orders too (migration needed).
- [ ] **Audit log:** Often missing append-only enforcement at the Mongoose model level — verify a test that attempts `updateOne` / `deleteOne` on the audit collection throws.
- [ ] **Audit log read:** Often missing permission split between summary and note — verify non-author admins see `[restricted]` for notes unless super-admin.
- [ ] **Banner:** Often missing on cold start from a deep link — verify launching via `carex://listing/123` still routes to banner when suspended.
- [ ] **Banner:** Often missing RU/EN parity — verify all severity × reason category combinations have both translations.
- [ ] **Self-moderation guard:** Often missing on the backend — verify `POST /api/admin/moderation/:targetUid` with `targetUid === adminUid` returns 400 even if UI lets you.
- [ ] **Last-admin guard:** Often missing — verify suspending the last active admin is rejected.
- [ ] **Status-version propagation:** Often missing — verify the mobile app refetches user after a 403 user_suspended response and routes correctly.
- [ ] **AsyncStorage cache:** Often missing invalidation on 403 — verify a suspended user's app doesn't keep rendering "authenticated" UI.
- [ ] **Search performance:** Often missing indexes — verify `explain()` on the admin user search uses an index.
- [ ] **Role revoke:** Often missing directory hide — verify revoked broker does not appear in broker search.
- [ ] **GDPR erase:** Often missing S3 avatar deletion — verify the S3 object is removed, not just the reference in Mongo.
- [ ] **Reason text sanitization:** Often missing plain-text enforcement — verify reason with HTML/markdown renders as raw text, not interpreted.
- [ ] **Integration with existing `requestSellerStatus` / `requestBrokerStatus`:** Often missing — verify a suspended user cannot *request* new roles while suspended.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Auth hole discovered in production (Pitfall 1) | HIGH | 1. Ship emergency middleware requiring idToken on moderation routes. 2. Audit the moderation_audit collection for suspicious actions during the exposure window. 3. Rotate admin allowlist if compromise suspected. 4. Post-incident: enforce idToken on *all* admin routes, not just moderation. |
| Suspended seller received payments during race window (Pitfall 2) | HIGH | 1. Query orders created in the seller's `pausedAt - 30s` window. 2. Refund via Stripe API. 3. Cancel the orders with status `cancelled_race_condition`. 4. Email affected buyers. 5. Ship the transactional fix. |
| Order history corrupted by delete-cascade (Pitfall 3) | HIGH | 1. Restore from Atlas backup (retention window permitting). 2. Re-populate `providerSnapshot` from the restored orders. 3. Communicate to affected buyers. 4. Ship the denormalization fix and re-run delete with the new flow. |
| Audit log tampered / missing rows | MEDIUM-HIGH | 1. Use hash chain to identify the tampered range. 2. Cross-reference with Atlas audit log (if enabled) for the meta-truth. 3. Reconstruct from application logs if possible. 4. Ship append-only enforcement. |
| User's listings stayed hidden after unsuspend (Pitfall 6) | LOW-MEDIUM | 1. One-off DB script to find `listing.hiddenByModeration = true` where `user.moderation.status = 'active'` and flip them. 2. Apologize to affected sellers. 3. Ship read-time filter. |
| Admin locked self out (Pitfall 8) | MEDIUM | 1. Direct DB edit to flip moderation.status for the admin. 2. Ship self-moderation guard. |
| Mobile cache shows stale active status | LOW | 1. Tell user to force-close and reopen. 2. Ship boot-time revalidation. |
| 50-screen gating sprawl discovered late (Pitfall 11) | MEDIUM | 1. Build the capability map. 2. Find-and-replace direct status checks. 3. Adopt lint rule. |
| GDPR complaint: didn't erase enough | HIGH | 1. Immediately erase the missed fields. 2. Document the expanded scope. 3. DPA notification if required by jurisdiction. |
| GDPR complaint: erased too much (records needed for accounting) | HIGH | 1. Restore from backup if within window. 2. If not, explain to regulator and counterparty. |
| Admin search is unusably slow in prod | LOW | 1. Add indexes via Atlas (online). 2. Backfill if schema change needed. 3. Ship pagination. |

## Pitfall-to-Phase Mapping

Assumes a 5-phase roadmap: **(0)** Schema + contract design, **(1)** Backend foundation (auth, audit, capability map, middleware), **(2)** Suspend action end-to-end, **(3)** Revoke + delete actions + GDPR erase, **(4)** Mobile admin UI + target-user banner, **(5)** Polish + load test + security review. Adjust to whatever roadmap phases emerge — the mapping is "which phase OWNS preventing this."

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. `callerUid` spoofing | Phase 1 | No new route reads `req.body.callerUid`; idToken middleware is the only auth path; pen test with curl + leaked UID fails |
| 2. Race on suspend mid-checkout | Phase 2 (handler) + Phase 1 (transaction utility) | Automated test: concurrent suspend + confirm-booking → either booking fails or suspend fails, never both succeed |
| 3. Cascading deletes destroy history | Phase 0 (schema) + Phase 3 (delete impl) | Test: delete provider → past orders still show name via snapshot; accounting query still finds them |
| 4. Audit log tampering | Phase 1 (append-only module) | Test: `ModerationAudit.updateOne` throws; hash chain validates; optionally second DB user exists |
| 5. Status propagation lag | Phase 1 (middleware) + Phase 4 (mobile reactive) | Test: in-flight mutating request after suspend → 403; mobile interceptor routes to banner |
| 6. Unsuspend leaves listings hidden | Phase 2 | Symmetry test: suspend then unsuspend restores prior visibility state |
| 7. Mobile cache stale | Phase 4 | Test: suspend user while app foregrounded; on next foreground → banner appears |
| 8. Self-suspend / last-admin | Phase 2 (backend) + Phase 4 (UI) | Test: self-moderation returns 400; last-active-admin protection returns 400 |
| 9. Inconsistent role revoke | Phase 3 | Test: revoke broker → not in directory; past orders still resolve profile |
| 10. Overloaded status field | Phase 0 (schema) | Schema review: `moderation` is its own subdoc, orthogonal to verification flags |
| 11. Gating sprawl | Phase 1 (capability map) + Phase 4 (mobile consumes hook) | Grep: zero direct `moderation.status` string comparisons outside the capability module |
| 12. Audit note over-exposure | Phase 2 (audit read API) | Test: non-author non-super-admin gets `[restricted]` for notes |
| 13. GDPR erase scope | Phase 3 (design + impl) | Documented policy in repo; dry-run UI shows every mutation; legal sign-off |
| 14. Search performance | Phase 4 (screen) | Load test: 10k users, search <200ms; `explain()` shows index use |
| 15. Appeal email flood | Phase 4 (banner CTA) | CTA-throttle test: 10-minute cooldown enforced |
| 16. Notification leaks (future) | **Not this milestone** — flag in out-of-scope doc for the notification milestone | N/A |

## Sources

- [Verify ID Tokens — Firebase docs](https://firebase.google.com/docs/auth/admin/verify-id-tokens) — authoritative pattern for server-side idToken verification; explicitly states "never trust uid from client"
- [Manage User Sessions — Firebase docs](https://firebase.google.com/docs/auth/admin/manage-sessions) — Firebase idToken lifetime and revocation model (short-lived tokens, refresh flow)
- [JWT Token Lifecycle Management](https://skycloak.io/blog/jwt-token-lifecycle-management-expiration-refresh-revocation-strategies/) — short-lived tokens + status-version pattern for revocation propagation
- [How to Handle JWT Revocation — OneUptime (2026)](https://oneuptime.com/blog/post/2026-02-02-jwt-revocation/view) — why DB-side status checks matter even when tokens are short-lived
- [MongoDB Auditing — MongoDB Docs](https://www.mongodb.com/docs/manual/core/auditing/) — official auditing capabilities; distinguishes DB-level audit from application-level audit log
- [Atlas Database Auditing](https://www.mongodb.com/docs/atlas/database-auditing/) — available on M10+, useful for meta-audit of the audit collection
- [Compliance by Design: Tamper-Proof Audit Logs — Mattermost](https://mattermost.com/blog/compliance-by-design-18-tips-to-implement-tamper-proof-audit-logs/) — append-only destinations, hash chains, least-privilege access
- [How to Enable MongoDB Auditing for Compliance — OneUptime (2026)](https://oneuptime.com/blog/post/2026-03-31-mongodb-auditing-compliance/view) — restricted DB user patterns
- [GDPR Art. 17 — Right to Erasure](https://gdpr-info.eu/art-17-gdpr/) — primary legal text; Art. 17(3) carve-outs for legitimate interest, legal obligation (the basis for retaining order history and audit logs)
- [GDPR.eu — Right to Be Forgotten](https://gdpr.eu/right-to-be-forgotten/) — practical guidance on anonymization vs erasure
- [Does GDPR mean customers can delete Amazon/eBay order history? — Quora](https://www.quora.com/Does-GDPR-mean-that-customers-can-ask-Amazon-eBay-to-delete-the-items-in-their-order-history) — widely-cited analysis that order history falls under legitimate business interest
- [AWS Marketplace Race Condition (2026)](https://sidshome.wordpress.com/2026/02/16/the-aws-marketplace-race-condition-nobody-warns-you-about/) — concrete example of the "event arrives mid-flow" race pattern relevant to suspend-during-checkout
- [Feature Flag Security Best Practices — Unleash](https://www.getunleash.io/blog/feature-flag-security-best-practices) — centralized gating + backend enforcement pattern
- [Feature flags and authorization abstract the same concept — Nicole Tietz-Sokolskaya](https://ntietz.com/blog/feature-flags-and-authorization/) — conceptual basis for the capability-map approach
- [Using Feature Flags for User Gating in the API — DevCycle](https://devcycle.com/blog/using-feature-flags-for-user-gating-in-the-api) — why UI-only gating is a security hole
- Local codebase: `src/services/AuthService.ts` (lines 245-287, 357-369) — confirms `callerUid`-in-body pattern is the *current* auth model for admin and order-status endpoints
- Local codebase: `.planning/codebase/INTEGRATIONS.md` — confirms Firebase REST (not Admin SDK) on mobile, MongoDB Atlas on backend, Stripe for payments, AsyncStorage for client cache
- Local codebase: `.planning/codebase/CONCERNS.md` — pre-existing god-module + loose types in AuthService + AuthContext (`user: any`) that make it easy to accidentally spread moderation fields incorrectly during client-side merge
- Local codebase: `.planning/PROJECT.md` — scope of this moderation milestone; severity model; data-preservation constraints

---
*Pitfalls research for: admin moderation on React Native + Express/Mongo car marketplace*
*Researched: 2026-04-17*
