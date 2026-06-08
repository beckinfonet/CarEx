# Phase 14: Daily Digest & Scheduling - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

A scheduled, in-process worker (backend `carEx-services`, on `main`) that once per morning bundles each buyer's pending **daily-cadence saved-search matches + instant-cap overflow + quiet-hours-queued items** into **one localized push** (`digest_title {count}`), delivered crash-safely, and on the same run performs retention pruning (dead device tokens + notifications older than 90 days, satisfying NDOM-06). It **enables** the Daily cadence option that Phase 12 shipped disabled (D-10). Requirements: **NDIG-01..05** (+ NDOM-06 prune).

**In scope:** the `node-cron` job + gating, the atomic snapshot/claim/send/clear digest flush, the localized digest title (RU+EN), the retention/token prune, and the hide-hook re-check at flush time.

**Out of scope (deferred):** per-user timezone field (NOTF2-05), multi-instance-safe cron advisory lock (NOTF2-06) — both explicitly v2. Any new notification *categories*. Mobile-side changes beyond enabling the already-built Daily cadence selector.
</domain>

<decisions>
## Implementation Decisions

### Scheduling & fire time
- **D-01:** Digest fires at **08:00 Asia/Bishkek**, defined as a **single named constant** (e.g. `DIGEST_HOUR = 8`) so it's retunable in one place. Not env-driven for now (a Railway env change still forces a redeploy, so the constant is simpler). The cron is gated by `require.main === module` so the test suite never starts it (NDIG-01).
- **D-02 (missed-run policy):** **Roll forward to the next morning** — accept that `node-cron` does not catch up a fire it slept through (server down / Railway redeploy at the hour). This is safe *because* pending items remain `digestPending` (persisted), so nothing is lost — a missed run simply means those items deliver in the next morning's digest. **No on-boot catch-up** (rejected: a redeploy at, say, 2pm would push a digest at 2pm — worse UX than a one-day delay).

### Digest push behavior
- **D-03 (tap routing):** Tapping the digest push opens the **in-app Notification Center**, which already lists the individual `digestPending` rows. This is the natural "here's everything" destination for a bundle. The single-listing deeplink reused for instant pushes (Phase 13 D-09, `carex://listing/:carId` → CarDetails) does **not** apply to the multi-item digest — the digest push carries a deeplink/route to the Notification Center instead. Reuses existing nav; no new screen.

### Localization
- **D-04 (RU pluralization):** `digest_title {count}` is **new** (does not exist in `translations.js` yet) and must be added with **RU + EN parity** (i18n constraint). RU uses **proper 3-form pluralization** via a small helper: **1 → `машина` form**, **2–4 → `машины` form**, **5+/0/11–14 → `машин` form** (standard Russian rules). Grammatically correct count title — marketplace polish for the KG/RU audience. EN uses simple singular/plural. Tone stays consistent with the existing `push_*` register (plain, not the UNHINGED tier — user chose correct-grammar over branded sarcasm here).

### Claude's Discretion (planner/researcher)
- **Quiet-hours default window + soft daily-cap (2–3/day) defaults** — already delegated to planner discretion in Phase 12 (D-16); pick sensible defaults. Quiet-hours seeded from the existing device-timezone→city signal; **no per-user TZ field, no GPS** ([[user_location_signal]]).
- **Dead-token prune scope (NDIG-05):** `fcm.send()` *already* prunes tokens FCM rejects as permanently dead at send time (`pruneToken` → `DeviceToken.deleteOne`). The cron's token prune is therefore the **extra/stale** layer — planner/researcher to decide its target (e.g. tokens with no recent successful send) without duplicating the send-time prune.
- **Digest body copy** (the line under the title) — planner discretion; a generic "Откройте, чтобы посмотреть" / "Open to take a look." in the existing `push_*` style is fine.
- **Cron expression / overlap guard** — single fixed daily fire; if a run overruns, the next day's fire is far enough away that overlap is not a concern (single-instance assumption holds until NOTF2-06).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §"Daily Digest & Scheduling (NDIG) · Phase 14" — NDIG-01..05 acceptance phrasing; NDOM-06 90-day retention policy (job executes here); NPRF-03 (quiet hours) / NPRF-04 (soft daily cap) plumbing whose *delivery* lands in this phase.
- `.planning/ROADMAP.md` §"Phase 14: Daily Digest & Scheduling" — goal + 4 success criteria (the crash-safe snapshot/claim/send/clear contract, `require.main===module` gate, fixed Bishkek hour, same-run prune + hide-hook re-check).

### Prior-phase decisions this builds on
- `.planning/phases/12-notification-domain-in-app-center/12-CONTEXT.md` — D-10 (Phase 14 *enables* the disabled Daily cadence selector; `Subscription.cadence` exists, defaults to `instant`), D-16 (quiet-hours + daily-cap defaults are planner discretion).
- `.planning/phases/13-fcm-push-transport-native/13-CONTEXT.md` — D-09 (push-tap deeplink routing via App.tsx `linking`; single-listing pattern that the digest tap intentionally diverges from).
- `.planning/research/v1.2/SUMMARY.md` — HIGH-confidence research synthesis (after-commit emit, hide-hook respect by omitting bypass flags, `firebase-admin@13.8.0` already installed).

### Backend code (carEx-services, on `main`)
- `src/notifications/push/fcm.js` — `send({ uid, titleKey, title, lang, data })` send path the digest reuses; already prunes FCM-dead tokens (`pruneToken`).
- `src/notifications/notificationService.js` — `emit()` sets `digestPending: cadence === 'daily'`; the queue the digest drains.
- `src/notifications/translations.js` — `push_*` RU/EN entries; the parity pattern `digest_title` must follow (mirrored by `__tests__/notification-translations-parity.test.js`).
- `src/models/Notification.js` — `{digestPending}` index; the model the snapshot/claim/clear operates on.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fcm.send()` — the localized FCM send path (token fetch, jittered backoff, dead-token prune). The digest calls this once per user with `titleKey/title = digest_title` and `data.deeplink` → Notification Center.
- `notificationService.emit()` — already writes `digestPending: true` rows for daily-cadence matches; the digest is the consumer of that flag.
- `translations.js` + `notification-translations-parity.test.js` — established RU/EN parity pattern; `digest_title` slots in and the parity test enforces EN coverage automatically.

### Established Patterns
- **Crash-safe flush (locked by NDIG-02):** snapshot `createdAt <= runStart` → claim → send → clear **only successfully-sent** ids (`digestPending` cleared per-id). No double-send, no drop on mid-run crash.
- **Hide-hook respect by omission:** flush re-checks the hide-hook (respect by NOT passing bypass flags — per v1.2 research) so a listing hidden overnight isn't pushed.
- **`require.main === module` gating:** start the cron only when the service runs as the entrypoint, never under Jest.

### Integration Points
- Cron registered at Express service startup (entrypoint-gated), reading `DIGEST_HOUR` constant.
- Digest push `data` payload carries a Notification-Center route, consumed by the mobile `linking`/tap-routing layer (App.tsx) — distinct from the `listing/:carId` deeplink.
- Same cron run invokes the prune (dead tokens + 90-day-old notifications).
</code_context>

<specifics>
## Specific Ideas

- Fire hour fixed to **08:00 Asia/Bishkek** (KG buyers; single timezone assumption — no per-user TZ until NOTF2-05).
- RU title must read naturally with correct plural agreement, e.g. `1 новый вариант` / `3 новых варианта` / `5 новых вариантов` (planner to finalize exact wording; the 3-form rule is the constraint).
</specifics>

<deferred>
## Deferred Ideas

- **Per-user timezone field (NOTF2-05)** — would let the digest fire at each buyer's local morning instead of a single Bishkek hour. v2.
- **Multi-instance-safe cron advisory lock (NOTF2-06)** — needed only if the backend scales beyond one instance; current single-instance assumption makes the crash-safe per-id flush sufficient. v2.
- **On-boot / catch-up digest recovery** — considered and rejected for this phase (D-02); could revisit alongside NOTF2-05 if missed-day delivery becomes a real complaint.
- **UNHINGED-tier branded digest copy** — considered for the title; deferred in favor of grammatically-correct plain copy. Could A/B later.

None of these expand Phase 14 scope — discussion stayed within the digest-worker boundary.
</deferred>

---

*Phase: 14-daily-digest-scheduling*
*Context gathered: 2026-06-07*
