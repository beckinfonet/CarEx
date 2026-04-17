# Phase 2: Admin Moderation Endpoints (Backend) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 02-admin-moderation-endpoints-backend
**Areas discussed:** Edit-profile contract (user-selected). Other three gray areas — revoke/delete semantics, rate limiting, payload validation + severity/state — noted as Claude's Discretion with recommended defaults captured in CONTEXT.md.

---

## Gray Area Selection

| Area | Description | Selected |
|------|-------------|----------|
| Revoke & delete semantics | What role mutates on revoke_role; what happens to Broker/LogisticsPartner doc on revoke vs delete; listed flag vs read-time filter | |
| Rate limiting strategy | Memory vs Redis store; key by admin UID vs IP; what counts; 429 shape | |
| Edit-profile contract | Field whitelist, fieldDiff shape, unknown-field behavior, empty-diff behavior | ✓ |
| Payload validation + severity/state | Zod schema location; severity vs state on suspend payload; re-suspend semantics; last-admin guard placement | |

**User's choice:** Edit-profile contract only. Other three: "Create context" — accept recommended defaults, document as Claude's Discretion.

---

## Edit-Profile Contract

### Whitelist

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow — identity/contact only | Broker: companyName, phoneNumber, telegramUsername. Logistics: same + coverageAreas, timelines. Matches PROJECT.md "company name, phone, Telegram" phrasing. | ✓ |
| Mid — add description + avatarUrl | Narrow set plus description and avatarUrl. Lets admin fix offensive content without deleting profile. | |
| Broad — all non-metadata fields | Everything except ownerUid, status, createdAt, _id, services. Maximum power; bigger compromised-admin blast radius. | |

**User's choice:** Narrow — identity/contact only (recommended).
**Notes:** Aligns with PROJECT.md wording. Admin is correcting identity/contact info, not curating the provider's listing content.

---

### fieldDiff shape

| Option | Description | Selected |
|--------|-------------|----------|
| Per-field before/after, changed only | `{ companyName: { before: 'X', after: 'Y' } }` — only changed fields, readable directly in Phase 5 UI. | ✓ |
| Top-level before/after objects | `{ before: {...}, after: {...} }` — symmetric but duplicates unchanged fields unless filtered. | |
| After-only | `{ after: { companyName: 'Y' } }` — smallest, but audit log can't show prior value without cross-referencing. | |

**User's choice:** Per-field before/after, changed only (recommended).
**Notes:** Phase 5 history UI can render a diff with zero transformation; smallest storage while still auditable.

---

### Unknown fields

| Option | Description | Selected |
|--------|-------------|----------|
| Reject 400 invalid_field | `{ error: 'invalid_field', fields: [...] }`. Zod .strict() gives this free. Prevents schema-drift bugs. | ✓ |
| Silently drop | Accept request, apply only whitelisted fields, return 200. Permissive; hides client typos. | |
| Log + drop | Drop unknown fields, log a warning. Middle ground; warnings easy to lose in production noise. | |

**User's choice:** Reject 400 invalid_field (recommended).
**Notes:** Zod .strict() provides this out of the box; fail-loud beats silent drops.

---

### Empty diff (no actual change)

| Option | Description | Selected |
|--------|-------------|----------|
| Reject 400 no_changes | Keeps audit log clean — every ModerationAction row represents a real change. | ✓ |
| 200 OK, no audit write | Silent no-op. Audit log stays clean but success response is misleading. | |
| 200 OK, audit row with empty fieldDiff | Writes audit row anyway. Every attempt traceable; ledger has no-op noise. | |

**User's choice:** Reject 400 no_changes (recommended).
**Notes:** Compliance hygiene — audit rows should only exist for real state changes.

---

## Claude's Discretion

Areas the user accepted without deep-dive discussion. Recommended defaults locked in CONTEXT.md:

- **Revoke/delete semantics (D-08..D-16):** Revoke only mutates `User.{role}Status = 'NONE'`; Broker/LogisticsPartner doc untouched. No new `listed` flag — rely on Phase 3 read-time join on `User.{role}Status`. Delete hard-deletes provider doc AND sets `User.{role}Status = 'NONE'` in the same transaction. Seller delete rejected (no profile doc exists).
- **Rate limiting (D-30..D-33):** `express-rate-limit@^8.3` with in-memory store, keyed by `req.admin.uid`, 30 req / 15 min, 429 with `retryAfter`. STATE.md blocker on Railway instance count must be resolved during planning — if >1 instance, swap to `rate-limit-redis`.
- **Payload validation + severity/state (D-17..D-22, D-34..D-37):** Zod per-action schemas in `src/moderation/schemas.js`, `.strict()` mode. Suspend payload is severity-only; state derived. Re-suspend at different severity allowed (escalation); re-suspend at same severity rejected. Last-admin guard lives inside the suspend handler, inside the transaction; runs only for `suspend` (other actions don't threaten admin capability).

## Deferred Ideas

(None surfaced during discussion — scope stayed tight inside edit-profile.)
