# Phase 14: Daily Digest & Scheduling - Research

**Researched:** 2026-06-07
**Domain:** Backend scheduled worker (Node/Express + Mongoose), crash-safe batch flush, FCM digest send, i18n pluralization, retention pruning
**Confidence:** HIGH (codebase verified line-by-line; node-cron v4 API registry+docs verified)

## Summary

Phase 14 is an **almost-entirely backend** phase in the sibling repo `carEx-services`. It adds a single in-process `node-cron@4.2.1` job, registered inside `server.js`'s existing `require.main === module` block, that once per morning (08:00 Asia/Bishkek) drains the `Notification` rows flagged `digestPending: true` into one localized push per user, then prunes dead device tokens + notifications older than 90 days. All the plumbing it consumes already exists on `main`: the `digestPending` flag (written by `notificationService.emit()` when `cadence === 'daily'`), `fcm.send()`, `translations.js`, `User.language`, and `User.notificationPrefs.{quietHours,dailyCap}`.

**The single most important finding for the planner:** `fcm.send()` renders **generic, param-free** copy via `renderGenericPush()` and forwards **only** `data.deeplink` — it *ignores* any title/body params. A digest title needs `{count}` interpolated (`digest_title {count}`), which `renderGenericPush` cannot do. So Phase 14 **cannot** simply call `fcm.send({ titleKey: 'digest_title' })` and get a count. The planner must extend the send path (a new `digest_*` push key + a `count` param channel that `renderGenericPush` is taught to interpolate, OR a sibling `sendDigest()` function in `fcm.js`). This is a real fork in the design and must be resolved in the plan, not assumed away.

**Primary recommendation:** Add `node-cron@^4.2.1`; create `src/notifications/digest.js` exporting a pure, directly-callable `runDigest({ now, deps })` flush function plus a `prune()`; register the cron in `server.js`'s `require.main === module` block with `{ timezone: 'Asia/Bishkek', noOverlap: true }`; extend `fcm.js`/`translations.js` to carry the `{count}` digest title; test the flush by calling `runDigest()` directly under `MongoMemoryReplSet` and simulating a crash between send and clear.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cron schedule + fire-time | Backend (Express process) | — | In-process worker, single-instance Railway; gated by `require.main === module` |
| Atomic snapshot/claim/clear of `digestPending` | Backend (MongoDB/Mongoose) | — | Crash-safety is a DB-atomicity property on the `Notification` collection |
| One push per user + count | Backend (`fcm.js` send path) | FCM/APNs transport | Reuses Phase 13 fan-out; digest count is rendered server-side |
| RU 3-form pluralization | Backend (`translations.js`) | — | Server-rendered push copy; mobile never sees rendered text |
| 90-day notification prune | Backend (MongoDB) | — | Retention policy constant lives on `Notification` model |
| Stale device-token prune | Backend (MongoDB) | — | Extra/stale layer beyond send-time `pruneToken` |
| Hide-hook re-check at flush | Backend (`Car.findById` plain) | — | TOCTOU re-check, respect-by-omission |
| Digest tap → Notification Center | Mobile (`App.tsx` linking) | Backend (sets `data.deeplink`) | D-03 divergence from `listing/:carId`; mobile owns the route |

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Digest fires at **08:00 Asia/Bishkek**, defined as a **single named constant** (e.g. `DIGEST_HOUR = 8`). Not env-driven. Cron gated by `require.main === module` so the test suite never starts it (NDIG-01).
- **D-02 (missed-run policy):** **Roll forward to the next morning** — accept that node-cron does not catch up a fire it slept through. Safe because pending items stay `digestPending` (persisted); a missed run delivers next morning. **No on-boot catch-up.**
- **D-03 (tap routing):** Tapping the digest push opens the **in-app Notification Center**. The digest push carries a Notification-Center deeplink/route, NOT the single-listing `carex://listing/:carId`. Reuses existing nav; no new screen.
- **D-04 (RU pluralization):** `digest_title {count}` is **new** and must be added with **RU + EN parity**. RU uses proper 3-form pluralization: **1 → `машина` form, 2–4 → `машины` form, 5+/0/11–14 → `машин` form**. EN simple singular/plural. Tone matches the plain `push_*` register, NOT the UNHINGED tier.

### Claude's Discretion
- **Quiet-hours default window + soft daily-cap (2–3/day) defaults** — defaults already seeded in `User.notificationPrefs` (`quietHours {start:'22:00', end:'08:00'}`, `dailyCap: 3`). No per-user TZ field, no GPS.
- **Dead-token prune scope (NDIG-05):** `fcm.send()` already prunes FCM-rejected tokens at send time. The cron's token prune is the **extra/stale** layer — decide a non-duplicative target (e.g. tokens with no recent `lastSeenAt`).
- **Digest body copy** (line under the title) — planner discretion; a generic "Откройте, чтобы посмотреть" / "Open to take a look." in the `push_*` style is fine.
- **Cron expression / overlap guard** — single fixed daily fire; `noOverlap: true` is cheap insurance though overlap is not a real concern at single-instance scale.

### Deferred Ideas (OUT OF SCOPE)
- **Per-user timezone field (NOTF2-05)** — v2.
- **Multi-instance-safe cron advisory lock (NOTF2-06)** — v2. The single-instance assumption holds; per-id crash-safe flush is sufficient. **Do NOT design a distributed lock.**
- **On-boot / catch-up digest recovery** — rejected (D-02).
- **UNHINGED-tier branded digest copy** — deferred.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NDIG-01 | In-process `node-cron` job gated by `require.main === module` | `server.js` already has the gate (line 1508); register cron there. `node-cron@4.2.1` adds a dep. See Pattern 1. |
| NDIG-02 | Atomic snapshot (`createdAt <= runStart`) → claim → send → clear only sent ids (crash-safe) | `Notification` has `{digestPending}` index. Use a claim marker + per-id clear. See Pattern 2. |
| NDIG-03 | Daily-cadence + cap-overflow + quiet-hours items in one localized push per user (`digest_title {count}`) | `digestPending` already set by `emit()`. Group by uid; **send path needs `{count}` extension** (see Don't Hand-Roll + Pitfall 1). See Pattern 3. |
| NDIG-04 | Fixed Asia/Bishkek morning hour, no per-user TZ | node-cron `timezone: 'Asia/Bishkek'` option (v4 verified). `DIGEST_HOUR` constant. |
| NDIG-05 | Cron prunes dead device tokens + notifications older than 90 days (satisfies NDOM-06) | `Notification.NOTIFICATION_RETENTION_DAYS = 90` constant defined; `DeviceToken.lastSeenAt` field exists for stale prune. See Pattern 4. |
| NDOM-06 | 90-day notification retention (job runs here) | Policy constant on model; cron executes the prune. |

---

## Branch / Repo State (CRITICAL — discrepancy resolved)

**Ground truth (verified empirically this session):**

- The backend repo `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` is currently on branch **`main`**, working tree clean.
- **PR #10 (`feat/fcm-push-transport` → `main`) has been MERGED** — commit `df9ebb0 Merge pull request #10 from beckinfonet/feat/fcm-push-transport`.
- **All canonical notification files EXIST on `main`** (verified via `git ls-tree -r --name-only main`):
  - `src/notifications/push/fcm.js` ✓
  - `src/notifications/notificationService.js` ✓
  - `src/notifications/translations.js` ✓
  - `src/models/Notification.js` ✓ (+ `DeviceToken.js`, `Subscription.js`)
  - `__tests__/notification-translations-parity.test.js` ✓
  - Plus all `src/notifications/__tests__/*` and `src/notifications/push/fcm.test.js`.

**Resolution of the conflict:** The MEMORY.md note "v1.2 Phase 12/13 backend lives unmerged on `feat/fcm-push-transport`; main has neither" is **STALE**. It predates the PR #10 merge (and the ROADMAP/STATE record Phase 13 13-02 as "merged to backend main PR #10" on 2026-06-06). **CONTEXT.md's assertion that the files are on `main` is CORRECT.**

**Implication for the planner:**
- **Phase 14 targets `main`.** No merge of `feat/fcm-push-transport` is a prerequisite — it is already merged.
- File paths in plans are correct as written (relative to the backend repo root).
- ⚠️ Update MEMORY.md `notifications_branch_topology.md` to reflect the merge so this discrepancy does not recur.
- The local branch `feat/fcm-push-transport` still exists but is now redundant with `main`; do not branch Phase 14 work off it — branch off `main`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node-cron` | `^4.2.1` | In-process cron scheduler | Tiny, zero-dep, pure-JS; the SUMMARY-chosen scheduler; `timezone` + `noOverlap` options native in v4 |
| `firebase-admin` | `^13.8.0` (installed) | FCM send (via existing `fcm.js`) | Already present; reused, not re-added |
| `mongoose` | `^9.1.5` (installed) | Atomic `findOneAndUpdate`/`updateMany`/`deleteMany` for the flush + prune | Already present |

### Supporting (already installed — no install needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `mongodb-memory-server` | `^10.4.3` (dev) | Integration tests for the flush | Use `MongoMemoryReplSet` via `__tests__/_helpers/mongoReplSet.js` |
| `jest` | `^29.7.0` (dev) | Test runner | Existing harness; testMatch covers `**/__tests__/**/*.test.js` and `**/*.test.js` |

**Installation (backend repo):**
```bash
npm install node-cron@^4.2.1
```

**Version verification (this session):**
```
npm view node-cron version  →  4.2.1   (latest; published/modified 2026-04-24)  [VERIFIED: npm registry]
```
`node-cron` is NOT currently a dependency (verified: 0 matches in `package-lock.json`, absent from `package.json`). It must be added.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node-cron` | `croner` / `node-schedule` | No reason to deviate — SUMMARY locked node-cron; adding a different lib churns the stack for zero benefit |
| In-process cron | Separate Railway worker | Explicitly OUT OF SCOPE per REQUIREMENTS.md ("Separate Railway worker for cron — In-process node-cron is sufficient") |

---

## Architecture Patterns

### System Architecture Diagram

```
  node-cron (08:00 Asia/Bishkek, registered in server.js require.main===module)
        │  fires once/day
        ▼
  runDigest({ now: runStart })  ◄── directly callable (NO cron) for tests
        │
        ├─► 1. SNAPSHOT: find Notification { digestPending:true, createdAt <= runStart }
        │            (the {digestPending} index serves the scan)
        │
        ├─► 2. CLAIM: stamp a claim marker on the snapshot rows
        │            (digestRunId = runStart) so a crash mid-send doesn't double-claim
        │
        ├─► 3. GROUP by uid  ──►  for each uid:
        │            ├─ resolve User.language (default 'RU')
        │            ├─ hide-hook re-check per row (plain Car.findById, omit bypass) ──► drop hidden
        │            ├─ count surviving rows
        │            ├─ fcm.sendDigest({ uid, count, lang, data:{deeplink: NC route} })  ◄── ONE push
        │            └─ on send success ──► CLEAR digestPending:false ONLY for sent ids (per-id)
        │
        └─► 4. PRUNE (same run):
                   ├─ Notification.deleteMany({ createdAt < now-90d })   (NDOM-06)
                   └─ DeviceToken.deleteMany({ lastSeenAt < now-Nd })    (stale layer, NDIG-05)
                                                  ▲
                  fcm.send() already prunes FCM-REJECTED tokens at send time (pruneToken)
                  → this is the EXTRA/STALE layer, non-duplicative
```

### Recommended Project Structure (backend repo)
```
src/notifications/
├── digest.js                 # NEW — runDigest() + prune() + DIGEST_HOUR const; pure, directly callable
├── push/fcm.js               # EXTEND — add sendDigest() or {count} support
├── translations.js           # EXTEND — add digest_title (RU 3-form) + pluralizeRu helper
├── notificationService.js    # (unchanged — already writes digestPending)
└── __tests__/
    └── digest.test.js        # NEW — flush atomicity + crash sim + prune (MongoMemoryReplSet)
server.js                     # EXTEND — register cron inside require.main===module block
```

### Pattern 1: In-process cron, entrypoint-gated (NDIG-01, NDIG-04)
**What:** Register the cron only when the service runs as the entrypoint, never under Jest.
**When to use:** Always — this is the gate that keeps tests from starting a live scheduler.
**Example:**
```javascript
// server.js — inside the EXISTING require.main === module block (currently line 1508)
const cron = require('node-cron');
const { runDigest, DIGEST_HOUR } = require('./src/notifications/digest');

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  // NDIG-01/04: fixed Asia/Bishkek morning fire; DIGEST_HOUR is the single retune point.
  // node-cron v4: timezone + noOverlap are native options; recoverMissedExecutions was
  // REMOVED in v4, so "no catch-up on a slept-through fire" is the DEFAULT (satisfies D-02).
  cron.schedule(`0 ${DIGEST_HOUR} * * *`, async () => {
    try {
      await runDigest({ now: new Date() });
    } catch (err) {
      console.error('[digest] run failed:', err && err.message);
    }
  }, { name: 'daily-digest', timezone: 'Asia/Bishkek', noOverlap: true });
}
```
**Notes:**
- node-cron **v4** API: `cron.schedule(expr, task, options)`. In v4 the task **auto-starts on creation** and the callback is **async-aware** (v4 awaits the returned promise) — relevant for `noOverlap`. `[CITED: nodecron.com/scheduling-options.html]`
- `recoverMissedExecutions` does **not exist in v4** (it was a v3-era concept). A fire missed because the process was down is simply skipped → exactly D-02's roll-forward, no code needed. `[VERIFIED: nodecron.com options page — recoverMissedExecutions absent from v4 option list]`
- Wrap the whole run in try/catch so a digest failure never crashes the process.

### Pattern 2: Crash-safe atomic flush (NDIG-02 — the core risk)
**What:** snapshot → claim → send → clear-only-sent-ids, proving no double-send and no drop across a mid-run crash.
**Contract against the real `Notification` model:** rows carry `digestPending: Boolean` (indexed) and `createdAt: Date`. There is **no** claim/run field today — the planner should add one (`digestRunId` or `digestClaimedAt`) so claim is durable and distinguishable from cleared.

**Recommended atomicity primitive — claim-then-clear with a run marker:**
```javascript
// digest.js (sketch — planner finalizes)
async function runDigest({ now = new Date(), deps = {} } = {}) {
  const Notification = deps.Notification || mongoose.model('Notification');
  const runStart = now;

  // 1. SNAPSHOT + 2. CLAIM in one atomic updateMany: stamp this run's id on every
  //    pending row created on/before runStart. Idempotent — a re-run with the same
  //    runStart re-claims the same set; a NEW run (later runStart) claims leftovers
  //    from a crashed prior run too (they're still digestPending:true).
  const runId = runStart.toISOString();
  await Notification.updateMany(
    { digestPending: true, createdAt: { $lte: runStart } },
    { $set: { digestRunId: runId } }
  );

  // Read the claimed set back (grouped by uid downstream).
  const claimed = await Notification.find({
    digestPending: true, digestRunId: runId, createdAt: { $lte: runStart },
  }).lean();

  // 3. GROUP by uid → send ONE push → 4. CLEAR only the ids we successfully sent.
  const byUser = groupBy(claimed, 'uid');
  for (const [uid, rows] of byUser) {
    const survivingIds = await dropHidden(rows, deps);       // hide-hook re-check (Pattern 5)
    if (!survivingIds.length) continue;
    const { ok } = await fcm.sendDigest({ uid, count: survivingIds.length, /* lang, data */ });
    if (ok) {
      // CLEAR ONLY sent ids — per-id, after a successful send.
      await Notification.updateMany(
        { _id: { $in: survivingIds } },
        { $set: { digestPending: false }, $unset: { digestRunId: '' } }
      );
    }
    // if !ok: leave digestPending:true → next morning's run re-picks them. NO drop.
  }
}
```

**Why this is crash-safe (the proof the ROADMAP success criterion #3 wants):**
- **Crash AFTER send, BEFORE clear:** rows stay `digestPending:true`. Next run re-sends → at most a **duplicate**, never a drop. To make that duplicate impossible too, the planner *may* add a `lastDigestSentAt`/per-id `digestSent` flag set in the SAME `updateMany` that clears — but the locked contract (NDIG-02: "clear only sent ids") already guarantees **no drop**; double-send avoidance for the rare post-send-pre-clear crash is a hardening choice. **Decide explicitly in the plan.**
- **Crash AFTER claim, BEFORE send:** rows are `digestPending:true` with a stale `digestRunId`. Next run's `updateMany` re-stamps them with the new `runId` and re-sends. No drop.
- **Crash DURING the per-user loop:** users already cleared are done; users not yet reached are still `digestPending:true` → next run. No double-send for cleared users, no drop for the rest.
- **`createdAt <= runStart` snapshot bound:** rows created *after* runStart (mid-run new matches) are NOT in this batch — they belong to tomorrow's digest. Prevents an ever-growing flush and a race with concurrent `emit()`.

**Atomicity note:** `updateMany` is atomic *per document*, not across the whole batch — but that is exactly what's wanted here (per-id claim/clear). No multi-document transaction is needed; **do not** wrap this in `session.withTransaction()` (unnecessary, and the single-instance assumption already removes the cross-instance race that a lock would address). `[ASSUMED — Mongoose updateMany per-doc atomicity is standard MongoDB semantics; flag A1]`

### Pattern 3: Aggregation + one push per user (NDIG-03)
**What:** group claimed rows by `uid`, count, send exactly once.
- All three sources (daily-cadence saved searches, daily-cap overflow, quiet-hours-queued) are already unified as `digestPending:true` rows by `emit()` — the digest does NOT need to distinguish them; it just drains the flag. (Cap-overflow and quiet-hours *queuing* is Phase-12 plumbing that flips `digestPending`; Phase 14 only consumes it.)
- `User.language` resolves the render language; default `'RU'` when absent (model default).
- Group with a plain JS reduce over the `.lean()` rows; no `$group` aggregation pipeline needed at this scale.

### Pattern 4: Same-run prune (NDIG-05, NDOM-06)
**What:** after the flush, delete old notifications + stale tokens.
```javascript
// 90-day notification retention (NDOM-06). Constant already on the model.
const { NOTIFICATION_RETENTION_DAYS } = require('../models/Notification'); // = 90
const cutoff = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 864e5);
await Notification.deleteMany({ createdAt: { $lt: cutoff } });

// Stale device-token prune (the EXTRA layer beyond send-time pruneToken).
// fcm.send() already deletes FCM-REJECTED tokens; this targets tokens that simply
// went quiet — no recent lastSeenAt (DeviceToken.lastSeenAt exists, default Date.now).
const tokenStaleCutoff = new Date(now.getTime() - TOKEN_STALE_DAYS * 864e5);
await DeviceToken.deleteMany({ lastSeenAt: { $lt: tokenStaleCutoff } });
```
- **Non-duplicative target (discretion, NDIG-05):** prune on `lastSeenAt` age. Recommended `TOKEN_STALE_DAYS` ≈ 60–90 (a token not seen in 2–3 months is almost certainly a reinstalled/abandoned device; FCM would also have rejected it on the next real send anyway). ⚠️ **Caveat:** `lastSeenAt` is only meaningful if the Phase-13 register/refresh path actually updates it on each app open. The planner must **verify the device-token register route touches `lastSeenAt`** before relying on it; if it only sets it at creation, prune on `createdAt` age instead, or note the gap. `[ASSUMED — lastSeenAt freshness depends on P13 register behavior; flag A2]`

### Pattern 5: Hide-hook re-check at flush time (respect-by-omission)
**What:** before counting a row into the digest, re-read its target Car with a **plain** `Car.findById` (NO bypass flags) and drop the row if the listing is now hidden/non-active.
- This mirrors `notificationService.emit()` exactly (server.js + notificationService.js): the plain `findById` lets the Phase 3/9 `pre(/^find/)` hide-hooks apply; a hidden listing returns null/non-active → suppress.
- **NEVER** pass `setOptions({ includeAllListingStatuses: true })` / `includeAllUsers` in the digest path. A grep-gate style acceptance check (zero bypass-flag names in `digest.js`) is appropriate, matching the emit file's convention.
- Saved-search digest rows have `data.carId: null` (they deeplink to a search, not a car) — for those there is no single Car to re-check; the hide-hook re-check applies to **watch-family** rows that carry a `carId`. The planner should scope the re-check to rows with a resolvable `carId` and not error on null-carId search rows. `[ASSUMED — null-carId rows skip the per-car re-check; flag A3]`

### Anti-Patterns to Avoid
- **Calling `fcm.send({ titleKey: 'digest_title' })` expecting a count.** It renders generic param-free copy and drops all params — the count never appears. See Pitfall 1.
- **Wrapping the flush in `session.withTransaction()`.** Unneeded; per-doc `updateMany` atomicity is sufficient and a transaction adds a replica-set requirement to production for no benefit.
- **Designing an advisory lock / distributed claim.** Explicitly deferred (NOTF2-06). Single-instance assumption holds.
- **Starting the cron at module top-level.** Must be inside `require.main === module`, or Jest starts a live scheduler.
- **Passing hide-hook bypass flags in the digest Car re-read.** Breaks TOCTOU suppression.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom `setInterval` + clock math | `node-cron@4.2.1` with `timezone` option | DST-safe, cron-expression parsing, `noOverlap` built in |
| Timezone fire at 08:00 Bishkek | Manual UTC offset (`+06:00`) arithmetic | `timezone: 'Asia/Bishkek'` | Bishkek is UTC+6 with no DST today, but hard-coding an offset is fragile; the IANA name is correct-by-construction |
| FCM fan-out + token prune | New send loop | Existing `fcm.send()` / a new sibling `sendDigest()` in `fcm.js` | Reuses cached-OAuth admin, jittered backoff, dead-token prune, fan-out isolation |
| Per-user notification grouping | DB `$group` pipeline | Plain JS reduce over `.lean()` rows | Batch size is small (per-day pending); JS is simpler and testable |

**Key insight — the digest title is NOT free.** `fcm.send()` (verified, fcm.js:83-95) hard-codes the payload through `renderGenericPush(categoryKey, lang)`, which returns the static `push_*` title/body and forwards only `data.deeplink`. It **deliberately strips all params** for PII safety (Phase 13 NPUSH-08). A digest title `digest_title {count}` needs `{count}` interpolated. The planner must choose ONE:
1. **Add a `sendDigest({ uid, count, lang, data })` export in `fcm.js`** that renders a `digest_title`/`digest_body` pair with the count interpolated (count is a non-PII integer, so it is safe to put in the title) and reuses the same fan-out/prune machinery. **(Recommended — cleanest separation; the count is the only allowed param.)**
2. Generalize `renderGenericPush` to accept a whitelisted `{count}` param. (Riskier — widens the param-free guarantee that the NPUSH-08 PII test enforces.)

---

## Common Pitfalls

### Pitfall 1: The count silently vanishes from the push
**What goes wrong:** plan reuses `fcm.send({ titleKey: 'digest_title' })`; the push arrives titled with empty/no count, or `renderGenericPush` throws `Unknown generic push key: push_digest_title`.
**Why it happens:** `fcm.send` → `renderGenericPush` only knows `push_*` keys and does zero interpolation (fcm.js:89-95, translations.js:141-147).
**How to avoid:** add a dedicated digest render + a `sendDigest()` path that interpolates the integer count. Add `digest_*` keys to BOTH RU and EN (parity test will fail otherwise).
**Warning signs:** `renderGenericPush` throw in logs; the NPUSH-08 PII test or the new parity test red.

### Pitfall 2: Parity test fails the moment you add `digest_title`
**What goes wrong:** adding `digest_title` to RU only (or with a `{count}` token in RU but not EN) fails `__tests__/notification-translations-parity.test.js`.
**Why it happens:** the parity test (verified) asserts (a) RU/EN key sets are identical, (b) every leaf is a non-empty string, (c) `{param}` token sets match per key. The RU 3-form helper resolves the *form* at render time, but the **stored template** for the parity test must still have matching `{count}` tokens across RU/EN.
**How to avoid:** structure `digest_title` so RU and EN both contain a `{count}` placeholder. If RU pluralization is done by a helper picking among 3 stored sub-strings, ensure the parity flattener still sees matching tokens — likely simplest to keep ONE `digest_title` template per language with `{count}`, and apply the RU word-form via a helper that the *render* function calls (not stored as 3 separate translation keys, which would break set-equality).
**Warning signs:** "RU and EN key sets are identical" or "placeholder tokens identical per key" assertions fail.

### Pitfall 3: RU pluralization off-by-the-teens
**What goes wrong:** `11 машина` / `12 машины` (wrong) instead of `11 машин` / `12 машин`.
**Why it happens:** the 11–14 exception to the mod-10 rule is the classic Russian plural bug.
**How to avoid:** standard rule —
```javascript
function pluralizeRu(n, [one, few, many]) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;            // 1, 21, 31 → машина
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few; // 2–4, 22–24 → машины
  return many;                                              // 0, 5–20, 25–30 → машин
}
// pluralizeRu(1, ['машина','машины','машин'])  → 'машина'
// pluralizeRu(3, ...) → 'машины' ; pluralizeRu(5, ...) → 'машин' ; pluralizeRu(11,...) → 'машин'
```
Unit-test the boundary cases: 1, 2, 4, 5, 11, 14, 21, 22, 0.
**Warning signs:** a count-N digest reads ungrammatically for N in {11..14, 0}.

### Pitfall 4: Cron starts under Jest and the suite hangs / sends real pushes
**What goes wrong:** registering the cron at module scope (not in `require.main === module`) makes `require('./server')` in supertest start a live scheduler.
**Why it happens:** existing tests `require('./server')` to get the Express `app` without a listener (server.js comment, line 1505-1507).
**How to avoid:** register the cron strictly inside the existing `require.main === module` block. Test `runDigest()` by importing it directly from `digest.js`, never through the cron.
**Warning signs:** open handles after a Jest run; "Jest did not exit one second after"; unexpected fcm calls in unrelated tests.

### Pitfall 5: Double-send on the post-send/pre-clear crash window
**What goes wrong:** process dies after `fcm.sendDigest` resolves but before the `updateMany` clears `digestPending` → next morning the same items re-send.
**Why it happens:** send and clear are two separate operations; there is no cross-operation atomicity without extra state.
**How to avoid (if the operator wants zero duplicates):** in the SAME clearing `updateMany`, also set a `digestSentAt`/`digestSent:true` marker, and have the claim step exclude already-sent rows. The LOCKED contract (NDIG-02) only requires **no drop**, which the base design already guarantees; eliminating the rare duplicate is a hardening decision — **surface it to the planner, don't silently choose.**
**Warning signs:** users report a repeat morning digest after a server restart near 08:00.

### Pitfall 6: node-cron v4 API drift from v3 tutorials
**What goes wrong:** copying a v3 snippet that uses `{ scheduled: false }` + `.start()`, or expects `recoverMissedExecutions`.
**Why it happens:** v4 changed behavior — tasks **auto-start on creation**, `recoverMissedExecutions` was removed, and the callback is awaited (enabling `noOverlap`).
**How to avoid:** use the v4 signature `cron.schedule(expr, asyncTask, { timezone, noOverlap, name })`. No `.start()` needed.
**Warning signs:** `task.start is not a function`; double-fires; missed-run recovery you didn't ask for (you won't get it in v4 — which is what D-02 wants).

---

## Code Examples

### node-cron v4 registration with timezone + noOverlap
```javascript
// Source: nodecron.com/scheduling-options.html (v4 options table)
const cron = require('node-cron');
cron.schedule('0 8 * * *', async () => { await runDigest({ now: new Date() }); }, {
  name: 'daily-digest',
  timezone: 'Asia/Bishkek',   // IANA name; UTC+6, no DST
  noOverlap: true,            // v4 awaits the async task; skips next fire if still running
});
```

### Existing crash-safe / hide-hook conventions to mirror (verified in repo)
```javascript
// notificationService.js:165-168 — the plain-findById hide-hook re-read the digest must copy.
const visible = await Car.findById(carId);          // NO setOptions / bypass flags
if (!visible || visible.status !== 'active') return [];  // suppress hidden/non-active
```
```javascript
// server.js:1508 — the gate the cron registration goes inside.
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  // ← register cron here
}
```

### Integration-test harness (existing helper, reuse verbatim)
```javascript
// Source: __tests__/_helpers/mongoReplSet.js (existing)
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');
let rs;
beforeAll(async () => { rs = await startReplSet(); });
afterAll(async () => { await stopReplSet(rs); });
// Standalone MongoMemoryServer is fine for non-transactional flush tests too;
// the repl-set helper is only required if a test exercises withTransaction (not needed here).
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-cron v3 `{ scheduled:false }` + `.start()`, `recoverMissedExecutions` | v4 auto-start, `noOverlap`, no missed-execution recovery | node-cron 4.x (2025) | Use v4 signature; D-02 no-catch-up is now the default, not a setting |
| FCM `sendMulticast` (legacy) | `sendEachForMulticast` | firebase-admin 11+ | Already used in `fcm.js`; digest reuses it |

**Deprecated/outdated:**
- node-cron v3 tutorials and the `recoverMissedExecutions` option — gone in v4.
- MEMORY.md `notifications_branch_topology.md` "main has neither" — STALE post-PR#10; should be corrected.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Mongoose `updateMany` per-document atomicity is sufficient for the claim/clear (no transaction needed) | Pattern 2 | LOW — standard MongoDB semantics; if wrong, a transaction is a drop-in but adds a repl-set prod requirement |
| A2 | `DeviceToken.lastSeenAt` is refreshed on each app open by the P13 register path, so it's a valid stale-prune signal | Pattern 4 | MED — if `lastSeenAt` is only set at creation, the stale prune would over-delete active tokens; planner MUST verify the register route before using `lastSeenAt`, else prune on `createdAt` |
| A3 | Saved-search digest rows (`data.carId: null`) skip the per-car hide-hook re-check (no single Car to check) | Pattern 5 | LOW — correct by data shape; but planner should confirm the digest still suppresses these if the *subscription* is inactive |
| A4 | The crash-safe contract requires only "no drop"; eliminating the rare post-send/pre-clear duplicate is optional hardening | Pattern 2 / Pitfall 5 | MED — operator may want strict no-double-send; surface as a plan decision, don't assume |
| A5 | A single `digest_title` template per language (with `{count}`) + a render-time RU 3-form helper satisfies the parity test | Pitfall 2 | LOW — verified parity test logic; storing 3 RU keys would break set-equality, so the single-template approach is the safe one |

**These assumptions need planner/user confirmation before becoming locked decisions** — especially A2 (token-prune signal) and A4 (double-send hardening).

---

## Open Questions

1. **Stale-token prune signal (NDIG-05 discretion).**
   - What we know: `DeviceToken.lastSeenAt` exists (default `Date.now`); send-time prune already removes FCM-rejected tokens.
   - What's unclear: whether the Phase-13 register/refresh route updates `lastSeenAt` on each login/refresh (making age a valid liveness signal).
   - Recommendation: planner verifies the register route in the backend; if `lastSeenAt` is refreshed, prune on it (≈60–90d); else prune on `createdAt` age or skip the stale layer and rely on send-time prune only.

2. **Double-send hardening (NDIG-02 / D-?).**
   - What we know: the locked contract guarantees no drop; a crash in the narrow post-send/pre-clear window can re-send next morning.
   - What's unclear: whether the operator wants strict zero-duplicate (adds a `digestSent` marker) or accepts the rare duplicate.
   - Recommendation: present both in the plan; default to the simpler "no-drop, rare-duplicate-acceptable" unless the user asks for the marker.

3. **Digest deeplink route value for the Notification Center (D-03).**
   - What we know: the digest push routes to the in-app Notification Center, NOT `carex://listing/:carId`.
   - What's unclear: the exact deeplink/route string the mobile `App.tsx linking` config maps to `NotificationsScreen` (Phase 12 registered the screen; the route name must be matched).
   - Recommendation: read the mobile `src/types/navigation.ts` + `App.tsx linking` for the `NotificationsScreen` route key (e.g. `carex://notifications`) and use it as `data.deeplink`. Confirm the mobile tap handler already routes it (Phase 13 added 3-state routing) — if not, a tiny mobile change is needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `node-cron` | NDIG-01/04 cron | ✗ (not installed) | — (target `^4.2.1`) | None — must `npm install`; no fallback (it's the core dep) |
| `firebase-admin` | digest send via `fcm.js` | ✓ | `^13.8.0` | — |
| `mongoose` | flush + prune | ✓ | `^9.1.5` | — |
| `mongodb-memory-server` | flush integration tests | ✓ (dev) | `^10.4.3` | — |
| `jest` | tests | ✓ (dev) | `^29.7.0` | — |
| MongoDB Atlas | runtime datastore | ✓ (Railway prod / `MONGODB_URI`) | — | — |
| Railway (single instance) | in-process cron host | ✓ (assumed single-instance) | — | If it ever scales >1, NOTF2-06 advisory lock (v2) — OUT OF SCOPE now |

**Missing dependencies with no fallback:**
- `node-cron` — must be installed (`npm install node-cron@^4.2.1` in the backend repo). This is the one true new dependency.

**Missing dependencies with fallback:** none.

---

## Validation Architecture

> Nyquist validation is enabled. Each ROADMAP success criterion + NDIG requirement mapped to an observable check.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest `^29.7.0` (backend repo) |
| Config | inline in `package.json` (`testMatch: ["**/__tests__/**/*.test.js","**/?(*.)+(spec|test).js"]`, `testEnvironment: node`, `testTimeout: 30000`) |
| Quick run command | `npx jest src/notifications/__tests__/digest.test.js` |
| Full suite command | `npm test` (from backend repo root) |
| DB-backed tests | `MongoMemoryServer` / `MongoMemoryReplSet` via `__tests__/_helpers/mongoReplSet.js` |

### ROADMAP Success Criteria + Requirements → Test Map
| Ref | Behavior | Test Type | Automated Command / Assertion | File |
|-----|----------|-----------|-------------------------------|------|
| SC1 / NDIG-01 | Cron gated by `require.main===module`; `require('./server')` in tests starts NO scheduler | unit + harness | Import `server` in a test, assert no open cron handle / no fcm call; assert `digest.js` exports `runDigest` callable directly | `digest.test.js` + existing server-require tests | ❌ Wave 0 |
| SC1 / NDIG-04 | Fires at Asia/Bishkek 08:00 via `DIGEST_HOUR` | unit | Assert cron expression built from `DIGEST_HOUR` is `0 8 * * *` and options carry `timezone:'Asia/Bishkek'` | `digest.test.js` | ❌ Wave 0 |
| SC2 / NDIG-03 | 3 daily matches + 2 cap-overflow → exactly ONE push with count=5 | integration | Seed 5 `digestPending` rows for one uid; call `runDigest()`; assert `sendDigest` called once with `count:5` | `digest.test.js` | ❌ Wave 0 |
| SC2 / D-04 | RU 3-form title correct for 1/3/5/11 | unit | `pluralizeRu` boundary table; render `digest_title` for counts {1,2,4,5,11,14,21,0} | `translations` parity/unit test | ❌ Wave 0 |
| SC3 / NDIG-02 | Crash mid-run → no double-send, no drop | integration | Seed rows; stub `sendDigest` to throw for user B after user A clears; assert A's rows cleared, B's still `digestPending:true`; re-run → B sent, A NOT re-sent | `digest.test.js` | ❌ Wave 0 |
| SC3 / NDIG-02 | Snapshot bound `createdAt <= runStart` excludes mid-run new rows | integration | Insert a row with `createdAt > runStart`; assert it's not in the batch | `digest.test.js` | ❌ Wave 0 |
| SC4 / NDIG-05 / NDOM-06 | 90-day notifications pruned | integration | Seed a `createdAt` 91d-old row; run; assert deleted; seed an 89d row; assert kept | `digest.test.js` | ❌ Wave 0 |
| SC4 / NDIG-05 | Stale device tokens pruned (non-duplicative) | integration | Seed a stale-`lastSeenAt` token; run; assert deleted; fresh token kept | `digest.test.js` | ❌ Wave 0 |
| SC4 | Hide-hook re-check: listing hidden overnight not pushed | integration | Watch-family `digestPending` row whose Car is now non-active; run; assert that row excluded from count and NOT cleared (or cleared-without-send per policy) | `digest.test.js` | ❌ Wave 0 |
| parity | `digest_title` RU/EN parity | unit | existing `__tests__/notification-translations-parity.test.js` re-runs green after adding `digest_*` | parity test | ✅ (extends existing) |

### Sampling Rate
- **Per task commit:** `npx jest src/notifications/__tests__/digest.test.js`
- **Per wave merge:** `npm test` (full backend suite — must stay green; includes the parity + emit guard tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`. (No real-device UAT needed — this is a backend worker; observable via test + log assertions, unlike the Phase 13 push UAT.)

### Wave 0 Gaps
- [ ] `src/notifications/__tests__/digest.test.js` — covers NDIG-01..05 + SC1..4 (the whole phase)
- [ ] `digest_*` keys added to `translations.js` (RU+EN) so the existing parity test exercises them
- [ ] Dependency install: `npm install node-cron@^4.2.1`
- [ ] (verify) a `lastSeenAt`-refresh check on the device-token register route, else adjust the token-prune signal

---

## Project Constraints (from CLAUDE.md)

**Backend repo conventions (carEx-services):**
- Node/Express + Mongoose + MongoDB Atlas. New code follows existing `src/notifications/` module layout (mirrors `src/moderation/`).
- This phase adds **no new routes** — it is a worker. No router mount.
- Reuse existing patterns: `notificationService.emit()` after-commit precedent, plain-`findById` hide-hook respect, `require.main === module` gate.

**Mobile repo (this repo, CLAUDE.md):**
- Only mobile touch (if any): confirming the Notification-Center deeplink route in `App.tsx linking` / `src/types/navigation.ts` (D-03). RU-first i18n with EN parity (but the digest copy is **server-rendered** in the backend `translations.js`, not the mobile `translations.ts`).
- No new state-management or networking libs (this phase adds none to mobile).
- `GSD Workflow Enforcement`: edits go through a GSD command.

---

## Sources

### Primary (HIGH confidence)
- **Backend source (verified line-by-line this session):** `server.js` (entrypoint gate line 1508, emit trigger points), `src/notifications/push/fcm.js` (send contract, `renderGenericPush`, `pruneToken`), `src/notifications/notificationService.js` (emit, `digestPending` write, hide-hook re-read), `src/notifications/translations.js` (parity structure, `renderGenericPush`), `src/notifications/push/fcm.test.js` (mock harness), `src/models/Notification.js` (`{digestPending}` index, `NOTIFICATION_RETENTION_DAYS=90`), `src/models/DeviceToken.js` (`lastSeenAt`), `src/models/Subscription.js` (`cadence`), `src/models/User.js` (`language`, `notificationPrefs.{quietHours,dailyCap}`), `__tests__/notification-translations-parity.test.js`, `__tests__/_helpers/mongoReplSet.js`, `package.json` (no node-cron).
- **Git state (verified):** `git ls-tree -r --name-only main` + `git log` — PR #10 merged, all notification files on `main`.
- **npm registry (verified):** `npm view node-cron version` → `4.2.1` (latest, modified 2026-04-24).
- `.planning/research/v1.2/SUMMARY.md` — HIGH-confidence prior synthesis (node-cron 4.2.1, in-process, instant-default, hide-hook-by-omission).
- CONTEXT.md (D-01..04 + discretion), ROADMAP.md (Phase 14 SC1..4), REQUIREMENTS.md (NDIG-01..05, NDOM-06).

### Secondary (MEDIUM confidence)
- `[CITED: nodecron.com/scheduling-options.html]` — v4 options table (`timezone`, `noOverlap`, `maxExecutions`, `name`, `maxRandomDelay`); v4 auto-start; `recoverMissedExecutions` absent.
- LogRocket / Teri Cabrel node-cron guides (cross-checked v4 timezone + noOverlap behavior).

### Tertiary (LOW confidence)
- None load-bearing. The `recoverMissedExecutions`-removed claim is confirmed by absence from the official v4 options page (negative claim verified against the current docs, not just a tutorial).

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every installed dep verified in `package.json`; node-cron version registry-verified.
- Architecture / crash-safe flush: HIGH — built directly on verified `Notification` model + emit conventions; the one non-verified primitive (updateMany per-doc atomicity) is flagged A1.
- Pitfalls: HIGH — the count-stripping behavior and parity-test mechanics are read from actual source, not inferred.
- node-cron v4 semantics: MEDIUM-HIGH — official options page cited; the npm/nodecron.com pages were partially blocked (403/404) but the scheduling-options page resolved.

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable backend stack; node-cron is mature). Re-verify node-cron version if planning slips past a month.
