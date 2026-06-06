# Roadmap: CarEx

## Milestones

- ✅ **v1.0 — Admin Moderation** — Phases 1-6 (shipped 2026-04-30) — see [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 — Admin Listing Moderation** — Phases 7-11 (shipped 2026-06-06) — see [.planning/milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)
- 📋 **v1.2 — Notifications** — Phases 12+ (planning) — in-app notification center + FCM push; design spec at [docs/superpowers/specs/2026-06-06-notifications-system-design.md](../docs/superpowers/specs/2026-06-06-notifications-system-design.md)

## Phases

<details>
<summary>✅ v1.0 Admin Moderation (Phases 1-6) — SHIPPED 2026-04-30</summary>

- [x] Phase 1: Schema + Security Baseline (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 2: Admin Moderation Endpoints (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 3: Backend Enforcement (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 4: Mobile Plumbing (Mobile) — 7/7 plans — completed 2026-04-18, real-device UAT 2026-04-30
- [x] Phase 5: Admin Moderation UI (Mobile + cross-repo) — 14/14 plans — completed 2026-04-18
- [x] Phase 6: Affected-User UX + Security Review (Both) — 10/12 plans (06-0a + 06-0b deferred per QUAL-02) — security review APPROVED 2026-04-19

</details>

<details>
<summary>✅ v1.1 Admin Listing Moderation (Phases 7-11) — SHIPPED 2026-06-06</summary>

- [x] Phase 7: Listing Schema + Security Baseline (Backend) — 6/6 plans — completed 2026-05-29
- [x] Phase 8: Admin Listing Moderation Endpoints (Backend) — 6/6 plans — completed 2026-05-29
- [x] Phase 9: Backend Read-time + TOCTOU Enforcement — 5/5 plans — completed 2026-05-29
- [x] Phase 10: Mobile Plumbing + Admin Listing UI — 12/12 plans — completed 2026-05-29
- [x] Phase 11: Buyer-affected UX + Quality + Security Review — 8/8 plans — security review APPROVED, completed 2026-05-29

</details>

### 📋 v1.2 Notifications (Phases 12+) — IN PLANNING

Roadmap pending — being created via `/gsd-new-milestone`. Design spec: [docs/superpowers/specs/2026-06-06-notifications-system-design.md](../docs/superpowers/specs/2026-06-06-notifications-system-design.md).

## Backlog / Carry-forward candidates

Documented in `.planning/milestones/v1.0-REQUIREMENTS.md` v2 section + `.planning/milestones/v1.1-REQUIREMENTS.md` v2 section.

- **NOTF-01..03** — Email + push + in-app appeal ticket system → **being scoped into v1.2 Notifications**
- DEBT-01..04 — AuthService split, typed User, expanded test coverage, error handling
- REL-01, REL-03 — Stripe live key, env-config cleanup
- MOD2-01..06 — Extended moderation (CSV export, IP/device fingerprint, bulk select, super-admin tier, etc.)
- LIST-02 — Automated listing-flagging queue (paired with LIST-01)
- QUAL-02 — 10k-user backend load test (deferred from v1.0)
- UX: UserStatusBanner visibility cramped by navbar avatar + logo (captured during Phase 04 UAT 2026-04-30)
- v1.1 carry-forward: bulk admin listings panel + hard-delete UI affordance + listing edit-history diff replay UI
