# Phase 14: Daily Digest & Scheduling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 14-daily-digest-scheduling
**Areas discussed:** Fire hour, Digest tap routing, RU digest title plural, Missed-run behavior

---

## Fire hour

| Option | Description | Selected |
|--------|-------------|----------|
| 08:00, named const | Fires 8am Bishkek via a single named constant; early morning check; easy to retune | ✓ |
| 09:00, named const | Fires 9am Bishkek; past the early commute | |
| Env-overridable, default 08:00 | Reads DIGEST_HOUR from env (still redeploys on change) | |

**User's choice:** 08:00, named const
**Notes:** Single named constant chosen over env var — a Railway env change forces a redeploy anyway, so the constant is simpler. Cron gated by `require.main === module` (NDIG-01).

---

## Digest tap routing

| Option | Description | Selected |
|--------|-------------|----------|
| Notification Center | Opens the in-app center that already lists the digestPending rows; natural bundle destination | ✓ |
| Newest single match | Deep-links to newest listing (reuses Phase 13 carex://listing/:carId) but drops other items | |
| Saved-search results | Opens a search-results view; no single search maps to a multi-source bundle | |

**User's choice:** Notification Center
**Notes:** Digest spans multiple searches + watches + cap-overflow, so the single-listing deeplink (Phase 13 D-09) doesn't fit. Reuses existing nav.

---

## RU digest title plural

| Option | Description | Selected |
|--------|-------------|----------|
| Proper 3-form plural | RU helper picks correct form by count (1 машина / 2–4 машины / 5+ машин); marketplace polish | ✓ |
| Count-neutral phrasing | Avoids the plural engine (e.g. "Новые варианты: {count}"); simplest but utilitarian | |
| Sharper branded tone | Lean into regional UNHINGED voice; still needs correct grammar underneath | |

**User's choice:** Proper 3-form plural
**Notes:** `digest_title {count}` is new — must be added with RU+EN parity (parity test enforces EN). User chose grammatical correctness over branded sarcasm for this string; tone stays in the existing plain `push_*` register.

---

## Missed-run behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Roll forward to next morning | Accept the miss; items stay digestPending and deliver next morning; no odd-hour pushes | ✓ |
| On-boot catch-up | On startup, if past fire hour and not run today, flush immediately; risks awkward-hour pushes | |
| Morning-window catch-up | On-boot catch-up only within a morning window; balances recovery vs odd-hour sends | |

**User's choice:** Roll forward to next morning
**Notes:** Safe because pending items persist via `digestPending` — a missed run delays, never loses. On-boot catch-up rejected (a 2pm redeploy → 2pm digest is worse than a one-day delay).

---

## Claude's Discretion

- Quiet-hours default window + soft daily-cap defaults (already delegated in Phase 12 D-16).
- Dead-token cron prune scope (NDIG-05) — `fcm.send()` already prunes FCM-dead tokens at send time; cron prune is the extra/stale layer.
- Digest body copy (line under the title) — generic `push_*`-style line is fine.
- Cron expression / overlap guard — single fixed daily fire; single-instance assumption.

## Deferred Ideas

- Per-user timezone field (NOTF2-05) — v2; would replace the fixed Bishkek hour.
- Multi-instance-safe cron advisory lock (NOTF2-06) — v2; needed only on scale-out.
- On-boot / catch-up digest recovery — rejected this phase; revisit with NOTF2-05.
- UNHINGED-tier branded digest copy — deferred in favor of plain correct copy; possible A/B later.
