# Phase 15: Broadcast New-Listing Notifications - Research

**Researched:** 2026-06-10
**Domain:** Server-side notification fan-out (Node/Express + Mongoose + firebase-admin) with a thin mobile (RN/TS) settings toggle
**Confidence:** HIGH (all claims grounded in the actual backend + mobile source, not training data)

## Summary

This is a backend-heavy phase that extends an already-shipped, well-instrumented v1.2 notification engine. The good news: every collaborator the plan needs already exists and is production-correct — `emit()`'s guard sequence, `fcm.send({ uid, ... })`'s per-uid DeviceToken fan-out with generic PII-free copy, the `DeviceToken` model indexed on `uid`, the digest's Asia/Bishkek 08:00 boundary, and the `translations.js` `push_*` pattern. Phase 15 adds a **broadcast branch** inside `emit()` for the `new_listing` event that resolves recipients from `DeviceToken` distinct-uids (not `Subscription`), filters by a new `User.notificationPrefs.newListingEnabled` pref, excludes the actor and saved-search-matched uids, enforces a per-user daily push cap, writes one in-app `Notification` row per recipient (uncapped), and sends one OS push per under-cap recipient via the existing `fcm.send`.

Two findings change the plan's shape and must be surfaced to the planner immediately. **(1) `notificationPrefs` is silently dropped on save today.** The mobile `NotificationSettingsScreen` persists prefs via `AuthService.updateBackendUser` → `PUT /api/users/:uid`, but that handler (`server.js:542`) only allowlists `firstName/lastName/phoneNumber/telegramUsername/avatarUrl/language` — it never reads `notificationPrefs` from the body. So the existing `savedSearchEnabled`/`watchEnabled` toggles do not actually persist server-side, and `newListingEnabled` won't either unless the plan adds `notificationPrefs` to that handler's allowlist (validated). This is a latent Phase-12 bug Phase 15 must fix to satisfy req 5/D-11. **(2) The `dailyCap` default in the model is `3`, not the `5` the SPEC/CONTEXT state** (`User.js:33` → `default: 3`; mobile `DEFAULT_DAILY_CAP = 3`). D-04/D-05 chose a *dedicated broadcast budget of 5* separate from the shared `dailyCap` pref, so this is reconcilable — but the plan must NOT reuse the `dailyCap` value as the broadcast budget without an explicit decision, and the "5" must come from a new constant, not the existing pref.

**Primary recommendation:** Add a parallel `new_listing_broadcast` branch inside `emit()` (NOT a new `Subscription.kind`) that runs AFTER the existing saved-search pass in the same `emit()` call, reuses the same hide-hook'd `visible` Car and the `written` saved-search rows as the dedup-exclusion set, introduces a `{ uid }`-shaped target descriptor (and widens the actor-exclude/dedup reads to accept `t.uid || t.sub?.uid`), and counts "broadcast pushes sent today" via a `pushSuppressed` boolean on the broadcast `Notification` rows queried against the Asia/Bishkek morning boundary. Fix the `PUT /api/users/:uid` allowlist to persist `notificationPrefs`. Add a third "Новые объявления"/"New Listings" toggle to `NotificationSettingsScreen` as a near-copy of the watch toggle.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Broadcast recipient resolution (distinct uids, pref-filtered, actor/dedup excluded) | API/Backend (`notificationService.emit`) | Database (`DeviceToken`/`User` indexed queries) | Recipient set is server-authoritative; mobile must never compute audience |
| Daily-cap enforcement (push only) | API/Backend (`emit` broadcast branch) | Database (broadcast `Notification` rows + Asia/Bishkek boundary) | Cap is a server budget; client cannot be trusted to count |
| OS push fan-out | API/Backend (`fcm.send` → `DeviceToken` per uid) | — | Already owns per-uid tokens, generic copy, retry/prune — reuse as-is |
| In-app feed entry (always written, uncapped) | API/Backend (`Notification.create`) | Mobile (bell/center renders existing rows) | Row carries i18n keys + deeplink; mobile localizes at read time |
| New-Listings opt-out preference | API/Backend (`User.notificationPrefs.newListingEnabled` + `PUT /api/users/:uid`) | Mobile (`NotificationSettingsScreen` toggle) | Pref is a User field; mobile is a thin persisted toggle |
| Send-time hide-hook re-read + actor exclusion | API/Backend (`emit` plain `Car.findById`) | — | Security-critical TOCTOU guard; grep-gated, mobile-irrelevant |
| RU/EN broadcast copy | API/Backend (`translations.js` `push_*` + in-app keys) | Mobile (`translations.ts` toggle label only) | Server renders push copy; mobile only needs the toggle label string |

## Standard Stack

No new libraries. Every dependency the phase needs is already installed and in use.

### Core (already present — reuse, do not add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mongoose | ^9.1.5 | `DeviceToken`/`User`/`Notification`/`Car` models + indexed queries | Already the data layer; distinct-uid + pref filter are plain Mongoose `[VERIFIED: backend package.json]` |
| firebase-admin | ^13.8.0 | FCM `sendEachForMulticast` (via `fcm.send`) | Already the push transport; broadcast reuses `fcm.send` unchanged `[VERIFIED: backend package.json + fcm.js]` |
| node-cron | ^4.2.1 | Daily-digest cron at 08:00 Asia/Bishkek (boundary reference only) | Already registered (`server.js:1524`); broadcast does NOT add a cron `[VERIFIED: backend package.json + server.js:1519-1536]` |
| zod | ^3.25.76 | Request schema validation (if a broadcast-related endpoint changes) | Already validates the device-token + subscription payloads `[VERIFIED: schemas.js]` |
| express | ^5.2.1 | HTTP layer (`PUT /api/users/:uid` allowlist fix) | Existing app server `[VERIFIED: backend package.json]` |

### Mobile (already present)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios | 1.13.4 | `AuthService.updateBackendUser` PUT for the new toggle | Toggle persistence — existing path `[VERIFIED: CLAUDE.md + AuthService.ts:167]` |
| @react-native-async-storage/async-storage | 2.2.0 | User cache (prefs merged via `getBackendUser`) | No change needed `[CITED: CLAUDE.md]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pushSuppressed` field on broadcast `Notification` rows | Separate per-user daily-counter doc | A counter doc is fewer rows to scan but adds a new collection + write contention + a reset job; the field-on-row approach reuses the existing `{uid, createdAt}` index and needs no reset (the date-bounded query self-resets). Field-on-row recommended (see Don't Hand-Roll). |
| Reusing the existing `dailyCap` pref value as the broadcast budget | New `BROADCAST_DAILY_CAP = 5` constant | D-05 explicitly chose a *dedicated* broadcast budget so saved-search/watch alerts never consume it. The shared `dailyCap` default is `3` anyway (conflicts with the SPEC's "5"). Use a new constant. |
| `{ uid }`-shaped target descriptor in the shared `filtered` loop | Parallel broadcast branch with its own loop | Either works; the `{ uid }` descriptor keeps one write loop but requires touching the actor-exclude/dedup `t.sub.uid` reads (blast radius below). A parallel branch isolates broadcast logic. **Recommend the `{ uid }` descriptor** — smaller, preserves guard order, one tested loop (see Pattern 2). |

**No installation needed.** Verify nothing new appears in either `package.json`.

**Version verification:** Versions above are read directly from `backend-services/carEx-services/package.json` (caret ranges, as committed). No registry lookup needed — the phase adds zero dependencies.

## Phase Requirements

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| Req 1 | Broadcast recipient resolution (all push-enabled users, actor excluded) | `DeviceToken.distinct('uid')` → filter by `User.notificationPrefs` (`newListingEnabled !== false` AND `!muteAll`) → exclude `event.actorUid`. Source of truth is `DeviceToken` (D-02). See Pattern 3 + Code Example 1. |
| Req 2 | Dedup against Saved Search (saved-search wins) | Build the exclusion set from the `written` rows of the existing saved-search pass *in the same `emit()` call* — those rows' uids already received `new_match`. Subtract from the broadcast audience. See Pattern 2. |
| Req 3 | Push + in-app feed entry per recipient | One `Notification.create` per recipient (kind `'new_listing'` or a broadcast kind) + `fcm.send({ uid, titleKey, data })` when under cap. Reuses existing row+push machinery. See Code Example 1. |
| Req 4 | Per-user daily cap (push only, in-app uncapped) | Count broadcast rows with `pushSuppressed !== true` for this uid since the Asia/Bishkek morning boundary; if `>= BROADCAST_DAILY_CAP`, write the row with `pushSuppressed: true` and skip `fcm.send`. See Pattern 4 + Open Q1. |
| Req 5 | New "New Listings" category (default ON, opt-out) | Add `newListingEnabled: { type: Boolean, default: true }` to `User.notificationPrefs`; surface as a third toggle in `NotificationSettingsScreen`; **FIX `PUT /api/users/:uid` to persist `notificationPrefs`** (currently dropped). Recipient query uses `$ne: false` to treat legacy docs as enabled. See Open Q5 + Pitfall 1. |
| Req 6 | Send-time guards preserved (hide-hook + actor) | Broadcast runs AFTER the existing `Car.findById(carId)` hide-hook re-read inside `emit()`, reusing the same `visible` doc; actor-exclude is applied to the broadcast audience. NEVER add `includeAllUsers`/`includeAllListingStatuses`. See HARD CONSTRAINT + Pattern 2. |
| Req 7 | RU/EN broadcast copy, no PII | Add a `push_new_listing` (generic push) + in-app `new_listing` entry to `translations.js` RU+EN blocks following the existing `push_*` pattern; parity test enforces equal key sets + no `{param}` tokens. See Pattern 5. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No new state-management or networking libs** (mobile): reuse axios/AsyncStorage. Backend: reuse Mongoose/firebase-admin. `[CITED: CLAUDE.md milestone constraints]`
- **Extend `AuthService.ts` or split sensibly; do not rewrite wholesale.** The new toggle reuses `AuthService.updateBackendUser`. `[CITED: CLAUDE.md]`
- **Admin/security endpoints validate server-side** — N/A to this phase's recipient path (no admin gate), but the `uid` for device-token/prefs writes always comes from the verified Bearer, never the body (already enforced; preserve it). `[CITED: CLAUDE.md + router.js:312]`
- **i18n RU-first with EN parity**, KGS som never ruble, no Russia-specific terms. Broadcast copy is generic/PII-free so currency/geo terms don't arise, but the toggle label and any copy stay RU-first. `[CITED: CLAUDE.md + project memory]`
- **No regression** to signup/login/browse/cart/Stripe or existing Saved-Search/Watch notifications. The broadcast branch must be additive to `emit()`. `[CITED: CLAUDE.md]`
- **Secrets hygiene:** no new hardcoded keys. `[CITED: CLAUDE.md]`

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Broadcast recipients = users with ≥1 `DeviceToken` row AND not muted New Listings AND no `muteAll`. Both OS push AND in-app bell entry go to this same set.
- **D-02:** Users with **no device token get nothing** (no in-app row either). `DeviceToken` distinct-uids is the recipient source of truth — NOT a full User-collection scan.
- **D-03:** Always exclude the actor (seller). Always exclude any uid who received a `new_match` (saved-search) notification for this same car in this emit cycle — **saved-search wins**.
- **D-04:** Cap = **5 broadcast pushes/user/day**. Resets each morning on Asia/Bishkek (same boundary as Phase-14 digest). Not a rolling 24h window.
- **D-05:** Cap counts **only broadcast pushes** (dedicated budget), not all instant notifications. *(Discretion-chosen: dedicated counter over reusing the shared `dailyCap` pref.)*
- **D-06:** Over-cap → still **write the in-app bell entry**, suppress the OS push. In-app entry never capped. No digest roll-over.
- **D-07:** Tapping a broadcast opens a **list of new cars** (`carex://search`, newest-first browse) — NOT a single car's detail page. Follows the `new_match` deeplink family.
- **D-08:** Push copy is **generic and PII-free** — category title + one canonical body, no make/model/price/seller. RU-first + EN parity, new `translations.js` keys.
- **D-09:** Copy is **neutral/informational — NOT personality-tier-aware** this phase.
- **D-10:** Broadcast fires **only on first creation** (rides existing `new_listing` emit). Re-list/un-hide does NOT re-broadcast. No new trigger.
- **D-11:** Add `newListingEnabled` (default `true`) to `User.notificationPrefs`, surfaced as a third "New Listings" toggle (RU "Новые объявления"), persisted via `AuthService.updateBackendUser`. Never-touched = enabled. `muteAll` still suppresses everything.

### Claude's Discretion

- **Cap-counting mechanism** — research-resolved: `pushSuppressed` boolean on broadcast `Notification` rows, counted against the Asia/Bishkek morning boundary (Open Q1). Hard constraint: rows-created ≠ pushes-sent (D-06), so the marker is mandatory.
- **Broadcast target shape inside `emit()`** — research-resolved: introduce `{ uid }`-shaped target descriptor; widen actor-exclude/dedup reads to `t.uid || t.sub?.uid`. Preserve guard order (Open Q2 + Pattern 2).
- **New eventType / dedupeKey** — research-resolved: `new_listing_broadcast`; `${carId}:new_listing_broadcast` cannot collide with `${carId}:new_match` (Open Q3).
- **Recipient query performance** — research-resolved: runs after-commit off the create response; `DeviceToken.distinct('uid')` (uid-indexed) → `User.find` pref filter. Optional `newListingEnabled` index (Open Q4).

### Deferred Ideas (OUT OF SCOPE)

- Personality-tier-aware broadcast copy (server push has no tier signal).
- In-app new-arrivals feed for users without push (D-02 chose against it).
- Audience segmentation / region targeting, admin-curated featured listings, quiet-hours enforcement, digest roll-over of capped overflow — all explicitly out per SPEC.

## Architecture Patterns

### System Architecture Diagram

```
POST /api/cars (seller creates listing)
      │
      ▼
 newCar.save()  ── res.status(201).json(...)  ◄── response returns here, BEFORE/independent of emit
      │
      ▼ (after-commit, off-hot-path, try/catch that never throws — server.js:913-921)
 notificationService.emit({ type:'new_listing', carId, actorUid })
      │
      ├─(a) HIDE-HOOK RE-READ ─ plain Car.findById(carId)  [NO bypass flags — grep-gated]
      │        └─ null OR status!=='active' ──► return []  (suppress everything)
      │
      ├─(b) SAVED-SEARCH PASS (existing) ─ resolveTargets → matchSavedSearches(visible)
      │        └─ writes new_match rows (dedupeKey `${carId}:new_match`)  ──► writtenSavedSearch[]
      │
      ├─(c) BROADCAST PASS (NEW) ─ only when eventType==='new_listing'
      │        │
      │        ├─ audience = DeviceToken.distinct('uid')              [uid index]
      │        ├─ filter: User where notificationPrefs.newListingEnabled !== false
      │        │           AND notificationPrefs.muteAll !== true      [pref query]
      │        ├─ exclude: actorUid (D-03)
      │        ├─ exclude: uids in writtenSavedSearch[]  (saved-search wins, D-03/req2)
      │        │
      │        └─ for each remaining uid:
      │             ├─ dedup: Notification.findOne({uid, dedupeKey:`${carId}:new_listing_broadcast`, read:false})
      │             ├─ cap:  count rows {uid, dedupeKey LIKE broadcast, pushSuppressed:{$ne:true},
      │             │           createdAt >= bishkekMorningBoundary(now)}  ≥ CAP ?  suppress push
      │             ├─ Notification.create({ ..., pushSuppressed })   [ALWAYS — in-app uncapped]
      │             └─ if !suppressed → fcm.send({ uid, titleKey:'new_listing', data:{deeplink:'carex://search'} })
      │                                          │
      │                                          ▼
      │                              DeviceToken.find({uid}) → renderGenericPush → sendEachForMulticast
      │                                          (bounded retry + dead-token prune, never throws)
      ▼
   return [...writtenSavedSearch, ...writtenBroadcast]
```

### Recommended Project Structure

No new files on the backend. Changes are surgical edits to existing files:

```
backend-services/carEx-services/
├── src/notifications/notificationService.js   # ADD broadcast branch + {uid} target shape + cap helper
├── src/notifications/translations.js          # ADD push_new_listing + new_listing (in-app) RU+EN
├── src/models/User.js                         # ADD notificationPrefs.newListingEnabled (default true)
├── src/models/Notification.js                 # ADD pushSuppressed boolean (default false)
├── server.js                                  # FIX PUT /api/users/:uid to persist notificationPrefs
└── src/notifications/__tests__/               # ADD broadcast.test.js (audience/dedup/cap/guards)

carEx/  (mobile)
├── src/screens/NotificationSettingsScreen.tsx # ADD "New Listings" toggle (near-copy of watch toggle)
└── src/constants/translations.ts              # ADD categoryNewListings RU+EN label
```

### Pattern 1: After-commit, off-hot-path emit (PRESERVE — do not move broadcast onto the request path)

**What:** The `new_listing` emit fires AFTER `newCar.save()`, wrapped in a try/catch that logs `[notify] new_listing emit failed` and never throws into the 201 response.
**When to use:** The broadcast fan-out rides this exact site — no new trigger, no new endpoint.
**Why it matters for Phase 15:** The recipient query (`DeviceToken.distinct` + `User.find`) and the per-recipient write loop run here, off the create response. The SPEC's "not O(N) on the hot request path" constraint is *already satisfied* by riding this hook. Do NOT `await` the broadcast in a way that blocks the response — it already doesn't (the response is sent independent of emit completion in practice, though emit is awaited before `res` today; the try/catch isolation is the safety net).

```javascript
// Source: server.js:908-921 (existing — broadcast rides this unchanged)
try {
  await notificationService.emit({
    type: 'new_listing',
    carId: newCar._id.toString(),
    actorUid: sellerId || req.auth?.uid,
  });
} catch (notifyErr) {
  console.error('[notify] new_listing emit failed:', notifyErr);
}
```

### Pattern 2: Guard-order-preserving broadcast branch inside emit() (the {uid} target descriptor)

**What:** The existing guard sequence is `(a) hide-hook re-read → (b) resolve targets → (c) actor-exclude → (d) price-direction → (e) dedup`. The broadcast branch slots in AFTER the saved-search pass, reusing the same hide-hook'd `visible` Car, and introduces a `{ uid }`-shaped target so the existing actor-exclude/dedup reads work for both shapes.
**When to use:** Adding the broadcast audience without breaking the saved-search/watch paths.

**The blast radius — exact lines that assume `t.sub.uid`:**
```javascript
// Source: notificationService.js — these reads must widen to (t.uid || t.sub?.uid):
// line 174 (actor-exclude):
const filtered = targets.filter((t) => t.sub && t.sub.uid && t.sub.uid !== event.actorUid);
// line 180 (uid extraction in write loop):
const uid = target.sub.uid;
// line 198 (cadence — broadcast has no sub, default 'instant'):
const cadence = target.sub.cadence || 'instant';
// line 204 (kind — broadcast has no sub.kind, supply a literal):
kind: target.sub.kind,
```
Recommended widening (preserves both paths):
```javascript
const uidOf = (t) => t.uid || (t.sub && t.sub.uid);   // accepts both shapes
const filtered = targets.filter((t) => uidOf(t) && uidOf(t) !== event.actorUid);
// ...inside loop:
const uid = uidOf(target);
const cadence = (target.sub && target.sub.cadence) || 'instant';
kind: (target.sub && target.sub.kind) || 'new_listing',  // broadcast kind literal
```

**The saved-search-wins dedup set is free:** the saved-search pass already produced `written` rows (each has a `uid`). Build `const ssUids = new Set(writtenSavedSearch.map(r => r.uid))` and exclude those uids from the broadcast audience — no extra query. (Note: a uid is in `ssUids` only if a `new_match` row was *written* this cycle, i.e. not itself deduped-away. If a prior unread `new_match` row already existed for this car, that uid was `continue`d and won't be in `written` — so also OR in a check against existing `new_match` rows for this carId if you want to suppress broadcasts for users with a *pre-existing* unread match. For a same-cycle listing this is moot since the car is brand-new, but document the choice.)

### Pattern 3: Recipient resolution from DeviceToken distinct-uids (NOT Subscription, NOT full User scan)

**What:** Audience = distinct uids that have a device token, intersected with the pref filter.
**Why:** D-02 makes `DeviceToken` the source of truth — a user with no token gets nothing. `DeviceToken` is indexed on `uid` (`DeviceToken.js:23`).

```javascript
// Source: pattern grounded in DeviceToken.js:23 (uid index) + User.js:25-34 (notificationPrefs)
const tokenUids = await DeviceToken.distinct('uid');            // uid-indexed
if (!tokenUids.length) return writtenSavedSearch;               // nobody to broadcast to
// Pref filter — $ne:false treats legacy docs (no newListingEnabled field) as ENABLED (Open Q5)
const eligible = await User.find({
  firebaseUid: { $in: tokenUids },
  'notificationPrefs.muteAll': { $ne: true },
  'notificationPrefs.newListingEnabled': { $ne: false },
}).select('firebaseUid language').lean();
```

### Pattern 4: Daily-cap counted via pushSuppressed + Asia/Bishkek boundary

**What:** "Broadcast pushes sent today" = broadcast rows for this uid since the local morning boundary where `pushSuppressed !== true`. Reuse the digest's 08:00 Asia/Bishkek `DIGEST_HOUR` clock so cap-reset and digest share one boundary (D-04).

```javascript
// Source: digest.js:48 (DIGEST_HOUR=8) + server.js:1534 (timezone Asia/Bishkek)
// Compute the most-recent 08:00 Asia/Bishkek instant <= now. Bishkek is UTC+6, no DST.
// (Asia/Bishkek has had a fixed +06:00 offset since 2005 — no DST transitions to handle.)
const BROADCAST_DAILY_CAP = 5;            // D-04 — dedicated budget, NOT the shared dailyCap pref
function bishkekMorningBoundary(now) {
  const BISHKEK_OFFSET_MIN = 6 * 60;      // fixed +06:00
  const local = new Date(now.getTime() + BISHKEK_OFFSET_MIN * 60000);
  local.setUTCHours(DIGEST_HOUR, 0, 0, 0);          // 08:00 local
  let boundaryUtcMs = local.getTime() - BISHKEK_OFFSET_MIN * 60000;
  if (boundaryUtcMs > now.getTime()) boundaryUtcMs -= 24 * 60 * 60000; // before 08:00 → yesterday's
  return new Date(boundaryUtcMs);
}
// per-uid cap check (in the broadcast write loop):
const sentToday = await Notification.countDocuments({
  uid,
  dedupeKey: { $regex: ':new_listing_broadcast$' },   // or kind:'new_listing' + a flag — see Open Q1
  pushSuppressed: { $ne: true },
  createdAt: { $gte: bishkekMorningBoundary(now) },
});
const suppress = sentToday >= BROADCAST_DAILY_CAP;
```
**Note on the count query:** prefer counting by an explicit broadcast marker (a dedicated `kind` like `'new_listing'` plus `pushSuppressed`) over a `$regex` on `dedupeKey` (regex isn't index-friendly). A `{ uid, kind, createdAt }` compound index or filtering by `kind` then `createdAt` keeps it cheap; the audience is small per-listing and this runs off the hot path regardless.

### Pattern 5: Generic PII-free push copy (translations.js push_* + parity test)

**What:** Add a `push_new_listing` entry (category title + one canonical generic body, zero `{param}` tokens) to BOTH RU and EN blocks, plus an in-app `new_listing` entry if the in-app row renders different copy than `new_match`. The existing `renderGenericPush('new_listing', lang)` (auto-prefixes `push_`) then works unchanged.
**When to use:** Required by req 7 / D-08.

```javascript
// Source: translations.js:58-62 (existing push_* pattern) — ADD alongside:
// RU block:
push_new_listing: { title: 'Новые объявления', body: 'Появились новые авто. Откройте, чтобы посмотреть.' },
// EN block (parity — equal key set, no {param} tokens):
push_new_listing: { title: 'New listings', body: 'New cars just landed. Open to take a look.' },
```
The parity test (`__tests__/notification-translations-parity.test.js` + `push-copy-parity.test.js`) will FAIL the build if RU/EN key sets differ or a `{param}` token sneaks in — this is a free guard, not extra work.

### Anti-Patterns to Avoid
- **Adding a `kind: 'broadcast'` Subscription** — explicitly forbidden (D-02/CONTEXT). Recipients come from `DeviceToken`, not `Subscription`. The `kindEnum` stays `['saved_search','watch']`.
- **Counting "rows created today" as "pushes sent today"** — D-06 writes the in-app row even when the push is suppressed; equating them double-counts and prematurely caps users. The `pushSuppressed` marker is mandatory.
- **Reusing `dailyCap` pref value as the broadcast budget** — D-05 chose a dedicated budget; the shared pref defaults to 3 and is consumed conceptually by saved-search/watch. Use `BROADCAST_DAILY_CAP = 5`.
- **Adding a hide-hook bypass flag to `Car.findById` in `notificationService.js`** — grep-gated, security-critical (see HARD CONSTRAINT).
- **Computing the audience client-side or trusting a mobile `isEnabled`** — recipient resolution is server-authoritative.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-uid push fan-out, retry, dead-token prune | A new multicast loop | `fcm.send({ uid, titleKey, data })` | Already does DeviceToken pull, generic copy, bounded jittered backoff, prune, never-throws (`fcm.js`) |
| Recipient token lookup | A custom token aggregation | `DeviceToken.distinct('uid')` | uid-indexed; `distinct` returns the exact source-of-truth set (D-02) |
| Daily-cap reset job | A cron that zeroes counters at midnight | A date-bounded `countDocuments` against `bishkekMorningBoundary(now)` | A query that filters by `createdAt >= boundary` self-resets — no reset job, no counter doc to drift |
| Asia/Bishkek morning boundary | A new TZ calc with a TZ lib | Reuse `DIGEST_HOUR` (8) + fixed +06:00 (no DST) | The digest already pins 08:00 Asia/Bishkek; share the constant so behavior is consistent (D-04) |
| RU/EN parity + PII enforcement | A manual copy review | The existing parity + push-copy tests | They fail the build on key drift or any `{param}` token in push copy |
| Saved-search-wins dedup set | A second matchSavedSearches call | The `written` rows from the saved-search pass in the same emit() | Those uids already got `new_match` — reuse, no extra query |

**Key insight:** This phase is 90% wiring existing, tested collaborators together in a new branch. The only genuinely new logic is (a) the audience query, (b) the cap count, and (c) one new pref field + its persistence fix. Resist building anything that already exists in `fcm.js`/`digest.js`/`translations.js`.

## Runtime State Inventory

> This is an additive feature, not a rename/refactor. No string is being renamed across stored data. The inventory below is included because the phase adds a new persisted field and a new eventType that interact with existing stored rows.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `User` docs have NO `newListingEnabled` field. Existing `Notification` docs have NO `pushSuppressed` field. | None — both are additive with defaults. Recipient query MUST use `$ne: false` (not `=== true`) so legacy User docs read as enabled (Open Q5). Cap count treats missing `pushSuppressed` as "not suppressed" (`$ne: true`). No data migration. |
| Live service config | None — no external service stores this string. | None. |
| OS-registered state | The digest cron (`daily-digest`, Asia/Bishkek) is registered at `server.js:1524`. The cap-reset reuses its boundary CONSTANT but registers NO new cron. | None — no new OS-registered job. |
| Secrets/env vars | None — no new keys (CLAUDE.md secrets-hygiene constraint). | None. |
| Build artifacts | None — no package rename, no new dependency. | None. |

**Latent state bug surfaced (not strictly "runtime state" but plan-critical):** `notificationPrefs` is currently NOT persisted by `PUT /api/users/:uid` (`server.js:542` allowlist omits it). Existing `savedSearchEnabled`/`watchEnabled` toggle writes are silently dropped today. Phase 15 must add `notificationPrefs` to that handler to make `newListingEnabled` (and retroactively the existing toggles) persist. Verify whether the planner treats fixing the existing toggles as in-scope or just adds `newListingEnabled` to the merge — recommend persisting the whole `notificationPrefs` sub-object (validated) so all three toggles work.

## Common Pitfalls

### Pitfall 1: `notificationPrefs` silently dropped on save
**What goes wrong:** The new "New Listings" toggle appears to work in the UI (optimistic local state) but never persists — the next `getBackendUser` merge resets it, and the backend recipient filter never sees the user's choice.
**Why it happens:** `PUT /api/users/:uid` (`server.js:542-563`) only reads `firstName/lastName/phoneNumber/telegramUsername/avatarUrl/language` from the body. `notificationPrefs` sent by `AuthService.updateBackendUser` is ignored.
**How to avoid:** Add `notificationPrefs` to the handler's update construction (validate the sub-object — only persist known keys: `muteAll/savedSearchEnabled/watchEnabled/newListingEnabled/quietHours/dailyCap` — to avoid arbitrary-field injection, consistent with the `.strict()` discipline elsewhere).
**Warning signs:** Toggle reverts after backgrounding the app / re-fetching the user; backend `User` docs never show `newListingEnabled: false`.
`[VERIFIED: server.js:542-563 + AuthService.ts:167 + NotificationSettingsScreen.tsx:193-209]`

### Pitfall 2: Cap counts rows, not pushes (premature capping)
**What goes wrong:** Heavy listing days cap a user after 5 *rows* even though only 2 actually pushed (3 were suppressed for other reasons), or — worse — the in-app rows count toward the budget so the user stops getting *any* push much earlier than intended.
**Why it happens:** D-06 writes the in-app row even when the push is suppressed; naive `countDocuments` on broadcast rows over-counts.
**How to avoid:** Count ONLY rows where `pushSuppressed !== true`. The marker is written at create time based on the cap decision.
**Warning signs:** Users hit cap faster than `BROADCAST_DAILY_CAP` listings/day.

### Pitfall 3: Broadcast/`new_match` dedupeKey collision
**What goes wrong:** A user with a matching saved search gets the broadcast deduped-away (or vice-versa) because both rows share a dedupeKey, or the broadcast suppresses a legitimate `new_match`.
**Why it happens:** `new_match` rows use `dedupeKey = ${carId}:new_match` (built from the closure `carId` = `event.carId`, even though `data.carId` is `null`). A broadcast reusing `new_match` as its eventType would collide.
**How to avoid:** Use a distinct `new_listing_broadcast` eventType → `${carId}:new_listing_broadcast`. Confirmed non-colliding with `${carId}:new_match`.
**Warning signs:** A saved-search user mysteriously loses their `new_match`, or a broadcast row never writes for a user who has no saved search. `[VERIFIED: notificationService.js:103,182 + dedup.test.js:65]`

### Pitfall 4: Actor not excluded from the broadcast audience
**What goes wrong:** The seller gets a broadcast push for their own listing (violates req 6 / acceptance criteria).
**Why it happens:** The actor-exclude at `notificationService.js:174` reads `t.sub.uid` — a `{ uid }`-shaped broadcast target has no `t.sub`, so the existing filter would `t.sub && ...` evaluate falsy and *drop the target entirely* (silent under-delivery) rather than passing it through. Either way the widening (`t.uid || t.sub?.uid`) is required for correctness, AND the actor compare must apply to the broadcast audience.
**How to avoid:** Exclude `event.actorUid` from `tokenUids`/`eligible` directly in the audience build, and use the widened `uidOf` reader (Pattern 2).
**Warning signs:** Seller receives their own new-listing push; or broadcast delivers to nobody (the `t.sub &&` short-circuit).

### Pitfall 5: ObjectId vs string identity for uids
**What goes wrong:** A uid mismatch causes the saved-search-wins exclusion or actor-exclude to miss.
**Why it happens:** uids are Firebase UID strings everywhere (`DeviceToken.uid`, `User.firebaseUid`, `Subscription.uid`, `Notification.uid`, `event.actorUid` all String). This is consistent — but `User._id` is an ObjectId; never key off `User._id`, always `firebaseUid`.
**How to avoid:** Use `firebaseUid` as the join key end-to-end (the digest already does: `User.findOne({ firebaseUid: uid })`, `digest.js:114`).
**Warning signs:** Exclusion sets never match; everyone (including actor / saved-search users) gets a broadcast.

### Pitfall 6: Listing hidden between create and send still broadcasts
**What goes wrong:** A listing suspended/sold microseconds after creation still fans out a broadcast.
**Why it happens:** Forgetting that the broadcast branch must sit AFTER the `Car.findById(carId)` hide-hook re-read (line 167-168) and reuse that `visible` doc — not re-fetch with a bypass.
**How to avoid:** Place the broadcast branch after the existing `if (!visible || visible.status !== 'active') return [];` guard; reuse `visible`. The grep gate (`guards.test.js:83`) already asserts zero bypass flags appear in the file — extend that test to cover the broadcast branch.
**Warning signs:** Broadcasts for non-active listings; grep gate fails. `[VERIFIED: notificationService.js:165-168 + guards.test.js:83-90]`

## Code Examples

### Code Example 1: Broadcast branch skeleton inside emit() (after saved-search pass)
```javascript
// Source: composed from notificationService.js:149-219 (existing emit) + DeviceToken.js + User.js
// Slots in AFTER the existing saved-search write loop, BEFORE `return written;`.
// `visible` is the already-hide-hook'd Car from line 167. `written` holds the saved-search rows.

if (eventType === 'new_listing') {
  const DeviceToken = deps.DeviceToken || mongoose.model('DeviceToken');
  const User = deps.User || mongoose.model('User');
  const now = event.now || new Date();              // injectable for tests

  // saved-search-wins exclusion set (uids that just got new_match this cycle)
  const ssUids = new Set(written.map((r) => r.uid));

  // audience: token-holders, pref-eligible, actor-excluded, ss-excluded
  const tokenUids = await resolveQuery(DeviceToken.distinct('uid'));
  const candidateUids = (tokenUids || []).filter(
    (u) => u !== event.actorUid && !ssUids.has(u),
  );
  if (candidateUids.length) {
    const eligible = await resolveQuery(User.find({
      firebaseUid: { $in: candidateUids },
      'notificationPrefs.muteAll': { $ne: true },
      'notificationPrefs.newListingEnabled': { $ne: false },   // legacy docs = enabled
    }).select('firebaseUid'));

    const bcDedupeKey = `${carId}:new_listing_broadcast`;
    const data = { deeplink: 'carex://search', carId: null, searchId: null };

    for (const u of (eligible || [])) {
      const uid = u.firebaseUid;
      // dedup: one unread broadcast per (uid, carId)
      const dup = await resolveQuery(Notification.findOne({ uid, dedupeKey: bcDedupeKey, read: false }));
      if (dup) continue;

      // cap: count today's SENT broadcast pushes for this uid
      const sentToday = await Notification.countDocuments({
        uid, kind: 'new_listing', pushSuppressed: { $ne: true },
        createdAt: { $gte: bishkekMorningBoundary(now) },
      });
      const suppress = sentToday >= BROADCAST_DAILY_CAP;

      const [row] = await Notification.create([{
        uid,
        kind: 'new_listing',
        titleKey: 'new_listing',
        bodyKey: 'new_listing',
        params: {},                     // PII-free — no makeModel/price in broadcast
        data,
        dedupeKey: bcDedupeKey,
        pushSuppressed: suppress,       // NEW field — drives the cap count
        digestPending: false,
      }]);

      if (!suppress) {
        await fcm.send({ uid, titleKey: 'new_listing', data });   // renderGenericPush('new_listing')
      }
      written.push(row);
    }
  }
}
```

### Code Example 2: User model field (additive, default-on)
```javascript
// Source: User.js:25-34 — ADD inside notificationPrefs:
notificationPrefs: {
  muteAll: { type: Boolean, default: false },
  savedSearchEnabled: { type: Boolean, default: true },
  watchEnabled: { type: Boolean, default: true },
  newListingEnabled: { type: Boolean, default: true },   // NEW (D-11, default ON / opt-out)
  quietHours: { start: { type: String, default: '22:00' }, end: { type: String, default: '08:00' } },
  dailyCap: { type: Number, default: 3 },                // NOTE: 3, not 5 — broadcast uses its own constant
},
```

### Code Example 3: PUT /api/users/:uid prefs persistence fix
```javascript
// Source: server.js:544-552 — ADD to the allowlist:
const { firstName, lastName, phoneNumber, telegramUsername, avatarUrl, language,
        notificationPrefs } = req.body;
// ...existing field assignments...
if (notificationPrefs && typeof notificationPrefs === 'object') {
  const np = {};
  const bool = (v) => typeof v === 'boolean';
  if (bool(notificationPrefs.muteAll)) np['notificationPrefs.muteAll'] = notificationPrefs.muteAll;
  if (bool(notificationPrefs.savedSearchEnabled)) np['notificationPrefs.savedSearchEnabled'] = notificationPrefs.savedSearchEnabled;
  if (bool(notificationPrefs.watchEnabled)) np['notificationPrefs.watchEnabled'] = notificationPrefs.watchEnabled;
  if (bool(notificationPrefs.newListingEnabled)) np['notificationPrefs.newListingEnabled'] = notificationPrefs.newListingEnabled;
  if (typeof notificationPrefs.dailyCap === 'number') np['notificationPrefs.dailyCap'] = notificationPrefs.dailyCap;
  // quietHours: nested — persist start/end if present
  Object.assign(update, np);
}
// NOTE: use dot-path $set keys so a partial prefs patch never clobbers sibling fields.
```

### Code Example 4: Mobile toggle (near-copy of the watch toggle)
```typescript
// Source: NotificationSettingsScreen.tsx:104-106,227-233,407-415 — ADD parallel state + handler + row:
const [newListingEnabled, setNewListingEnabled] = useState<boolean>(prefs.newListingEnabled ?? true);
const onToggleNewListing = useCallback((value: boolean) => {
  setNewListingEnabled(value);
  persistPrefs({ newListingEnabled: value });
}, [persistPrefs]);
// In the per-category group, after the Watched-cars row:
<View style={styles.toggleRow}>
  <Text style={styles.toggleLabel}>{t.categoryNewListings}</Text>
  <Switch value={newListingEnabled} disabled={muteAll} onValueChange={onToggleNewListing}
    trackColor={{ false: COLORS.border, true: COLORS.accent }} />
</View>
// translations.ts: RU categoryNewListings: 'Новые объявления'  /  EN: 'New listings'
// Also extend the local NotificationPrefs interface with newListingEnabled?: boolean.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Notification backend on feature branches | Phases 12–14 MERGED to backend `main` | Confirmed 2026-06-10 | The MEMORY note "notification backend lives unmerged on feature branches" is STALE for the backend. Plan against backend `main` (clean tree, last commit `b749877`). The MOBILE notification work (`NotificationSettingsScreen`, `NotificationContext`) is present on the carEx `main` working tree too. |

**Deprecated/outdated:**
- MEMORY `notifications_branch_topology.md` ("v1.2 Phase 12/13 backend lives unmerged on `feat/fcm-push-transport`") — **no longer accurate for the backend**: `main` has `notificationService.js`, `fcm.js`, `digest.js`, the `new_listing` emit, and the registered digest cron. `feat/fcm-push-transport` still exists but `main` is now the correct base. Flag this to update the memory note. `[VERIFIED: git branch + git log + file mtimes 2026-06-10]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The SPEC/CONTEXT "cap = 5" is a NEW dedicated `BROADCAST_DAILY_CAP` constant, distinct from `User.notificationPrefs.dailyCap` (which defaults to 3). | Stack / Pattern 4 / D-05 | If the product actually wants the per-user `dailyCap` pref to drive the broadcast budget, the constant approach ignores user-set cap values. D-05 text supports the dedicated-budget reading, but the "5 vs 3" mismatch should be confirmed with the user before locking. |
| A2 | Asia/Bishkek has a fixed +06:00 offset with no DST (so the boundary calc can hardcode +360 min). | Pattern 4 | If a TZ lib is preferred for safety, the hardcoded offset is brittle. Bishkek dropped DST in 2005 — low real risk, but a planner may prefer `Intl`/`luxon`-free date math anyway (no new lib per constraint). |
| A3 | "Saved-search wins" is satisfied by excluding uids whose `new_match` row was WRITTEN this cycle (`written` set), and a pre-existing unread `new_match` for a brand-new car cannot occur (the car is new). | Pattern 2 | If a re-emit ever fires for an existing car (out of scope per D-10, but defensively), a user with a stale unread `new_match` could still get a broadcast. Document the chosen exclusion source. |
| A4 | The in-app broadcast row should render distinct copy from `new_match` (hence a new in-app `new_listing` key), OR reuse generic push copy for the in-app body. | Pattern 5 | If the in-app feed must show richer copy, the row needs an in-app `new_listing` entry with appropriate (still PII-bounded) text. The render key is the planner's to confirm; push copy is locked generic by D-08. |
| A5 | Fixing `PUT /api/users/:uid` to persist `notificationPrefs` is in-scope (required for req 5/D-11 to function). | Pitfall 1 | If the planner scopes only `newListingEnabled` into a different write path, the existing toggles stay broken. Recommend confirming the prefs-persistence fix is accepted as in-scope. |

## Open Questions

1. **Cap-counting representation (RESOLVED — recommend `pushSuppressed` on the row).**
   - What we know: D-06 writes the in-app row even when the push is suppressed, so rows-created ≠ pushes-sent. The `Notification` model is the natural home; `{uid, createdAt}` is already indexed.
   - What's unclear: whether to count by `kind:'new_listing'` + `pushSuppressed:{$ne:true}` + `createdAt>=boundary` (recommended — no new collection, self-resetting) vs. a separate per-user daily-counter doc (needs a reset job + write contention).
   - Recommendation: add `pushSuppressed: { type: Boolean, default: false }` to `Notification.js`; count with `countDocuments({ uid, kind:'new_listing', pushSuppressed:{$ne:true}, createdAt:{$gte: bishkekMorningBoundary(now)} })`. Add a `{ uid: 1, kind: 1, createdAt: -1 }` index if profiling warrants (the `{uid, createdAt}` index already partially serves it).

2. **Broadcast target shape (RESOLVED — `{ uid }` descriptor + widened reads).**
   - Recommendation: introduce `{ uid }` targets in the broadcast branch and widen the 4 `t.sub.uid`/`target.sub.*` reads (lines 174, 180, 198, 204) via a `uidOf()` helper + literal fallbacks for `cadence`/`kind`. Preserves guard order; one tested write loop. Alternative (parallel branch) is acceptable but duplicates the dedup/create/fcm sequence.

3. **eventType + dedupeKey (RESOLVED — `new_listing_broadcast`).**
   - `new_match` dedupeKey = `${carId}:new_match` (built from `event.carId`, `notificationService.js:182`). Broadcast = `${carId}:new_listing_broadcast` — cannot collide. eventTypes are not enforced by a backend enum at the emit layer (`KEYS_BY_EVENT` map + `WATCH_EVENTS` array gate behavior; `schemas.js` enums only validate *subscription request bodies*, not emit events). So no enum edit is required to add the broadcast eventType — but add a `KEYS_BY_EVENT['new_listing_broadcast']` (or handle the in-app key directly) for clarity.

4. **Recipient query performance (RESOLVED — distinct + indexed pref filter, off hot path).**
   - `DeviceToken.distinct('uid')` uses the `{uid:1}` index. The `User.find({ firebaseUid: {$in}, ... })` filter benefits from the existing `firebaseUid` unique index; the `notificationPrefs.*` clauses are low-selectivity but the `$in` on `firebaseUid` already narrows to token-holders. An index on `notificationPrefs.newListingEnabled` is NOT warranted (low cardinality, query already narrowed by `$in`). Runs after-commit, never on the create response.

5. **muteAll + newListingEnabled + legacy-doc semantics (RESOLVED — use `$ne`).**
   - Existing `User` docs predate `newListingEnabled`, so the field is ABSENT (Mongoose `default: true` only applies to NEW docs / on save, not to existing stored docs at query time). A `{ newListingEnabled: true }` filter would MISS every legacy doc. Use `{ 'notificationPrefs.newListingEnabled': { $ne: false } }` and `{ 'notificationPrefs.muteAll': { $ne: true } }` so absent-field docs are treated as enabled/unmuted (default-on semantics). This is the load-bearing query detail for req 5's "never-touched = enabled."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Backend repo (`carEx-services`) at sibling path | All backend changes | ✓ | branch `main`, clean tree | — |
| mongoose | Models + queries | ✓ | ^9.1.5 | — |
| firebase-admin | `fcm.send` push | ✓ | ^13.8.0 | — |
| node-cron | digest boundary reference | ✓ | ^4.2.1 | — |
| Jest (backend) | Backend tests | ✓ | (preset, `npm test`) | — |
| Jest (mobile) | Toggle test | ✓ | 29.6.3 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None. The phase adds zero dependencies on either repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | Jest, `testEnvironment: node`, `testTimeout: 30000` |
| Config file (backend) | `package.json` `"jest"` block (no separate config) |
| Quick run (backend) | `npx jest src/notifications/__tests__/broadcast.test.js` |
| Full suite (backend) | `npm test` (from `carEx-services`) |
| Framework (mobile) | Jest react-native preset |
| Quick run (mobile) | `npx jest src/screens/__tests__/NotificationSettingsScreen` (or relevant) |
| Full suite (mobile) | `npm test` (from `carEx`) |

**Existing notification tests to mirror:** `guards.test.js` (hide-hook + grep gate), `dedup.test.js` (dedupeKey shape), `actorExclusion.test.js`, `deviceTokens.test.js`, `digest.test.js`, `notification-translations-parity.test.js`, `push-copy-parity.test.js`. The broadcast tests should follow `guards.test.js`'s dependency-injection style (`emit(event, { Car, Notification, DeviceToken, User, fcm, matchSavedSearches })` with stubs — no live DB).

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| 1 | Audience = token-holders minus actor; actor never in set | unit | `npx jest src/notifications/__tests__/broadcast.test.js -t "audience excludes actor"` | ❌ Wave 0 |
| 2 | Saved-search-matched uid gets new_match only, not broadcast | unit | `... -t "saved-search wins dedup"` | ❌ Wave 0 |
| 3 | Each eligible non-capped recipient → 1 row + 1 fcm.send | unit | `... -t "row + push per recipient"` | ❌ Wave 0 |
| 4 | At cap → row written with pushSuppressed:true, no fcm.send | unit | `... -t "over cap suppresses push not row"` | ❌ Wave 0 |
| 4 | Cap resets at Asia/Bishkek morning boundary | unit | `... -t "cap counts since bishkek boundary"` | ❌ Wave 0 |
| 5 | newListingEnabled:false → no row, no push; absent field → enabled | unit | `... -t "opt-out suppresses; legacy doc enabled"` | ❌ Wave 0 |
| 5 | PUT /api/users persists notificationPrefs | unit/integration | `npx jest ... -t "persists notificationPrefs"` (router or server test) | ❌ Wave 0 |
| 6 | Hidden/non-active car → 0 broadcast rows/pushes | unit | reuse/extend `guards.test.js` | ⚠ extend existing |
| 6 | No bypass flag appears in broadcast branch source | grep gate | extend `guards.test.js:83` assertion to cover broadcast | ⚠ extend existing |
| 7 | push_new_listing RU/EN parity, no {param} token | unit | `npx jest __tests__/push-copy-parity.test.js` | ✓ existing (auto-covers new key) |
| 3/7 | dedupeKey `${carId}:new_listing_broadcast` ≠ new_match | unit | `... -t "broadcast dedupeKey no collision"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest src/notifications/__tests__/broadcast.test.js` (+ the parity tests if `translations.js` touched).
- **Per wave merge (backend):** `npm test` in `carEx-services`.
- **Per wave merge (mobile):** `npm test` + `npm run lint` in `carEx`.
- **Phase gate:** Both full suites green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/notifications/__tests__/broadcast.test.js` — covers reqs 1–5, dedupeKey isolation (DI-style, no DB).
- [ ] Extend `src/notifications/__tests__/guards.test.js` — assert the broadcast branch also uses the plain `Car.findById` and that the grep gate still passes with the new branch present (req 6).
- [ ] Extend `push-copy-parity.test.js` coverage is automatic (it scans all `push_*` keys) — just confirm it includes `push_new_listing`.
- [ ] Backend handler test for `PUT /api/users/:uid` persisting `notificationPrefs` (new — no existing server-level handler test for prefs).
- [ ] Mobile: a render/persist test for the new toggle calling `AuthService.updateBackendUser({ notificationPrefs: { newListingEnabled } })` (mirror existing toggle test if one exists; otherwise minimal).

## Security Domain

`security_enforcement` is not explicitly disabled in config — included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface; device-token/prefs writes already behind `verifyIdToken` |
| V3 Session Management | no | Unchanged |
| V4 Access Control (IDOR) | yes | `uid` for device-token/prefs writes MUST come from `req.auth.uid`, never the body (already enforced, `router.js:312`). The prefs-persistence fix MUST key the update on `req.params.uid` and validate the caller — preserve the existing pattern; do NOT trust a body `uid`/`firebaseUid`. |
| V5 Input Validation | yes | The new `notificationPrefs` persistence must allowlist known keys + type-check (booleans/number) so an attacker can't inject arbitrary fields into the User doc (use the `.strict()`-equivalent discipline; see Code Example 3). |
| V6 Cryptography | no | None |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mass-assignment into `User` doc via unfiltered `notificationPrefs` | Tampering | Allowlist + type-check each pref key in `PUT /api/users/:uid` (Code Example 3) |
| Self-notify / actor leak | Information disclosure | Actor exclusion on the broadcast audience (req 6, Pitfall 4) |
| TOCTOU: hidden listing broadcast | Tampering / disclosure | Plain `Car.findById` hide-hook re-read at send time, NO bypass flags — grep-gated (HARD CONSTRAINT) |
| PII on lock screen | Information disclosure | Generic param-free `push_new_listing` copy; parity test bans `{param}` tokens (req 7) |
| Cap-bypass spam | DoS (to user) | Server-side cap count by `pushSuppressed` since Bishkek boundary; never trust client |

### ⚠ HARD CONSTRAINT (grep-gated, security-critical)
NEVER add a hide-hook bypass flag (`includeAllUsers` / `includeAllListingStatuses`) to the `Car.findById` re-read in `notificationService.js`. The broadcast path MUST re-read the Car at send time with NO bypass flags. The existing grep gate (`guards.test.js:83-90`) asserts `/\{\s*includeAll(Users|ListingStatuses)/` never matches the source — keep it green and ensure the broadcast branch reuses the already-hide-hook'd `visible` Car rather than re-fetching. `[VERIFIED: notificationService.js:5-21,165-168 + Car.js:64-121 + guards.test.js:83-90]`

## Sources

### Primary (HIGH confidence — read directly this session)
- `backend-services/carEx-services/src/notifications/notificationService.js` — emit() guard order, `t.sub.uid` reads (174/180/198/204), dedupeKey (182), KEYS_BY_EVENT, buildSearchDeeplink
- `backend-services/carEx-services/src/notifications/push/fcm.js` — `send({uid,titleKey,data})`, DeviceToken fan-out, renderGenericPush, retry/prune/never-throw
- `backend-services/carEx-services/src/models/DeviceToken.js` — `{uid, token(unique), platform}`, `{uid:1}` index
- `backend-services/carEx-services/src/models/User.js` — `notificationPrefs` shape, `dailyCap` default **3**, `firebaseUid` join key
- `backend-services/carEx-services/src/models/Notification.js` — row shape, dedupeKey String, `{uid,createdAt}` index, no `pushSuppressed` yet
- `backend-services/carEx-services/src/models/Car.js` — `status` enum, the two `pre(/^find/)` hide-hooks, bypass flag names
- `backend-services/carEx-services/src/notifications/translations.js` — `push_*` + in-app key pattern, parity contract, renderGenericPush
- `backend-services/carEx-services/src/notifications/matchSavedSearches.js` — saved-search matcher output (Subscription docs)
- `backend-services/carEx-services/src/notifications/digest.js` — `DIGEST_HOUR=8`, Asia/Bishkek boundary, hide-hook discipline mirror
- `backend-services/carEx-services/src/notifications/schemas.js` — kindEnum (subscription bodies only, NOT emit events)
- `backend-services/carEx-services/src/notifications/router.js` — device-token upsert (`req.auth.uid`), NO prefs endpoint
- `backend-services/carEx-services/server.js` — new_listing emit (908-921), `PUT /api/users/:uid` allowlist (542-563, **omits notificationPrefs**), digest cron (1519-1536)
- `backend-services/carEx-services/src/notifications/__tests__/{guards,dedup}.test.js` — grep gate + dedupeKey tests
- `carEx/src/screens/NotificationSettingsScreen.tsx` — toggle pattern, `persistPrefs` → `AuthService.updateBackendUser`
- `carEx/src/services/AuthService.ts` — `updateBackendUser` PUT body pass-through
- `carEx/src/constants/translations.ts` — `categorySavedSearches/categoryWatchedCars` RU/EN keys

### Secondary (MEDIUM)
- `git branch -a` / `git log` on `carEx-services` (2026-06-10) — notification engine on `main`, not a feature branch (supersedes stale MEMORY note)

### Tertiary (LOW)
- None — no unverified web claims; everything is grounded in source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from both `package.json` files; zero new deps.
- Architecture: HIGH — broadcast branch composes existing, tested collaborators; guard order and blast radius traced line-by-line.
- Pitfalls: HIGH — `notificationPrefs` drop and `dailyCap=3` mismatch verified against source, not assumed.
- Cap mechanism / boundary / dedup: HIGH (resolved against `digest.js` + `notificationService.js`); the "5 vs 3" product intent is the one MEDIUM (A1) needing user confirmation.

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable backend on `main`; re-verify the `main` base branch and the `PUT /api/users` handler if backend ships intervening changes).
