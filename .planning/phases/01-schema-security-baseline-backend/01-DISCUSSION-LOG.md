# Phase 1: Schema + Security Baseline (Backend) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 01-schema-security-baseline-backend
**Areas discussed:** Backend code structure, Firebase Admin migration strategy
**Areas deferred to Claude's Discretion (with user acceptance):** Capability map design, Migration / backfill mechanism

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Backend code structure | Keep in server.js vs. start extracting into src/moderation/ modules | ✓ |
| Firebase Admin migration strategy | Hard cut, dual-path, or hybrid (new routes only) | ✓ |
| Capability map design | Flat enum map vs. rich policy object | |
| Migration / backfill mechanism | One-off script vs. startup check | |

**User's choice:** Backend code structure + Firebase Admin migration strategy
**Notes:** Capability map + migration mechanism deferred to Claude's Discretion with proposed defaults explicitly accepted after discussion.

---

## Backend Code Structure

### Question 1: For the new moderation code, how modular should the backend get?

| Option | Description | Selected |
|--------|-------------|----------|
| Start extracting: src/moderation/ module (Recommended) | New code goes into src/moderation/ + src/security/. server.js requires them. Seeds the pattern for later extraction. | ✓ |
| Keep in server.js | Add schemas, middleware, routes inline. Entrenches the god-file. | |
| Full modular split now | Break server.js into controllers/, models/, routes/, middleware/ in Phase 1. Scope balloon. | |

**User's choice:** Start extracting — src/moderation/ module
**Notes:** Mirrors the mobile ModerationService split. Does not touch existing Broker/Logistics/Car/Order models.

### Question 2: Where does the new User.moderationStatus subdoc + new ModerationAction model live?

| Option | Description | Selected |
|--------|-------------|----------|
| Extract to src/models/ alongside new moderation code (Recommended) | Move User, AdminUser, ModerationAction to src/models/*.js. Other models stay in server.js. | ✓ |
| Add subdoc inline in server.js, put ModerationAction in src/models/ | Minimal disruption to userSchema. | |
| Everything inline in server.js | Edit userSchema in-place. Simplest diff. | |

**User's choice:** Extract to src/models/ for User, AdminUser, ModerationAction only
**Notes:** Consistent with src/moderation/ split. Broker, Logistics, Car, ServiceOrder stay inline.

### Question 3: Business logic for suspend/unsuspend/etc — where does it live?

| Option | Description | Selected |
|--------|-------------|----------|
| src/moderation/service.js (Recommended) | Thin route handlers call moderation.service.suspend(...). Service owns transaction, audit, validation. | ✓ |
| Inline inside route handlers in server.js | Everything in the route function. Hardest to test. | |

**User's choice:** src/moderation/service.js
**Notes:** Phase 1 scaffolds the service-module signatures; Phase 2 fills in suspend/unsuspend/etc endpoints.

### Question 4: Does this phase introduce test infrastructure?

| Option | Description | Selected |
|--------|-------------|----------|
| Add minimal Jest + supertest for new moderation code only (Recommended) | jest + supertest, tests for append-only guard, capability map, requireAdmin. | ✓ |
| No tests this phase | Defer test infra to tech-debt milestone. Manual curl + DB inspection only. | |

**User's choice:** Add minimal Jest + supertest, scoped to new code only
**Notes:** Does not backfill tests on legacy handlers. Uses mongodb-memory-server for in-memory DB tests.

---

## Firebase Admin Migration Strategy

### Question 1: How aggressive should the firebase-admin idToken cutover be?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: new moderation routes only (Recommended) | verifyIdToken applied only to /api/admin/moderation/*. Legacy admin routes keep callerUid. | ✓ |
| Hard cut every admin route | Migrate all admin routes in Phase 1. Higher risk. | |
| Dual-path on every admin route | Accept both Bearer and callerUid for 1-2 deploys with deprecation warning. | |

**User's choice:** Hybrid — new moderation routes only
**Notes:** Legacy admin routes flagged as known-spoofable in CONTEXT.md Deferred Ideas.

### Question 2: How does the Firebase service account key reach the backend (Railway)?

| Option | Description | Selected |
|--------|-------------|----------|
| Single env var FIREBASE_SERVICE_ACCOUNT_JSON = stringified JSON (Recommended) | One env var, JSON.parse at boot. Simplest. | ✓ |
| Three vars: FIREBASE_PROJECT_ID + CLIENT_EMAIL + PRIVATE_KEY | Standard Google recipe. Private key needs newline escaping. | |
| Service account file on disk | Ship a JSON file. Not recommended for Railway's ephemeral containers. | |

**User's choice:** Single env var (stringified JSON)

### Question 3: SEC-02 — how does mobile pass idToken?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 4 extracts http/client.ts with idToken interceptor (Recommended) | Confirms roadmap. Phase 1 is backend-only. | ✓ |
| Add idToken interceptor in Phase 1 as ModerationService preview | Ship a stub mobile module in Phase 1. | |
| Just document the Bearer header contract — all mobile work in Phase 4 | Phase 1 stays purely backend; CONTEXT.md documents the contract. | |

**User's choice:** Phase 4 handles all mobile work
**Notes:** Phase 1 stays purely backend.

### Question 4: 401 response shape from verifyIdToken?

| Option | Description | Selected |
|--------|-------------|----------|
| `{ error: 'unauthenticated', message: 'Missing or invalid idToken' }` (Recommended) | Consistent error-code scheme with 403 account_suspended. Mobile can distinguish. | ✓ |
| Bare 401 empty body | Smallest response. | |
| `{ message: 'Unauthorized' }` to match legacy 403 body | Matches existing admin routes. | |

**User's choice:** `{ error: 'unauthenticated', message: 'Missing or invalid idToken' }`
**Notes:** Deliberately distinct from legacy `{ message: 'Unauthorized' }` shape to let mobile interceptor tell old vs new paths apart.

---

## Claude's Discretion (Deferred Areas)

### Capability map design

**Proposed default (accepted by user):** Rich policy object shape:

```js
const STATUS_POLICY = {
  active: { capabilities: 'all', banner: null },
  feature_limited: { capabilities: { blocked: [...] }, banner: { titleKey, bodyKey, appealAllowed: false, resolutionHintKey } },
  blocked_with_review: { capabilities: { blocked: 'all_writes' }, banner: { titleKey, bodyKey, appealAllowed: true, appealEmail } },
  permanently_banned: { capabilities: { blocked: 'all_writes' }, banner: { titleKey, bodyKey, appealAllowed: false } },
};
```

**Rationale:** Phase 4 mobile overlay + Phase 6 banner both need per-state metadata. Colocating capabilities + banner contract prevents drift across files.

### Migration / backfill mechanism

**Proposed default (accepted by user):** Belt + suspenders:
1. `scripts/migrate-moderation.js` — one-off Node script, run manually
2. `src/security/ensureBaseline.js` — startup check that logs (not auto-migrates) if unmigrated users/orders exist

**Rationale:** Explicit migration avoids surprising production writes on deploy. Startup check protects fresh environments.

---

## Deferred Ideas (preserved for future phases / milestones)

- Migrate legacy `/api/admin/requests`, `/api/admin/users`, `/api/admin/status` to Bearer idToken (follow-up security milestone)
- DB-user-level insert-only privilege on `moderation_actions` (Atlas privilege change)
- Hash-chain tamper-evidence on ModerationAction (hardening milestone)
- Express 5 → Express 4 performance downgrade (dedicated perf milestone)
- Extract brokers/logistics/orders/payments models from server.js (tech-debt milestone)
- Backfill tests on legacy server.js handlers (tech-debt milestone)
