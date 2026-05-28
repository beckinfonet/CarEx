# Roadmap: CarEx

## Milestones

- ✅ **v1.0 — Admin Moderation** — Phases 1-6 (shipped 2026-04-30) — see [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

## Phases

<details>
<summary>✅ v1.0 Admin Moderation (Phases 1-6) — SHIPPED 2026-04-30</summary>

- [x] Phase 1: Schema + Security Baseline (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 2: Admin Moderation Endpoints (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 3: Backend Enforcement (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 4: Mobile Plumbing (Mobile) — 7/7 plans — completed 2026-04-18, real-device UAT 2026-04-30
- [x] Phase 5: Admin Moderation UI (Mobile + cross-repo) — 14/14 plans — completed 2026-04-18 (backend SUMMARYs retroactively bookkept 2026-04-30)
- [x] Phase 6: Affected-User UX + Security Review (Both) — 10/12 plans (06-0a + 06-0b deferred per QUAL-02) — security review APPROVED 2026-04-19

</details>

### 📋 Next Milestone (To Be Planned)

Use `/gsd-new-milestone` to start the next milestone cycle (questioning → research → requirements → roadmap).

#### Pre-designed scope (ready for spec-phase)

- **LIST-01 — Admin Listing Moderation** — design decisions captured 2026-05-28 in [.planning/notes/listing-moderation-design.md](notes/listing-moderation-design.md). Four distinct admin actions (Edit / Suspend / Archive / Delete-soft) on a single `status` field, reuses v1.0 audit + auth patterns, inline on `CarDetails`. Pending research: does the existing seller `EditCarScreen` cover all admin-edit fields ([.planning/research/questions.md](research/questions.md)).

#### Other carry-forward candidates (documented in `.planning/milestones/v1.0-REQUIREMENTS.md` v2 section)

- DEBT-01..04 — AuthService split, typed User, expanded test coverage, error handling
- REL-01, REL-03 — Stripe live key, env-config cleanup
- MOD2-01..06 — Extended moderation (CSV export, IP/device fingerprint, bulk select, super-admin tier, etc.)
- NOTF-01..03 — Email + push + in-app appeal ticket system
- LIST-02 — Automated listing-flagging queue (paired with LIST-01)
- QUAL-02 — 10k-user backend load test (deferred from v1.0)
- UX: UserStatusBanner visibility cramped by navbar avatar + logo (captured during Phase 04 UAT 2026-04-30)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Schema + Security Baseline | v1.0 | 6/6 | Complete | 2026-04-17 |
| 2. Admin Moderation Endpoints | v1.0 | 6/6 | Complete | 2026-04-17 |
| 3. Backend Enforcement | v1.0 | 6/6 | Complete | 2026-04-17 |
| 4. Mobile Plumbing | v1.0 | 7/7 | Complete | 2026-04-18 |
| 5. Admin Moderation UI | v1.0 | 14/14 | Complete | 2026-04-18 |
| 6. Affected-User UX + Security Review | v1.0 | 10/12 (2 deferred) | Complete | 2026-04-30 |
