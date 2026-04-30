# Milestones

Historical record of shipped versions. Most recent first.

---

## v1.0 — Admin Moderation

**Shipped:** 2026-04-30
**Tag:** v1.0
**Phases:** 6 | **Plans:** 47 (45 executed, 2 deferred) | **Duration:** 13 days
**Distribution:** TestFlight 1.0.45 + Google Play internal 1.0.48

### Delivered

Admins can act on bad-actor users after they're already in the system — without losing the audit trail or breaking in-flight orders for legitimate counterparties. Backend-first execution: schema + auth → admin endpoints → enforcement → mobile plumbing → admin UI → affected-user UX + security review.

### Key Accomplishments

1. **Cryptographic admin auth** — `firebase-admin.verifyIdToken()` on every admin route; replaced spoofable `callerUid`-in-body pattern (Phase 1)
2. **Append-only audit log** — `ModerationAction` collection with 6 pre-hooks rejecting all mutations at the application layer; indexed for fast targetUid + adminUid lookups (Phase 1)
3. **Five admin actions** — suspend (3 severities), unsuspend, revoke role, delete provider profile, edit profile — all atomic via Mongoose transactions; rate-limited 30/15min (Phase 2)
4. **Read-time enforcement** — `requireNotSuspended` middleware on 5 write routes + Mongoose `pre(/^find/)` hide hooks (no `listing.active` mutation; clean unsuspend) (Phase 3)
5. **TOCTOU-safe payments** — `confirm-booking` re-verifies provider status inside the same transaction; refund-first-throw-second on suspend mid-window (Phase 3)
6. **Dual-role delete contract** — Quick action sheet renders TWO distinct delete rows for users with both broker + logistics profiles, each carrying explicit role payload (Phase 5)
7. **Cursor-paginated admin search + history** — opaque base64 `(createdAt, _id)` cursor for sort-stable pagination + ReDoS-escaped email substring + Firebase UID prefix (Phase 5 0a/0b)
8. **Severity-aware in-app banner** — non-dismissable UserStatusBanner above navigator with reason category + verbatim note + severity-aware appeal path; FeatureGateOverlay on restricted screens via central capability map (Phase 6)
9. **Security review APPROVED** — 06-SECURITY.md merge-gate sign-off; all 5 verdicts PASS (Phase 6 QUAL-03)

### Cross-Phase Bug Fixes Shipped Alongside

- Android deep-link broken (assetlinks.json fingerprints) → fixed via Railway env var
- No install prompt for shared listing (vercel UA redirects + smart-app-banner meta + Listing.js)
- Listing images blanking on Android (FastImage retry-on-error with cache-busting URL + picker shrinkage)

### Known Deferred

- **QUAL-02** — 10k-user backend load test (Plans 06-0a + 06-0b) deferred by operator 2026-04-19. Per 06-SECURITY.md Section (e) accept-with-deferred-verification disposition. Revisit in a future milestone.

### Archive

- Roadmap: `.planning/milestones/v1.0-ROADMAP.md`
- Requirements: `.planning/milestones/v1.0-REQUIREMENTS.md`
