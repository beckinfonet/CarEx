# Stack Research — Admin Moderation Additions

**Domain:** Admin moderation / trust-and-safety on an existing React Native + Node/Express + MongoDB marketplace
**Researched:** 2026-04-17
**Confidence:** HIGH (Firebase auth, Zod, express-rate-limit, mongoose patterns) / MEDIUM (audit-log approach — opinionated recommendation against plugins for this use case)

## Scope Note

This is a **milestone addition**, not a greenfield stack. The existing stack is fixed:

- **Mobile (fixed):** React Native 0.83, TypeScript 5.8, axios 1.13, AsyncStorage 2.2, `@react-navigation/native-stack` 7.11, Stripe, Lucide, in-repo `translations.ts` (RU/EN)
- **Backend (fixed):** Node.js >= 20, Express (current version unknown — see compatibility note below), Mongoose + MongoDB Atlas, AWS S3, Twilio (optional)
- **Identity (fixed):** Google Identity Toolkit REST (mobile-side); backend currently trusts `firebaseUid` body param

All recommendations below are **additive**. Nothing replaces existing frameworks.

---

## Recommended Additions

### Backend (carEx-services) — Core

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `firebase-admin` | `^13.8.0` | Server-side verification of the Firebase idToken the mobile app already has in AsyncStorage | **Critical security upgrade.** Today the backend trusts `firebaseUid` passed in request bodies — anyone with another user's UID can impersonate them. `firebase-admin.auth().verifyIdToken(idToken)` validates signature, expiration, audience, issuer against Google's rotating public keys. Required baseline for any moderation endpoint. Latest as of April 2026. Node 20+ supported. |
| `zod` | `^3.24.x` (or `^4.x` if upgrading) | Request-body / params validation for moderation payloads (severity enum, reason category enum, optional note) | Moderation endpoints accept structured input with strict enum constraints (severity: `feature_limited` \| `blocked_with_review` \| `permanently_banned`; reason: `spam` \| `policy_violation` \| `fraud` \| `other`). Zod parses + narrows types in a single pass, gives usable error payloads, and the mobile-side can literally share schema files if desired. 40M+ weekly downloads, de-facto standard in 2026. |
| `express-rate-limit` | `^8.3.2` | Rate-limit moderation endpoints (admin mistake amplification guard) and auth-verify failures | Admin actions are destructive (suspend/revoke/delete). Rate-limiting prevents both runaway scripts and credential-stuffing against `verifyIdToken`. Apply tight limits (e.g., 30 moderation actions / 15 min / admin) on the moderation router. 31M+ weekly downloads, key ecosystem project. |

### Backend — Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/express` / `@types/node` | current | TS types if backend is TypeScript (verify with `carEx-services` repo) | Already present if backend uses TS — no action. If plain JS, do NOT introduce TS in this milestone. |
| `jsonwebtoken` | — | **NOT needed** | `firebase-admin.verifyIdToken()` handles JWT verification end-to-end including key rotation. Don't hand-roll with `jsonwebtoken`. |
| `helmet` | `^8.x` | Security headers on admin routes | Low-cost add if not already present. Safe to skip if out of scope. |

### Mobile (carEx) — No New Dependencies

**Recommendation: do not add any new npm packages to mobile for this milestone.**

Every required pattern — global banner, route guard, feature-limit overlay, status-driven UI — is achievable with existing primitives:

- `AuthContext` (already has `user`, `refreshUser`) — extend with `user.moderationStatus`
- `AsyncStorage` — persist last-seen status for offline-first banner
- `@react-navigation/native-stack` — conditional screen registration based on status
- `translations.ts` — RU/EN strings for banner + overlay copy
- Plain React components — the banner is a `View` + `Text` rendered conditionally from `App.tsx` sibling to `<OfflineNotice />`

Adding a state-management lib, a toast lib, or a banner lib would expand scope without delivering value given the single global banner + overlay requirement.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Postman / Thunder Client | Manual verification of admin endpoints with real idTokens | Non-installed; idToken can be copied out of mobile AsyncStorage in dev |
| `mongosh` / Atlas Data Explorer | Inspect `moderationactions` and `users.moderationStatus` during development | Already available |

---

## Installation

### Backend (carEx-services repo)

```bash
# Core additions
npm install firebase-admin@^13.8.0 zod@^3.24 express-rate-limit@^8.3

# Optional (only if helmet not already present and scope permits)
npm install helmet@^8

# Firebase service-account JSON is added to Railway env as FIREBASE_SERVICE_ACCOUNT
# (stringified JSON) or GOOGLE_APPLICATION_CREDENTIALS path — see Firebase docs
```

### Mobile (carEx repo)

```bash
# Intentionally empty. No new packages for this milestone.
```

---

## Pattern Recommendations (Prescriptive)

### 1. Mongoose Schema — separate `ModerationAction` collection + `moderationStatus` subdoc on `User`

**Do this (recommended):**

```js
// models/User.js — add subdocument to existing User schema
const ModerationStatusSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      enum: ['active', 'feature_limited', 'blocked_with_review', 'permanently_banned'],
      default: 'active',
      index: true, // supports list-filter queries from admin UI
    },
    reasonCategory: {
      type: String,
      enum: ['spam', 'policy_violation', 'fraud', 'other', null],
      default: null,
    },
    note: { type: String, default: null },
    appliedAt: { type: Date, default: null },
    appliedBy: { type: String, default: null }, // admin firebaseUid
    lastActionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ModerationAction', default: null },
  },
  { _id: false },
);

UserSchema.add({ moderationStatus: { type: ModerationStatusSchema, default: () => ({}) } });
// Compound index for common admin query: "list blocked sellers"
UserSchema.index({ 'moderationStatus.state': 1, roles: 1 });
```

```js
// models/ModerationAction.js — NEW collection, immutable audit rows
const ModerationActionSchema = new mongoose.Schema(
  {
    targetUid: { type: String, required: true, index: true }, // Firebase UID
    adminUid: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ['suspend', 'unsuspend', 'revoke_role', 'delete_provider_profile', 'edit_provider_profile'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['feature_limited', 'blocked_with_review', 'permanently_banned', null],
      default: null, // null for non-suspend actions
    },
    reasonCategory: {
      type: String,
      enum: ['spam', 'policy_violation', 'fraud', 'other'],
      required: true,
    },
    note: { type: String, default: null, maxlength: 2000 },
    roleAffected: { type: String, enum: ['seller', 'broker', 'logistics', null], default: null },
    // For edit actions only: snapshot of changed fields
    fieldDiff: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { minimize: false },
);

// Indexes for the two primary queries:
ModerationActionSchema.index({ targetUid: 1, createdAt: -1 }); // "show history for user"
ModerationActionSchema.index({ adminUid: 1, createdAt: -1 }); // "show actions by admin"

// Audit rows are append-only — block updates/deletes at the application layer
ModerationActionSchema.pre('findOneAndUpdate', function () {
  throw new Error('ModerationAction is append-only');
});
ModerationActionSchema.pre(/^delete/i, function () {
  throw new Error('ModerationAction is append-only');
});
```

**Why this shape:**
- **Current status on `User`** = single read, no join, for every gating check on every authenticated request. This is the hot path — keep it O(1).
- **Separate `ModerationAction` collection** = append-only ledger. Bounded growth isolated from the user document. Easier retention policies, easier export, no document-size risk from unbounded history.
- **Both**: `User.moderationStatus.lastActionId` back-references the newest action for cheap "current reason" display without scanning history.

**Don't do this (rejected alternatives):**
- ❌ Embedded `user.moderationHistory: []` array — grows unbounded, hits 16MB doc cap, blows up working-set memory for every `User` read (every authenticated request).
- ❌ Single polymorphic `AuditLog` collection covering all domains (orders, users, listings) — looks elegant, but loses type safety, complicates indexing, and `moderationActions` has specific fields (severity, reasonCategory) that would become sparse noise in a generic log.

### 2. Mongoose Query Middleware — auto-hide suspended sellers from public endpoints

```js
// plugins/hideModeratedUsers.js
function hideModeratedUsersPlugin(schema) {
  // Runs on find, findOne, findOneAndUpdate, count, etc.
  schema.pre(/^find/, function (next) {
    // Escape hatch for admin queries
    if (this.getOptions().includeAllUsers === true) return next();
    this.where({
      $or: [
        { 'moderationStatus.state': { $exists: false } },
        { 'moderationStatus.state': 'active' },
        { 'moderationStatus.state': 'feature_limited' }, // still visible; just feature-gated
      ],
    });
    next();
  });
}
```

**Wire this into `User`, `BrokerProfile`, `LogisticsProfile` schemas.** Then every existing public query (listings browse, broker search, etc.) automatically filters out `blocked_with_review` and `permanently_banned` owners **without touching the handler code**.

**Caveat & escape hatch:** Admin endpoints that need to see everyone pass `.setOptions({ includeAllUsers: true })`. This is the only idiom admins need to learn.

**For listings / orders owned-by-suspended-user** — handle via a separate pre-find plugin on `Car` / `Order` that looks up `ownerUid` status, **or** denormalize `ownerModerationState` onto the `Car` document and bump it in a post-save hook on `User`. Denormalized is faster at read time, at the cost of write-time sync. **Recommendation: denormalize** — hiding listings is a hot read path, suspending is a cold write path.

### 3. Authorization Middleware — `verifyFirebaseToken` + `requireAdmin`

Two separate middlewares, composed per-route:

```js
// middleware/verifyFirebaseToken.js
import admin from 'firebase-admin';

export async function verifyFirebaseToken(req, res, next) {
  const header = req.header('Authorization') || '';
  const m = header.match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: 'Missing Bearer token' });
  try {
    const decoded = await admin.auth().verifyIdToken(m[1], /*checkRevoked*/ true);
    req.firebaseUid = decoded.uid;
    req.firebaseToken = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// middleware/requireAdmin.js
export async function requireAdmin(req, res, next) {
  const adminDoc = await Admin.findOne({ firebaseUid: req.firebaseUid }).lean();
  if (!adminDoc) return res.status(403).json({ error: 'Admin required' });
  req.adminRole = adminDoc.role;
  next();
}

// middleware/requireNotSuspended.js — for regular user endpoints
export async function requireNotSuspended(req, res, next) {
  const user = await User.findOne({ firebaseUid: req.firebaseUid })
    .select('moderationStatus')
    .setOptions({ includeAllUsers: true })
    .lean();
  const state = user?.moderationStatus?.state || 'active';
  if (state === 'blocked_with_review' || state === 'permanently_banned') {
    return res.status(403).json({
      error: 'account_suspended',
      moderationStatus: user.moderationStatus, // mobile uses this to render banner
    });
  }
  if (state === 'feature_limited') {
    req.featureLimited = true;
    // Handler decides whether the specific feature is gated — e.g., creating a listing is gated, reading is not
  }
  next();
}

// Route wiring
router.post(
  '/api/admin/moderation/:targetUid',
  verifyFirebaseToken,
  requireAdmin,
  rateLimit({ windowMs: 15 * 60_000, max: 30 }),
  validate(ModerationActionSchemaZ), // zod
  moderationController.apply,
);
```

**Why this pattern (verified against Firebase docs + 2026 industry guidance):**
- Authentication and authorization are **separate** middlewares. Routes compose what they need.
- `checkRevoked: true` on `verifyIdToken` catches disabled users (admin deletion flow).
- `requireNotSuspended` is the *only* middleware that needs to touch every user-initiated write endpoint — one mount point, per-route opt-in, rather than rewriting 40 handlers.
- `req.firebaseUid` replaces the `firebaseUid` body/query param entirely. **Delete every `firebaseUid` from request bodies in favor of the verified token.**

**Rejected alternative: Passport.js.** Passport adds strategies, sessions, and serialization machinery this app doesn't use. `firebase-admin` + 15 lines of middleware is smaller, faster, and easier to read.

### 4. Mobile — Gating UX via existing primitives

**`AuthContext` extension (no new lib):**

```ts
// AuthContext.tsx additions
type ModerationStatus = {
  state: 'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned';
  reasonCategory: 'spam' | 'policy_violation' | 'fraud' | 'other' | null;
  note: string | null;
  appliedAt: string | null;
};

// Already-existing refreshUser() learns to merge moderationStatus from /api/users/:uid response
// Global axios response interceptor catches 403 { error: 'account_suspended' } and calls refreshUser()
```

**Route guard pattern (`App.tsx` — no new lib):**

```tsx
// Inside the existing native-stack navigator
{user?.moderationStatus?.state === 'permanently_banned' ? (
  <Stack.Screen name="Banned" component={BannedScreen} />
) : user?.moderationStatus?.state === 'blocked_with_review' ? (
  <Stack.Screen name="Blocked" component={BlockedScreen} />
) : (
  <>
    {/* existing screens */}
    <Stack.Screen name="Home" component={HomeScreen} />
    {/* ... */}
  </>
)}
```

This leverages the [React Navigation auth-flow pattern](https://reactnavigation.org/docs/auth-flow/) — **define different stacks based on auth state** — extended with moderation state as an additional discriminator. No deep linking hacks, no global redirects.

**Global banner (feature-limited users):**

```tsx
// App.tsx — sibling to <OfflineNotice />
{user?.moderationStatus?.state === 'feature_limited' && (
  <ModerationBanner status={user.moderationStatus} />
)}
```

**Feature-level gate (per-screen):**

```tsx
// CarCreateScreen.tsx
const { user } = useAuth();
if (user.moderationStatus?.state === 'feature_limited') {
  return <FeatureLimitedOverlay reason={user.moderationStatus.reasonCategory} note={user.moderationStatus.note} />;
}
```

**Do not add:** a "feature flag" library (LaunchDarkly, Unleash, etc.), a toast library, or a global modal library. The existing provider chain plus React Navigation auth-flow pattern covers every requirement.

### 5. Audit Log — hand-rolled, NOT a plugin

**Recommendation: write audit rows explicitly from the moderation controller. Do NOT use `mongoose-audit-trail`, `mongoose-history`, or `mongoose-diff-history`.**

Why not plugins:

| Package | Problem |
|---------|---------|
| `mongoose-audit-trail` | Last published 2020 — effectively abandoned. 256 weekly downloads. |
| `mongoose-history` | Still alive but generic; gives you full before/after snapshots per document change. Noisy for moderation (you want structured action rows, not diffs). |
| `mongoose-diff-history` | Auto-logs every schema update as a JSON diff. Great for tracking listing edits, wrong shape for moderation (you need `severity`, `reasonCategory`, `adminUid`, `action` — none of which are schema fields on `User`). |

**Why hand-rolled wins here:**
- Moderation actions are **semantic events**, not "the user document changed." A plugin can't capture "why" or "severity chosen."
- Append-only guarantees are easier to assert in application code (see the `pre('findOneAndUpdate')` guard above).
- ~15 LoC per action type. The plugin abstraction costs more than it saves for 5 action types.

**Pattern — one helper called from every moderation controller path:**

```js
async function writeModerationAction({ session, targetUid, adminUid, action, severity, reasonCategory, note, roleAffected, fieldDiff }) {
  const doc = await ModerationAction.create([{ targetUid, adminUid, action, severity, reasonCategory, note, roleAffected, fieldDiff }], { session });
  return doc[0];
}
// Wrap the status mutation + audit write in a Mongo transaction
// (MongoDB Atlas supports txns; the app is already on Atlas)
```

### 6. Feature-flag / status propagation — refresh on login + 403 interceptor

- **On login:** Existing `AuthContext` already calls `getBackendUser(uid)`. Include `moderationStatus` in that response — zero new code path.
- **Mid-session propagation:** Add an axios response interceptor that on HTTP 403 with `error: 'account_suspended'` calls `refreshUser()` and surfaces the banner. This covers the "admin bans user while they're using the app" case without polling.
- **Do not add:** WebSocket/SSE push, polling timers, Pusher, Ably, or Firebase Realtime Database listeners. These are all over-engineered for a state change that only matters at next API call anyway.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `firebase-admin.verifyIdToken()` | Custom JWT verification with `jsonwebtoken` + public keys | Only if you're escaping Firebase Auth entirely. Otherwise firebase-admin handles key rotation and revocation correctly. |
| Hand-rolled `ModerationAction` collection | `mongoose-diff-history` plugin | If you want generic field-level change tracking across every collection (e.g., also audit listing edits). Not appropriate for *moderation* actions — wrong shape. |
| Separate `verifyFirebaseToken` + `requireAdmin` middlewares | Single combined `requireAdminAuth` middleware | Only if admin endpoints are the only auth'd endpoints. They aren't — every user-initiated write will also gain `verifyFirebaseToken`. |
| Zod | Joi, express-validator, AJV | Joi is fine but heavier; express-validator is too imperative; AJV requires JSON Schema maintenance. Zod's TS-first inference is the 2026 default. |
| `express-rate-limit` in-memory | `rate-limit-redis` store | If the backend scales horizontally across multiple Railway instances. Current single-instance deployment doesn't need it. Add if and when you scale out. |
| React Navigation auth-flow pattern | Dedicated route-guard lib (react-router-guard, etc.) | Never — React Navigation's built-in conditional rendering pattern is the idiomatic solution. |
| Hand-rolled global banner | react-native-toast-message, react-native-notifier | A toast is the wrong affordance. Moderation status is **persistent**, not **transient** — a banner renders until the status changes. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `mongoose-audit-trail` | Abandoned (2020), 256 weekly downloads, wrong shape for moderation actions | Hand-rolled `ModerationAction` collection |
| `mongoose-history` / `mongoose-diff-history` | Generic schema-diff plugins; don't capture moderation semantics (severity, reasonCategory, adminUid) | Explicit audit writes from moderation controllers |
| Passport.js | Overkill for a single Firebase-based auth strategy; adds session machinery unused here | `firebase-admin.verifyIdToken()` in a 20-line Express middleware |
| Hardcoded `firebaseUid` in request bodies (current pattern) | Trivially impersonable — existing security hole | `req.firebaseUid` from `verifyFirebaseToken` middleware; drop all body/query `firebaseUid` params |
| `jsonwebtoken` for Firebase token verification | Forces you to manage Google public-key rotation manually | `firebase-admin` handles key caching + rotation automatically |
| LaunchDarkly / Unleash / Flagsmith | Moderation status is not a feature flag — it's per-user persistent state from your DB | `user.moderationStatus` on `AuthContext` |
| Adding Redux / Zustand / Jotai to mobile for moderation state | AuthContext already holds `user`; adding a second state system duplicates work | Extend existing `AuthContext.user` with `moderationStatus` |
| Email/SMS notifications in this milestone | Explicitly out of scope (`.planning/PROJECT.md`) | In-app banner only |
| Express 5 migration as part of this milestone | Known perf regression vs Express 4 in 2026 benchmarks; unrelated scope risk | Stay on whatever Express major the backend currently runs |

---

## Stack Patterns by Variant

**If backend is currently Express 4.x:**
- Stay on Express 4. Express 5 is available but shows a measurable perf regression in 2026 Node 20/22 benchmarks, and migration risk is unjustified for a feature milestone.
- `firebase-admin`, `zod`, `express-rate-limit` all support Express 4 fine.

**If backend is currently TypeScript:**
- Share Zod schemas between backend and a `shared/` package if monorepo'd, or duplicate minimally. Don't block on infra changes.

**If backend is plain JS:**
- Use Zod in JS mode (`z.object({...}).parse(input)`) — no TS required.

**If Atlas cluster is M0/free tier:**
- Mongo transactions work on M0 replica sets. `ModerationAction.create(..., { session })` is safe.

**If you ever scale backend to >1 Railway instance:**
- Swap `express-rate-limit` default memory store → `rate-limit-redis` store. Until then, memory store is correct.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `firebase-admin@13.8.0` | Node.js >= 20 | Node 18 deprecated, dropped in v14. Project already requires Node >= 20. |
| `firebase-admin@13.8.0` | Existing Firebase Identity Toolkit REST clients on mobile | idTokens from REST signup/signin are fully compatible with Admin SDK `verifyIdToken`. **Verified.** |
| `zod@^3.24` | Node >= 16, TS >= 4.5 | Safe. Zod v4 is out but v3 is stable and widely adopted. Either works. |
| `express-rate-limit@^8.3.2` | Express 4 and 5 | Safe on both. |
| Mongoose 8.x or 9.x | `firebase-admin`, `zod`, `express-rate-limit` | All orthogonal — no coupling. |
| Mobile `@react-navigation/native-stack@7.11` | Moderation route guard pattern | Native stack supports conditional `Stack.Screen` siblings — the recommended pattern works as-is. |

---

## Sources

- [firebase-admin — npm](https://www.npmjs.com/package/firebase-admin) — Latest 13.8.0, Node 20+ support — **HIGH confidence**
- [Verify ID Tokens | Firebase Authentication](https://firebase.google.com/docs/auth/admin/verify-id-tokens) — Authoritative guidance on `verifyIdToken`, key caching, and `checkRevoked` — **HIGH confidence**
- [How to Use Firebase Auth Token Verification in an Express.js Middleware (OneUptime, Feb 2026)](https://oneuptime.com/blog/post/2026-02-17-firebase-auth-token-verification-express-middleware-cloud-run/view) — Current middleware pattern — **MEDIUM confidence**
- [Authentication flows | React Navigation](https://reactnavigation.org/docs/auth-flow/) — Conditional screen rendering based on auth/user state — **HIGH confidence**
- [express-rate-limit — npm](https://www.npmjs.com/package/express-rate-limit) — Latest 8.3.2 — **HIGH confidence**
- [How to Implement Soft Delete with Mongoose (OneUptime, Mar 2026)](https://oneuptime.com/blog/post/2026-03-31-mongodb-soft-delete-mongoose/view) — `pre(/^find/)` filter pattern — **HIGH confidence**
- [Mongoose v9.4.1 Middleware](https://mongoosejs.com/docs/middleware.html) — Official docs on `pre`/`post` hooks and query middleware — **HIGH confidence**
- [mongoose-audit-trail — npm](https://www.npmjs.com/package/mongoose-audit-trail) — Last published 6 years ago; abandoned — **HIGH confidence (rejection)**
- [mongoose-diff-history — GitHub](https://github.com/mimani/mongoose-diff-history) — Wrong shape for moderation actions — **MEDIUM confidence (rejection based on shape mismatch)**
- [How to Validate API Requests with Zod in Node.js (2026 Guide)](https://1xapi.com/blog/validate-api-requests-zod-nodejs-2026) — Zod v3.24, 40M+ weekly downloads, de-facto standard — **HIGH confidence**
- [Express 4 vs Express 5 Performance Benchmark](https://www.repoflow.io/blog/express-4-vs-express-5-benchmark-node-18-24) — Express 5 measurably slower than 4 — **MEDIUM confidence**
- [Mongoose — npm](https://www.npmjs.com/package/mongoose) — 9.0.0 released Nov 2025, 8.x maintenance through Feb 2026 — **HIGH confidence**
- `.planning/PROJECT.md`, `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/codebase/ARCHITECTURE.md` — Existing stack + milestone requirements — **HIGH confidence**

---

*Stack research for: admin moderation additions on React Native + Node/Express + MongoDB marketplace*
*Researched: 2026-04-17*
