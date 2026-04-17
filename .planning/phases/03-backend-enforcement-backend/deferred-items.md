# Phase 03 — Deferred Items

Pre-existing concerns surfaced during execution but OUT OF SCOPE for the touching plan's task. Tracked here per executor deviation-rule SCOPE BOUNDARY.

## Plan 03-01

### Duplicate index warning on Broker + LogisticsPartner

**Surfaced by:** Task 2 node smoke test — `node -e "require('./src/models/Broker')"` emits:
`(node:94087) [MONGOOSE] Warning: Duplicate schema index on {"ownerUid":1} found. This is often due to declaring an index using both "index: true" and "schema.index()". Please remove the duplicate index definition.`

**Root cause:** The verbatim schemas at `server.js:146-158` and `server.js:163-177` declare `ownerUid: { type: String, required: true, unique: true }` inline AND then call `brokerSchema.index({ ownerUid: 1 }, { unique: true })` / `logisticsPartnerSchema.index({ ownerUid: 1 }, { unique: true })` a few lines below. Mongoose warns because either form alone is sufficient.

**Why not fixed here:** Plan 03-01 explicitly requires lifting the schemas VERBATIM. The acceptance criteria also require `grep -n "ownerUid: 1 }, { unique: true"` to find the explicit index line. Changing either form would violate both requirements AND alter pre-existing runtime behavior during the Wave 1 extraction window (when the inline schemas in `server.js` still coexist with the new model files per Plan 03-03 scoping).

**Suggested follow-up:** After Plan 03-03 deletes the inline schemas in `server.js`, a cleanup ticket can remove one of the two index declarations on Broker and LogisticsPartner. Recommended: drop `unique: true` from the inline field declaration and keep the explicit `schema.index({ ownerUid: 1 }, { unique: true })` — it's more grep-visible and colocated with other schema metadata.

**Not a Rule 1-3 fix:** Pre-existing warning, not introduced by this plan's changes. Does not affect correctness or security.
