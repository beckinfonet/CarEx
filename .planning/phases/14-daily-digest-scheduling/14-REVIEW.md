---
phase: 14-daily-digest-scheduling
reviewed: 2026-06-07T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - App.tsx
  - backend-services/carEx-services/src/notifications/digest.js
  - backend-services/carEx-services/src/notifications/push/fcm.js
  - backend-services/carEx-services/src/notifications/translations.js
  - backend-services/carEx-services/src/models/Notification.js
  - backend-services/carEx-services/server.js
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-06-07T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Phase-14 daily-digest worker across both repos: the in-process node-cron
entrypoint (`server.js`), the crash-safe flush + retention prune (`digest.js`), the FCM
fan-out (`fcm.js`), the localized count-bearing copy (`translations.js`), the schema flag
(`Notification.js`), and the mobile deeplink whitelist widening (`App.tsx`).

The core safety properties hold up under scrutiny:

- **Crash-safety / claim-replay:** the atomic `updateMany` re-stamps *all* still-pending
  rows (regardless of any stale `digestRunId` from a crashed run) with the new `runId`,
  and the read-back is keyed on the new `runId` — a crashed prior run is correctly
  re-picked with no drop. Verified by tracing the claim/read-back/clear ordering.
- **Double-send semantics:** matches the documented LOCKED tradeoff (no drop, accept the
  rare post-send/pre-clear duplicate). Clear is per-id, scoped to surviving ids only.
- **PII guarantee:** `sendDigest` interpolates only the integer `count`; `deeplinkOnly`
  strips everything but `data.deeplink`. Confirmed no make/model/price/seller/uid reaches
  the payload copy.
- **RU pluralization:** exercised the renderer at runtime for 0/1/2/5/11/21/22 — all three
  forms select correctly ("1 новая машина" / "2 новые машины" / "5 новых машин" /
  "21 новая машина"). EN singular/plural also correct.
- **Cron gate:** `cron.schedule` is strictly inside `require.main === module`; verified
  node-cron is v4.2.1 and the `noOverlap`/`timezone`/`name` options are valid v4 fields.
- **Deeplink whitelist:** ran the normalizer against `notifications`, `notifications/`,
  `notificationsfoo`, `NOTIFICATIONS`, and the https form — the new branch matches exactly
  `notifications` and `notifications/...` and nothing adjacent. Carries no params → no
  injection surface. Widening is tight.

No blockers. Three warnings (one real contract gap, two no-drop / delivery edge cases) and
four info items follow.

## Warnings

### WR-01: `fanOut` can throw despite the documented "never throws" contract (`ensureInitialized` is unguarded)

**File:** `backend-services/carEx-services/src/notifications/push/fcm.js:95`
**Issue:** `fcm.js`'s header and both `send`/`sendDigest` JSDoc explicitly promise the
functions "never throw" / "Never throws." But `fanOut` calls
`const admin = ensureInitialized();` (line 95) outside any try/catch, and
`ensureInitialized()` (src/security/firebaseAdmin.js:14,20) throws synchronously when
`FIREBASE_SERVICE_ACCOUNT_JSON` is unset or is invalid JSON. So the never-throw contract is
breached on a misconfigured/unprovisioned environment.

Impact is split:
- **Digest path (in scope):** survivable — `digest.js`'s per-uid `try/catch` (line 155)
  catches it, so the loop doesn't abort. But the failure mode is poor: *every* user in the
  digest hits the same misconfiguration error one-by-one, all rows stay `digestPending:true`,
  and the cron silently no-ops every morning until the env is fixed (only per-uid
  `console.error` noise, no single clear "FCM not initialized" signal).
- **Instant path (adjacent, Phase 13):** `notificationService.js:213` does
  `await fcm.send(...)` with **no** surrounding try/catch in the per-target loop, so a thrown
  `ensureInitialized()` there *will* propagate out of `emit` and can fail the originating
  request. This is the concrete risk the never-throw contract was meant to prevent.

**Fix:** Honor the contract at the boundary — wrap the init (and ideally the whole fan-out)
so it degrades to `{ ok: false, delivered: 0 }` instead of throwing:

```js
async function fanOut(uid, notification, payloadData) {
  const rows = await DeviceToken.find({ uid }).lean();
  let tokens = (rows || []).map((r) => r.token).filter(Boolean);
  if (!tokens.length) return { ok: true, delivered: 0 };

  let messaging;
  try {
    messaging = ensureInitialized().messaging();
  } catch (err) {
    // Misconfiguration must not throw out of the never-throw contract.
    console.error('[fcm] admin init failed, skipping fan-out:', err && err.message);
    return { ok: false, delivered: 0 };
  }
  // ...rest unchanged
}
```

Note: returning `ok:false` (not `ok:true`) is the correct digest behavior — it leaves the
rows `digestPending:true` for the next run rather than clearing them with zero delivery.

### WR-02: 90-day retention prune deletes still-`digestPending` rows, contradicting the "no drop" guarantee

**File:** `backend-services/carEx-services/src/notifications/digest.js:192`
**Issue:** The prune is `Notification.deleteMany({ createdAt: { $lt: notifCutoff } })` with no
`digestPending` exclusion. A notification that never sent — because its target Car stayed
non-active (dropped by the hide-hook re-check every morning) or because `sendDigest` returned
`!ok` for 90 consecutive days — keeps `digestPending:true` and is then hard-deleted by this
same prune once it crosses the 90-day `createdAt` cutoff. That is a silent drop of an
undelivered queued item, which is in tension with the loudly-documented NDIG-02 "NO DROP"
contract. The flush and the prune are both driven off `createdAt`/age with no awareness of
each other.

In practice the prune runs in the same `runDigest` *after* the flush, so a row claimed this
morning is sent before it could be pruned. The exposure is specifically the long-stuck-pending
tail (perpetually-non-active car, or chronic send failure). Low likelihood, but it is a real
correctness gap against the stated invariant.

**Fix:** Either exclude pending rows from the retention delete, or make the intent explicit
that 90-day-old pending rows are intentionally reaped. Conservative option:

```js
await Notification.deleteMany({
  createdAt: { $lt: notifCutoff },
  digestPending: { $ne: true },
});
```

If reaping ancient pending rows IS intended, add a one-line comment saying so — right now the
silent overlap with "NO DROP" reads as an oversight.

### WR-03: `result.ok && delivered === 0` clears `digestPending` even though no push was delivered

**File:** `backend-services/carEx-services/src/notifications/digest.js:147-153`
**Issue:** `fanOut` returns `{ ok: true, delivered: 0 }` for a user with zero device tokens
(fcm.js:91), and also returns `ok:true` when every token failed/was pruned/was left as an
unknown-error. The digest's clear branch keys solely on `result.ok`, so it sets
`digestPending:false` for these users even though the morning push was never delivered to any
device. `sent` is incremented and `cleared` counts the ids, making the metrics overstate
actual delivery.

This is defensible (the in-app Notification Center is the source of truth; a tokenless user
simply gets no push and the items remain visible in-app), and clearing avoids re-queueing
forever. But it conflates "successfully delivered" with "no live device to deliver to," and
the `sent`/`cleared` return values become misleading for any monitoring built on them.

**Fix:** If the metrics are meant to mean delivery, branch on `delivered`:

```js
if (result && result.ok) {
  if (result.delivered > 0) sent += 1;   // only count real deliveries
  // still clear digestPending so tokenless users don't re-queue forever
  await Notification.updateMany(/* ...unchanged... */);
  cleared += survivingIds.length;
}
```

At minimum, document that `sent` counts "users whose digest was finalized," not "pushes
delivered," so downstream consumers don't misread it.

## Info

### IN-01: Dropped (non-active-car) rows accumulate a stale `digestRunId` indefinitely

**File:** `backend-services/carEx-services/src/notifications/digest.js:131,134`
**Issue:** When a row is dropped by the hide-hook re-check (Car null/non-active) or when a
whole uid yields `!surviving.length` (`continue` at line 134), the row keeps
`digestPending:true` but its `digestRunId` is left at whatever the morning's `updateMany`
stamped — it is only `$unset` on successful send (line 151). Each subsequent run re-stamps it,
so it is harmless for correctness (the claim re-runs cleanly), but `digestRunId` is never a
reliable "claimed-by-the-current-run-only" marker for these rows between runs. Purely a
data-hygiene note; the comment at line 39 of `Notification.js` already describes the
re-stamp-on-replay behavior, so this is consistent with intent.
**Fix:** None required. Optionally `$unset digestRunId` on the drop path for cleanliness.

### IN-02: `interpolate` returns empty string for a null/NaN count, yielding a malformed digest title

**File:** `backend-services/carEx-services/src/notifications/translations.js:133-139,219`
**Issue:** `renderDigest` interpolates `{ count }` via `interpolate`, which renders `''` when
`params[key] == null`. The digest caller always passes a real integer
(`count = survivingIds.length`, guarded by `if (!surviving.length) continue`), so count is
always `>= 1` in practice — no live defect. But `renderDigest('RU', null)` would produce
`" новых машин"` (leading space, no number) rather than failing loudly. Defensive only.
**Fix:** Optionally coerce/guard in `renderDigest`: `const c = Number.isFinite(Number(count)) ? Number(count) : 0;` before interpolation.

### IN-03: EN `digest_noun_forms.many` is dead (never selected)

**File:** `backend-services/carEx-services/src/notifications/translations.js:119-123,217-218`
**Issue:** EN `renderDigest` only ever reads `f.one` (count===1) or `f.few` (everything else);
`f.many: 'new matches'` is never referenced. It exists solely for RU/EN structural parity
(the parity test wants identical key sets), and `few`/`many` are the same string in EN, so
there's no user-visible effect. Noting it as dead-but-intentional so a future reader doesn't
mistake it for a bug or "fix" it away and break parity.
**Fix:** None. Optionally a one-line comment that EN `many` is parity-only padding.

### IN-04: Digest worker has no compound index for the claim read-back query

**File:** `backend-services/carEx-services/src/models/Notification.js:50` /
`backend-services/carEx-services/src/notifications/digest.js:91`
**Issue:** The read-back `find({ digestPending: true, digestRunId: runId })` and the claim
`updateMany({ digestPending: true, createdAt: { $lte: runStart } })` are served only by the
single-field `{ digestPending: 1 }` index; `digestRunId`/`createdAt` are not in a compound
index. Flagged as INFO (not a bug) and explicitly **out of v1 review scope** (performance) —
recorded only because the daily-cadence queue could grow and the cron is a batch job. No
action required for correctness.
**Fix:** Out of scope. If revisited later, consider `{ digestPending: 1, createdAt: 1 }`.

---

_Reviewed: 2026-06-07T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
