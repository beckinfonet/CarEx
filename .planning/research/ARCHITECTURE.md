# Architecture Research

**Domain:** Admin moderation subsystem for mobile car marketplace (CarEx)
**Researched:** 2026-04-17
**Confidence:** HIGH (grounded in existing codebase inspection + standard patterns for RBAC/moderation in Express/Mongoose + React Native Context apps)

---

## Standard Architecture

### System Overview

```
┌───────────────────────── MOBILE (React Native 0.83) ─────────────────────────┐
│                                                                              │
│  Admin device                                Affected-user device            │
│  ┌─────────────────────┐                     ┌─────────────────────┐         │
│  │ AdminManagementScr. │                     │ Any screen          │         │
│  │  (quick actions)    │                     │ + UserStatusBanner  │         │
│  │                     │                     │  (global overlay)   │         │
│  │ ModerationScreen    │                     │                     │         │
│  │  (search / history) │                     │ FeatureGateOverlay  │         │
│  └──────────┬──────────┘                     │ (screen-level)      │         │
│             │                                └──────────┬──────────┘         │
│             ▼                                           ▲                    │
│  ┌──────────────────────┐          reads        ┌───────┴───────────┐        │
│  │ ModerationService    │                       │ AuthContext       │        │
│  │  (new module)        │◄──────────uses────────┤  user.status      │        │
│  └──────────┬───────────┘                       │  refreshUser()    │        │
│             │                                   └───────▲───────────┘        │
│             ▼                                           │                    │
│  ┌──────────────────────┐   reads idToken       ┌───────┴───────────┐        │
│  │ http/client.ts       │◄──────────────────────┤ AuthService (thin)│        │
│  │ (shared axios)       │                       │  (auth only)      │        │
│  └──────────┬───────────┘                       └───────────────────┘        │
└─────────────┼────────────────────────────────────────────────────────────────┘
              │  HTTPS + Authorization: Bearer <idToken>
              ▼
┌───────────────────────── BACKEND (Express + Mongoose) ───────────────────────┐
│                                                                              │
│  ┌─────────────────────── Middleware chain (per request) ───────────────────┐│
│  │                                                                           ││
│  │  verifyFirebaseToken  →  loadUser  →  requireStatus  →  requireAdmin?    ││
│  │   (admin routes only)   (attaches     (403 if blocked   (admin routes)   ││
│  │                          req.user +    / banned)                         ││
│  │                          req.userStatus)                                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                       │                                      │
│             ┌─────────────────────────┴──────────────────────┐               │
│             ▼                                                ▼               │
│  ┌─────────────────────┐                         ┌────────────────────────┐  │
│  │ moderation.routes   │                         │ listings / orders /    │  │
│  │  POST  /:uid        │                         │ brokers / payments     │  │
│  │  GET   /:uid/history│                         │  (use requireStatus)   │  │
│  │  PATCH /:uid/unsusp │                         └───────────┬────────────┘  │
│  └──────────┬──────────┘                                     │               │
│             ▼                                                │               │
│  ┌─────────────────────┐                                     │               │
│  │ moderation.controller                                     │               │
│  │  (HTTP shape only)  │                                     │               │
│  └──────────┬──────────┘                                     │               │
│             ▼                                                │               │
│  ┌─────────────────────┐       writes        ┌───────────────┴────────────┐  │
│  │ moderation.service  │──────────────────►  │ Mongoose query middleware  │  │
│  │  (business rules:   │                     │  (pre-find on Car/Order:   │  │
│  │   sev → status map, │                     │   filter hiddenSellers)    │  │
│  │   delete-preserves- │                     └────────────────────────────┘  │
│  │   orders, etc.)     │                                                     │
│  └──────────┬──────────┘                                                     │
│             │                                                                │
│       ┌─────┴──────┐                                                         │
│       ▼            ▼                                                         │
│  ┌─────────┐  ┌───────────────┐                                              │
│  │ audit   │  │ User model    │                                              │
│  │ service │  │  .status      │                                              │
│  │ (append │  │  .statusReason│                                              │
│  │  only)  │  │  .statusAt    │                                              │
│  └────┬────┘  └───────┬───────┘                                              │
│       ▼               ▼                                                      │
│  ┌──────────────────────────────────┐                                        │
│  │ MongoDB: moderation_audit, users │                                        │
│  └──────────────────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**Backend**

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `moderation.routes.ts` | Declare HTTP surface; mount middleware chain | Express Router under `/api/admin/moderation` |
| `moderation.controller.ts` | Parse/validate body, map service results → HTTP | Thin async handlers, no business logic |
| `moderation.service.ts` | Business rules: severity→status mapping, delete-preserves-orders, role-revoke semantics, unsuspend, idempotency | Pure service functions; imports `audit.service` + models |
| `audit.service.ts` | Append-only moderation audit writes + history reads | Mongoose `ModerationAudit` model; never mutates rows |
| `verifyFirebaseToken` middleware | Verify `Authorization: Bearer <idToken>` via `firebase-admin`; attach `req.firebaseUid` | `firebase-admin.auth().verifyIdToken(token)` |
| `loadUser` middleware | Fetch backend user by `req.firebaseUid`; attach `req.user` + `req.userStatus` (cached once per request) | Single `User.findOne({ firebaseUid })` — later adds Redis/lru-cache |
| `requireStatus` middleware | Gate route based on `req.user.status`; return 403 for `blocked_with_review` / `permanently_banned`; pass-through for `feature_limited` (handler decides) | Config object: `requireStatus({ allow: ['active', 'feature_limited'] })` |
| `requireAdmin` middleware | Check backend-mirrored admin record by `req.firebaseUid` | `AdminUser.exists({ firebaseUid })` |
| Mongoose query middleware | Auto-filter cars/orders whose seller is `blocked_*` / `permanently_banned` from public listing queries | `Car.pre('find', ...)` → injects `$match` on hidden-seller join |
| `User` model | Add `status`, `statusReason`, `statusSeverity`, `statusAt`, `statusBy`, `restrictedFeatures[]` | Mongoose schema + migration |
| `ModerationAudit` model | Immutable rows: `{adminUid, targetUid, action, severity, reasonCategory, note, at}` | Mongoose schema; no updates allowed (block in pre-save) |

**Mobile**

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `ModerationService.ts` | Admin-facing API calls (suspend, revoke, unsuspend, history, search) | New `src/services/moderation/ModerationService.ts` — not a god-service |
| `AdminManagementScreen` (extended) | Quick moderation actions per row; severity picker modal; reason picker | Existing screen + new row actions |
| `AdminModerationScreen` (new) | Search by email/UID, filter by status/role, view full audit trail per user, bulk actions | New screen under `src/screens/admin/` |
| `UserStatusContext` | Expose `status`, `statusReason`, `restrictedFeatures[]`, `refreshStatus()` derived from `user` | Either extend `AuthContext` or thin derived context reading `user` |
| `UserStatusBanner` | Global overlay rendered by `App.tsx` when `status !== 'active'`; severity-aware copy + action buttons (appeal email, resolve instructions) | Functional component inside `NavigationContainer` or as sibling |
| `FeatureGateOverlay` | Per-screen overlay for `feature_limited` users attempting restricted actions | HOC or hook (`useFeatureGate('create_listing')`) |

---

## Recommended Project Structure

### Backend (`carEx-services`)

```
src/
├── modules/
│   ├── moderation/
│   │   ├── moderation.routes.ts        # POST /:uid, GET /:uid/history, PATCH /:uid/unsuspend
│   │   ├── moderation.controller.ts    # HTTP layer
│   │   ├── moderation.service.ts       # severity→status, delete-preserves-orders
│   │   ├── moderation.types.ts         # UserStatus, Severity, ReasonCategory enums
│   │   └── moderation.service.test.ts
│   └── audit/
│       ├── audit.service.ts            # append-only writes
│       └── ModerationAudit.model.ts    # immutable schema
├── middleware/
│   ├── verifyFirebaseToken.ts          # NEW — idToken verification
│   ├── loadUser.ts                     # NEW — attaches req.user once
│   ├── requireStatus.ts                # NEW — status enforcement
│   └── requireAdmin.ts                 # REFACTORED — reads req.user, not body.callerUid
├── models/
│   └── User.model.ts                   # MODIFIED — add status fields
└── db/queryMiddleware/
    └── hideBlockedSellerListings.ts    # Mongoose pre('find') for Car
```

### Mobile (`carEx`)

```
src/
├── services/
│   ├── AuthService.ts                  # STAY — do not rewrite; only auth-related calls stay
│   ├── http/
│   │   └── client.ts                   # NEW — shared axios instance with interceptors
│   └── moderation/
│       └── ModerationService.ts        # NEW — admin moderation API calls
├── context/
│   ├── AuthContext.tsx                 # MODIFIED — user now includes status fields
│   └── UserStatusContext.tsx           # NEW (optional) — or just extend AuthContext
├── components/
│   ├── moderation/
│   │   ├── UserStatusBanner.tsx        # NEW — global banner
│   │   ├── FeatureGateOverlay.tsx      # NEW — per-screen
│   │   ├── SeverityPickerModal.tsx     # NEW — admin action UI
│   │   └── ReasonPicker.tsx            # NEW — preset + optional note
│   └── admin/
│       └── ModerationActionRow.tsx     # NEW — row widget for AdminManagementScreen
└── screens/
    └── admin/
        ├── AdminManagementScreen.tsx   # MODIFIED — adds ModerationActionRow
        └── AdminModerationScreen.tsx   # NEW — search/history/bulk
```

### Structure Rationale

- **`modules/moderation/` vs flat `routes/moderation.ts`:** Moderation has controller + service + types + tests. A folder keeps the blast radius contained and mirrors the existing `admin` split.
- **`audit` as its own module:** Audit is cross-cutting — later features (role approve/reject, admin add/remove) should also write audit rows. Extracting it now avoids rewriting when that comes.
- **Mobile `services/moderation/ModerationService.ts` (new module, NOT a new method on `AuthService`):** `AuthService.ts` is already 378 lines and named misleadingly. Adding moderation methods would deepen the god-module problem. A separate `ModerationService` establishes the precedent for future extraction (see §Coupling hot-spots).
- **`services/http/client.ts`:** Extract the axios instance + interceptors (auth header, 401 refresh, 403 moderation-block) so both `AuthService` and `ModerationService` share one transport. This is the minimum viable split that pays off immediately.
- **`components/moderation/` sibling to `components/admin/`:** Moderation UI has two audiences — admins (action UIs) and affected users (banner, gate). Co-locating both under `moderation/` keeps the feature findable.

---

## Architectural Patterns

### Pattern 1: Server-Authoritative Status with Per-Request Load

**What:** The server is the single source of truth for `user.status`. On every authenticated request, middleware loads the user once, attaches it to `req`, and a downstream `requireStatus` check gates the handler.

**When to use:** Whenever status can change between requests and cached client state is untrustworthy (which is always true for moderation — admin can suspend between two of the target's requests).

**Trade-offs:**
- **Pro:** Impossible for a client to bypass by caching an old status locally.
- **Pro:** Enforcement is declarative per route (`router.post('/listings', requireStatus({ allow: ['active'] }), handler)`).
- **Con:** Adds one `User.findOne` per authenticated request. Mitigated by indexing `firebaseUid` (already unique) and later Redis/lru-cache.

**Example:**

```typescript
// middleware/loadUser.ts
export async function loadUser(req, res, next) {
  const user = await User.findOne({ firebaseUid: req.firebaseUid }).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  req.user = user;
  req.userStatus = user.status ?? 'active';
  next();
}

// middleware/requireStatus.ts
export const requireStatus = (opts: { allow: UserStatus[] }) => (req, res, next) => {
  if (!opts.allow.includes(req.userStatus)) {
    return res.status(403).json({
      error: 'ACCOUNT_RESTRICTED',
      status: req.userStatus,
      reason: req.user.statusReason,
      severity: req.user.statusSeverity,
    });
  }
  next();
};

// routes/listings.ts
router.post('/', verifyFirebaseToken, loadUser,
  requireStatus({ allow: ['active'] }), createListing);
```

### Pattern 2: Severity → Enforcement Strategy Mapping

**What:** The severity enum maps to a **declarative policy table**, not imperative `if/else` scattered across handlers.

**When to use:** Whenever severity affects multiple routes differently (create-listing, contact-seller, place-order, update-profile). Keeping the matrix in one file keeps drift out.

**Trade-offs:**
- **Pro:** Adding a new severity or a new restricted feature is one table edit, not N handler edits.
- **Pro:** The same table can drive the mobile `FeatureGateOverlay` (shipped via `GET /api/users/:uid/restrictions` or embedded in user object).
- **Con:** Indirection — reading a single route's behavior requires consulting the table. Mitigate with co-located comments.

**Example:**

```typescript
// modules/moderation/policy.ts
export const STATUS_POLICY: Record<UserStatus, {
  canCreateListing: boolean;
  canPlaceOrder: boolean;
  canContactSeller: boolean;
  canViewOwnOrders: boolean;   // always true — paused orders still visible
  bannerSeverity: 'info' | 'warn' | 'block';
}> = {
  active:                { canCreateListing: true,  canPlaceOrder: true,  canContactSeller: true,  canViewOwnOrders: true, bannerSeverity: 'info' },
  feature_limited:       { canCreateListing: false, canPlaceOrder: false, canContactSeller: true,  canViewOwnOrders: true, bannerSeverity: 'warn' },
  blocked_with_review:   { canCreateListing: false, canPlaceOrder: false, canContactSeller: false, canViewOwnOrders: true, bannerSeverity: 'block'},
  permanently_banned:    { canCreateListing: false, canPlaceOrder: false, canContactSeller: false, canViewOwnOrders: true, bannerSeverity: 'block'},
};
```

### Pattern 3: Append-Only Audit via Dedicated Service

**What:** `audit.service.append(...)` is the **only** code path that writes to `moderation_audit`. Controllers never import the model directly. The model's `pre('save')` rejects updates.

**When to use:** Always for compliance/audit collections — it's the difference between "someone ran a script to overwrite audit rows" being possible or impossible.

**Trade-offs:**
- **Pro:** One place to add indexed metadata later (trace ID, IP, user agent).
- **Pro:** Accidental mutation is caught at the model layer, not just by convention.
- **Con:** Slight ceremony — you can't just call `new ModerationAudit({...}).save()` in a pinch.

**Example:**

```typescript
// modules/audit/ModerationAudit.model.ts
ModerationAuditSchema.pre('save', function(next) {
  if (!this.isNew) return next(new Error('ModerationAudit rows are immutable'));
  next();
});

// modules/audit/audit.service.ts
export async function appendModerationAudit(entry: AuditEntry) {
  return ModerationAudit.create(entry); // no update API exported
}
```

### Pattern 4: Mongoose Query Middleware vs Per-Endpoint `$match` (Trade-off)

Two ways to hide listings from blocked sellers:

**Option A — Mongoose `pre('find')` middleware (recommended for THIS milestone):**

```typescript
// db/queryMiddleware/hideBlockedSellerListings.ts
CarSchema.pre(/^find/, async function() {
  if (this.getOptions().includeBlockedSellers) return; // admin override
  const blocked = await User.find(
    { status: { $in: ['blocked_with_review', 'permanently_banned'] } }
  ).distinct('firebaseUid');
  this.where({ sellerUid: { $nin: blocked } });
});
```

- **Pro:** One place, cannot be forgotten on a new listing endpoint. Safe-by-default.
- **Pro:** Admin screens opt in explicitly via `Car.find(q).setOptions({ includeBlockedSellers: true })`.
- **Con:** Two queries per listing read (blocked-seller UIDs + actual query). Acceptable at current scale; trivially cacheable later.
- **Con:** Invisible to readers of the controller — add a prominent comment in `Car.model.ts`.

**Option B — Per-endpoint `$match` in aggregation pipeline:**
- **Pro:** Explicit, visible at each call site, no hidden query.
- **Pro:** Can be merged into existing aggregations for free (no extra round-trip).
- **Con:** Easy to forget on a new endpoint → bug that's invisible to reviewers.
- **Con:** Duplicated lookup logic across 5+ endpoints.

**Recommendation for this milestone:** Option A (middleware) for `Car` listings + `Broker`/`Logistics` public reads. The "safe by default" property is load-bearing — the milestone promises that suspending a seller hides their listings, and a single missed endpoint breaks that promise. Revisit if profiling shows the extra query matters.

### Pattern 5: Mobile Status Propagation via `refreshUser` Hook

**What:** The existing `AuthContext.refreshUser()` already re-fetches the backend user. Extend `GET /api/users/:uid` to include `status`, `statusReason`, `statusSeverity`, `restrictedFeatures[]`. Then:

1. Call `refreshUser()` in `AuthContext.loadStorageData()` (app start / resume from background).
2. Call `refreshUser()` on `AppState` change from `background` → `active` (handles "admin moderated while user was in background").
3. Call `refreshUser()` after receiving a 403 `ACCOUNT_RESTRICTED` response in the axios client interceptor.

**When to use:** This is the minimum-plumbing approach that fits the existing AuthContext pattern.

**Trade-offs:**
- **Pro:** Zero new state machinery. Zero new WebSocket/polling infrastructure.
- **Pro:** Guaranteed in-sync on the two moments that matter (app open, next request).
- **Con:** No real-time push — user keeps seeing old UI until next app-state change or next API call. Acceptable for this milestone (in-app notification only, no email/push).
- **Con:** `AuthContext` keeps absorbing concerns. See §Coupling hot-spots for the mitigation.

---

## Data Flow

### Flow 1: Admin action → persisted audit

```
[Admin taps "Suspend (feature-limited)" on AdminManagementScreen]
        ↓
[SeverityPickerModal + ReasonPicker collect: severity, reasonCategory, note]
        ↓
[ModerationService.suspend(targetUid, severity, reasonCategory, note)]
        ↓ POST /api/admin/moderation/:targetUid  (Authorization: Bearer <adminIdToken>)
        ↓ body: { action: 'suspend', severity, reasonCategory, note }
┌───────────────────────────────────────────────────────────────────┐
│ verifyFirebaseToken → req.firebaseUid = admin's UID               │
│ loadUser            → req.user = admin record                     │
│ requireAdmin        → AdminUser.exists? ok                        │
│ moderation.controller.suspend(req, res)                           │
│     └─ moderation.service.applySuspension(adminUid, targetUid,    │
│        { severity, reasonCategory, note })                        │
│            ├─ maps severity → status (feature_limited | ...)      │
│            ├─ User.updateOne({firebaseUid: targetUid}, {          │
│            │     status, statusReason, statusSeverity,            │
│            │     statusAt: now, statusBy: adminUid })             │
│            └─ audit.service.append({                              │
│                  adminUid, targetUid, action: 'suspend',          │
│                  severity, reasonCategory, note, at: now })       │
│         ↳ 200 { ok: true, newStatus, auditId }                    │
└───────────────────────────────────────────────────────────────────┘
        ↓ response
[AdminManagementScreen: optimistic row update + toast "User suspended"]
```

### Flow 2: Affected-user next session → enforcement on every API call

```
[Target user opens app — AsyncStorage has cached user record with status='active']
        ↓
[AuthContext.loadStorageData() → refreshUser()]
        ↓ GET /api/users/:uid  (Authorization: Bearer <userIdToken>)
        ↓
[Backend returns user with status='feature_limited', statusReason, ...]
        ↓
[AuthContext.setUser(updated) → all consumers re-render]
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ App.tsx renders <UserStatusBanner /> inside NavigationContainer │
│ Banner reads user.status !== 'active' → renders severity-aware  │
│ copy + action button (Resolve / Appeal / Learn more)            │
└─────────────────────────────────────────────────────────────────┘
        ↓
[User taps "Sell car" → navigates to SellCarScreen]
        ↓
[SellCarScreen reads useFeatureGate('create_listing') → blocked=true]
        ↓
[FeatureGateOverlay shows: "This action is unavailable while your account is..."]
        ↓
[If user bypasses UI (offline form cache, deep link, etc.):]
        ↓ POST /api/cars  (Authorization: Bearer <userIdToken>)
┌─────────────────────────────────────────────────────────────────┐
│ verifyFirebaseToken → req.firebaseUid                           │
│ loadUser            → req.user (status='feature_limited')       │
│ requireStatus({ allow: ['active'] }) → 403 ACCOUNT_RESTRICTED   │
└─────────────────────────────────────────────────────────────────┘
        ↓ 403
[axios client interceptor: on 403 ACCOUNT_RESTRICTED → refreshUser()]
        ↓
[Banner + overlay now show updated reason if changed]
```

### Flow 3: Real-time-ish propagation (AppState handler)

```
[User backgrounds app → Admin suspends them → User foregrounds app]
        ↓
[App.tsx subscribes to AppState 'change' event → on 'active': refreshUser()]
        ↓
[user.status updates → UserStatusBanner appears without user action]
```

### Flow 4: Listing hidden from public browse (Mongoose middleware)

```
[Any user on HomeScreen → fetchCars()]
        ↓ GET /api/cars
        ↓
[cars.controller.list → Car.find({ ...filters })]
        ↓ triggers Car.pre('find')
        ↓ middleware queries User.distinct('firebaseUid', {status: {$in: BLOCKED}})
        ↓ injects .where({ sellerUid: { $nin: blockedUids } })
        ↓
[Returned listings exclude suspended-seller cars automatically]
```

### State Management (mobile)

```
Server user record (authoritative)
    ↓ fetched by AuthService.getBackendUser
AuthContext.user  (includes .status, .statusReason, .statusSeverity, .restrictedFeatures)
    ↓ read by
 ├─ UserStatusBanner (global overlay)
 ├─ useFeatureGate(feature) hook (per-screen gating)
 └─ AdminManagementScreen / AdminModerationScreen (when user is admin)
```

---

## Build Order

Phases MUST proceed backend-first within each layer. Mobile cannot build against an imaginary API.

1. **Phase B1 — Data model + audit foundation (backend)**
   - Add `status`, `statusReason`, `statusSeverity`, `statusAt`, `statusBy`, `restrictedFeatures[]` to `User` model.
   - Create `ModerationAudit` collection + model with append-only `pre('save')` guard.
   - Create `audit.service.ts` (only `append` + `listByTarget` exported).
   - Migration: backfill existing users with `status: 'active'`.
   - **Ships nothing user-visible.** Foundation only. Gate: unit tests on service + immutability guard.

2. **Phase B2 — Moderation endpoints (backend)**
   - `moderation.service.ts` with `applySuspension`, `revokeRole`, `deleteProviderProfile`, `unsuspend`, `editProviderProfile`.
   - `moderation.controller.ts` + `moderation.routes.ts` mounted at `/api/admin/moderation`.
   - For this phase use existing admin-auth pattern (`callerUid` param → `getAdminStatus`) to avoid blocking on Firebase Admin SDK setup. **Flag a follow-up ticket to lift to proper `verifyFirebaseToken`** (see §Architectural improvement).
   - Gate: Postman/integration tests against staging; admin can POST, audit rows appear, user.status changes.

3. **Phase B3 — Enforcement middleware (backend)**
   - Add `loadUser` middleware and `requireStatus` middleware (without full Firebase token verification yet — read `firebaseUid` from the same place existing routes do, typically `:firebaseUid` path param or body).
   - Apply `requireStatus({ allow: ['active'] })` to: `POST /api/cars`, `POST /api/orders`, `POST /api/payments/create-payment-intent`, `PUT /api/brokers/:uid`, `PUT /api/logistics/:uid`.
   - Add Mongoose `pre('find')` middleware on `Car` (and broker/logistics public reads) to auto-filter hidden sellers.
   - Gate: integration test — suspend user, confirm POST returns 403; confirm their listings vanish from public browse.

4. **Phase M1 — Mobile service + state plumbing**
   - Create `src/services/http/client.ts` (shared axios instance with interceptors).
   - Create `src/services/moderation/ModerationService.ts` using the shared client. **Do NOT add methods to `AuthService`.**
   - Extend `AuthContext.user` typing to include moderation status fields.
   - Add axios response interceptor: on 403 `ACCOUNT_RESTRICTED` → `refreshUser()`.
   - Add AppState handler in `App.tsx`: on `background → active` transition → `refreshUser()`.
   - Gate: `user.status` visible in React DevTools after admin suspension + foreground.

5. **Phase M2 — Admin quick actions (extend existing screen)**
   - Add `ModerationActionRow` component to `AdminManagementScreen` rows.
   - Wire `SeverityPickerModal` + `ReasonPicker` + `ModerationService.suspend` / `revokeRole` / `deleteProviderProfile`.
   - Gate: admin can suspend from the existing screen; backend audit row created.

6. **Phase M3 — Dedicated moderation screen**
   - Build `AdminModerationScreen` (search by email/UID, filter by status/role, per-user history tab).
   - Add route to `RootStackParamList` + `App.tsx`.
   - Deep-link from `AdminManagementScreen` action row "View history".
   - Gate: admin can open target user, see full audit history, unsuspend.

7. **Phase M4 — Affected-user UI (banner + gates)**
   - Create `UserStatusBanner` (global; rendered in `App.tsx` inside `NavigationContainer`).
   - Create `useFeatureGate` hook + `FeatureGateOverlay` component.
   - Apply gate to: `SellCarScreen`, `ServiceCartScreen`, `ServiceApplicationScreen`, contact-seller CTA on `CarDetailsScreen`.
   - Add RU + EN translations for all severity-specific banner copy.
   - Gate: suspend a test user → banner visible on next open, restricted CTAs show overlay.

**Why this order:**
- Audit + data model first means all subsequent phases emit audit rows correctly from day one (no retrofit).
- Enforcement middleware before mobile service prevents a class of "mobile allows something server still accepts" bugs during development.
- Admin quick actions before the dedicated screen because quick actions use all the new plumbing (moderation endpoints, ModerationService, action modals) — shipping them first validates the plumbing under real admin use. The dedicated screen is then mostly UI on top of the same plumbing.
- Affected-user UI last because it needs a live suspended test account to validate banner copy, overlay UX, and severity branching — easier to create once admin actions work end-to-end.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current design is fine. `User.findOne` per request is cheap with the existing `firebaseUid` unique index. |
| 1k-100k users | Add in-memory LRU cache (e.g., `lru-cache` in-process) on `loadUser` with a short TTL (30-60s). Invalidate explicitly from `moderation.service` after any status mutation. |
| 100k+ users / multi-instance | Promote cache to Redis. Publish a "user.status.changed" event on mutation; each instance subscribes and invalidates its local cache. Consider signed JWT claim for status to skip the DB lookup entirely, with a short TTL to bound staleness. |

### Scaling Priorities

1. **First bottleneck:** Mongoose `pre('find')` middleware doing a `User.distinct('firebaseUid', {status: {$in: [...]}})` on every car list query. Fix: cache the blocked-seller UID set in memory (short TTL) and invalidate on moderation mutation. Simple change, low risk.
2. **Second bottleneck:** `loadUser` DB hit on every authenticated request. Fix: same LRU-cache pattern or embed `status` in a signed short-lived token at login/refresh time.

---

## Anti-Patterns

### Anti-Pattern 1: Client-Trusted Admin Flag

**What people do:** Mobile checks `isAdmin` and simply hits moderation endpoints. Backend trusts a `callerUid` field in the body and looks up admin status from that — but the field is client-controlled.

**Why it's wrong:** Anyone can curl the endpoint with someone else's `callerUid` and impersonate an admin. This is the current pattern in CarEx admin endpoints and the most important thing to close, even incrementally.

**Do this instead:** Server verifies a real Firebase `idToken` from the `Authorization` header via `firebase-admin.auth().verifyIdToken(token)` and derives the admin check from the verified UID. The client never supplies its own identity.

### Anti-Pattern 2: Putting Moderation Calls on AuthService

**What people do:** "It's the HTTP client, so moderation goes there." `AuthService.suspendUser`, `AuthService.getModerationHistory`, etc.

**Why it's wrong:** `AuthService` is already 378 lines across ~9 domains and is the primary reason mobile code is hard to change. Piling moderation on top entrenches the god-module.

**Do this instead:** New `ModerationService` module using a shared `http/client.ts`. Establishes the pattern that future extractions (Cars, Orders, Brokers, etc.) will follow when the tech-debt sweep comes. Costs one new file; saves a future rewrite.

### Anti-Pattern 3: Status Enforcement as Handler `if`-Statements

**What people do:** Every handler starts with `if (req.user.status !== 'active') return res.status(403)...`.

**Why it's wrong:** One missed handler = one hole in the moderation. A year from now a new engineer adds an endpoint and the check is forgotten.

**Do this instead:** `requireStatus({ allow: [...] })` middleware applied at route registration. New routes without it are visibly missing a line — easier to catch in review.

### Anti-Pattern 4: Hard-Deleting Provider Profile Without Preserving Orders

**What people do:** Cascade-delete orders and payment records when admin clicks "Delete profile."

**Why it's wrong:** Destroys buyer history and accounting records, violates the explicit requirement ("past orders preserved"), and is irreversible.

**Do this instead:** Delete the provider profile row only. On orders, replace the seller reference with an anonymized snapshot (`{ deleted: true, displayName: 'Former seller', firebaseUid: null }`). `audit.service` retains the original UID in the audit row for traceability.

### Anti-Pattern 5: Real-Time Status via Polling or WebSocket (for this milestone)

**What people do:** Add WebSocket or 30-second polling to push status changes instantly.

**Why it's wrong:** The requirement is "in-app banner on next login" — not real-time. Polling/WebSocket adds infrastructure, battery cost, and failure modes for a UX that the spec does not require.

**Do this instead:** `refreshUser()` on app start + on `AppState` background→active transition + on 403 `ACCOUNT_RESTRICTED` interceptor. Zero new infra. Defer real-time push to a future milestone if ever requested.

### Anti-Pattern 6: Updatable Audit Rows

**What people do:** Use a standard Mongoose collection for audit and let anyone `update()` rows.

**Why it's wrong:** Defeats the whole point of audit. One buggy script can silently rewrite history.

**Do this instead:** `pre('save')` rejecting non-new docs; no `findOneAndUpdate` exposed via the service API.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Firebase Identity Toolkit | Mobile obtains `idToken` from existing login flow (no change). Backend adds `firebase-admin` SDK + `verifyIdToken()` usage. | The recommended architectural improvement. Not strictly in scope for this milestone but should be scheduled as the next deliverable after moderation ships. |
| MongoDB Atlas | Add indexes: `users.status` (for blocked-seller distinct lookups), `moderation_audit.targetUid + at` (for history reads), `moderation_audit.adminUid + at` (for "actions by admin X"). | Low-risk additions; run in migration alongside Phase B1. |
| Stripe | Payment intent creation must reject for non-active users. Add `requireStatus({ allow: ['active'] })` to `POST /api/payments/create-payment-intent`. | Pre-existing in-flight orders touching a suspended provider must *pause* (order status transition), not auto-refund. This is order-service logic, not payment logic. |
| AsyncStorage | Persist user with new status fields alongside existing cached user record. No schema versioning needed if fields are additive (default `active`). | On read of an old cache lacking `status`, default to `'active'` and let `refreshUser()` correct it. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `moderation.controller` ↔ `moderation.service` | Direct function call | Controller validates HTTP shape; service holds business rules. |
| `moderation.service` ↔ `audit.service` | Direct function call (`appendModerationAudit`) | `audit.service` is the **only** writer to the audit collection. |
| `moderation.service` ↔ `User` model | Direct model access (`User.updateOne`) | Acceptable for a single-collection write. If logic grows, promote to a `user.repo.ts`. |
| Mobile `ModerationService` ↔ Mobile `AuthContext` | No direct dependency. Admin screens call `ModerationService` and then call `AuthContext.refreshUser()` if they need their own view updated. | Keeps the service side-effect-free. |
| Mobile `UserStatusBanner` ↔ `AuthContext` | Read-only via `useAuth().user`. | Banner re-renders automatically when `refreshUser()` updates the user. |
| Mobile axios interceptor ↔ `AuthContext` | One-way via exported `refreshUser` ref (small coupling). | Interceptor needs a way to trigger refresh without importing React. Use a module-level setter (`authContextRef.refreshUser = ...`) written on mount. |

---

## Coupling Hot-Spots / God-Module Risk

**AuthService.ts is the primary coupling hot-spot.** It is 378 lines across auth, users, brokers, logistics, admin, OTP, payments, and orders — every new feature makes it worse. Out-of-scope for this milestone is a full rewrite, but the moderation work provides a **cheap precedent** that future extractions will follow:

**Do:**
- Create `src/services/http/client.ts` — shared axios instance with interceptors. Small, pure extraction.
- Put new moderation calls in `src/services/moderation/ModerationService.ts` using that shared client.
- Leave `AuthService.ts` otherwise untouched.

**Do NOT:**
- Add `AuthService.suspendUser(...)` etc. This extends the god-module and is the single most-likely decision that will erase the architectural benefit.
- Rewrite `AuthService.ts` in this milestone. Out of scope, too risky for a moderation release.

**Follow-up ticket to file (explicitly not in this milestone):**
- "Lift admin auth from `callerUid` body param to `firebase-admin.auth().verifyIdToken()`." The moderation endpoints will ship using the existing `callerUid` pattern to keep the milestone tight, but this is an **architectural improvement** the team should schedule immediately after. It closes a real privilege-escalation hole and is required before the admin surface grows further. The groundwork for this ticket is already scaffolded by the `loadUser` / `requireAdmin` middleware — it only needs to swap the source of `req.firebaseUid` from a body param to a verified token.

**Why call out the ticket here?** Because the moderation milestone is the last point at which the team can *choose* to build the new admin endpoints on either side of that line. Putting the recommendation in the architecture document makes the choice explicit rather than accidental.

---

## Sources

- `.planning/PROJECT.md` — requirements and scope (this milestone)
- `.planning/codebase/ARCHITECTURE.md` — existing mobile architecture
- `.planning/codebase/STRUCTURE.md` — existing file layout
- `.planning/codebase/INTEGRATIONS.md` — existing API surface and auth integration
- `src/context/AuthContext.tsx` — confirms existing `refreshUser`, `isAdmin`, `adminRole` plumbing
- `src/services/AuthService.ts` — confirms god-module risk (lines 1-378, ~9 domain surfaces)
- Express middleware composition patterns — standard: [Express docs, middleware](https://expressjs.com/en/guide/using-middleware.html) (MEDIUM confidence, broadly accepted pattern)
- Mongoose query middleware — standard: [Mongoose middleware docs](https://mongoosejs.com/docs/middleware.html) (HIGH confidence, documented feature)
- Firebase Admin `verifyIdToken` — standard: [Firebase Admin auth docs](https://firebase.google.com/docs/auth/admin/verify-id-tokens) (HIGH confidence, documented; noted as improvement, not milestone scope)

---

*Architecture research for: admin moderation subsystem (CarEx)*
*Researched: 2026-04-17*
