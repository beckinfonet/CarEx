# Phase 14 — Deferred / Out-of-Scope Items

Out-of-scope discoveries logged during execution (not fixed — pre-existing, unrelated to the current task's changes).

| Discovered in | Item | Detail | Disposition |
|---------------|------|--------|-------------|
| 14-01 (full backend suite run) | `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` — 2 failing tests | Pre-existing failure documented in STATE.md (Phase 13: "pre-existing ServiceOrder.providerSnapshot failure untouched"). Last touched by unrelated moderation commit `889b831`. NOT caused by node-cron install or digest/translations changes. | Out of scope — left untouched (SCOPE BOUNDARY rule). Not a Phase 14 concern. |
