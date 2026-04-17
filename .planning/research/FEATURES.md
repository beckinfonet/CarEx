# Feature Research

**Domain:** Admin moderation for a mobile car marketplace (post-approval user lifecycle)
**Researched:** 2026-04-17
**Confidence:** HIGH (domain is well-established; categorization calibrated to single-admin-team scale)

## Scope Frame

This milestone is **post-approval moderation** — admins acting on users who are already past the approval gate. It is NOT a trust-and-safety ops center, it is NOT Stripe-level fraud ops, and it is NOT a Facebook-scale content moderation pipeline. The right mental model is: **a single admin team of 1–5 operators moderating a few thousand users, a few dozen actions per week**.

Reference comparables at this scale:
- eBay Seller Hub admin tooling (user-level holds, restrictions)
- Turo host suspension flow
- Facebook Marketplace per-user restrictions
- Autotrader dealer-account suspension

All of them converge on roughly the same table stakes below. The milestone scope in `.planning/PROJECT.md` maps closely to this minimum; differentiators and anti-features are framed relative to that scope.

## Feature Landscape

### Table Stakes — Admin UX

Features without which admins **cannot do the job competently**. Missing any of these turns the moderation screen into a lookup-and-pray tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Paginated user list with search** (by email and Firebase UID) | You cannot moderate what you cannot find. Scrolling a flat list stops working at ~200 users | MEDIUM | Server-side pagination + indexed search on `email` and `firebaseUid`. Already partially implicit in existing `getAdminUsers` — needs to grow into a real search endpoint |
| **Filter by role and status** (buyer / seller / broker / logistics / admin ∪ active / feature-limited / blocked / banned) | Admins triage by cohort: "show me all suspended brokers", "show me all permanently-banned users" | LOW | Pure query filter on the same list endpoint. No new UI primitives |
| **Per-user detail panel** (identity, roles, status, last login, counts of listings/orders, current severity) | The one-click actions on the list only make sense after the admin has confirmed the target | MEDIUM | New screen or expandable drawer. Reuses existing backend user fields + new status field |
| **One-click actions with explicit confirm** (Suspend / Revoke / Delete / Edit) | Confirmation dialog is the only thing between a slip and an irreversible ban. Table stakes — never ship destructive actions without confirm | LOW | Modal with action summary + severity + reason category + optional note. Already specified in `.planning/PROJECT.md` |
| **Reason category picker** (Spam / Policy violation / Fraud / Other) + optional free-text note | Preset categories keep audit data analyzable; free-text handles edge cases. Required by the milestone | LOW | Enum on the audit row + optional `note` string |
| **Full per-user action history** (who, when, what, severity, reason, note) | Every other action depends on this. Without history, the admin re-asks "wait, did we already suspend this user?" every single time | MEDIUM | Dedicated `moderation_audit` collection keyed by `targetUid`, admin queries it by user. Already in milestone scope |
| **Undo / Unsuspend** (convert `blocked` or `feature_limited` back to `active`) | Mistakes happen; admin needs a reversal path that is itself audited | LOW | New endpoint `PATCH /api/admin/moderation/:targetUid/unsuspend`. Writes a new audit row (don't mutate or delete the original) |
| **Server-side admin-only enforcement on every moderation endpoint** | Non-negotiable security baseline. Mobile-side `isAdmin` is a hint for UI only — the server is the authority. This is also stated as a hard constraint in `.planning/PROJECT.md` | LOW | Extend existing `getAdminStatus(callerUid)` middleware pattern; apply to every new route |
| **Enforcement middleware on user-initiated endpoints** (create listing, create order, contact seller, etc.) rejects suspended/banned users | A suspension that only changes UI is not a suspension. The backend must refuse actions from non-`active` users. Milestone states this explicitly | MEDIUM | Single middleware that loads `UserStatus` by `firebaseUid` and short-circuits with a 403 + reason. Touches many existing routes — mechanical but broad |
| **Status model stored as first-class field on the user record** (`active` / `feature_limited` / `blocked_with_review` / `permanently_banned`) | Every enforcement decision and banner lookup depends on this one field. Has to exist before anything else functional ships | LOW | Schema change. Default `active`. Migration fills existing users with `active` |

### Table Stakes — Affected-User UX

The person being moderated must understand **what happened and what they can do**. Silence or ambiguity here causes support-email floods and App Store one-star reviews.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **In-app banner/modal on next login, severity-aware** | "You can still log in but can't do X" vs "Your account is blocked, appeal at …" vs "Permanently blocked" are three genuinely different UX states | MEDIUM | Already in milestone scope. Read status on app load; render banner component conditional on status. Banner text pulls from `translations.ts` — RU + EN required |
| **Non-dismissable for blocked / banned; dismissable-but-persistent for feature-limited** | A banned user cannot be allowed to bypass the notice and use the app. A feature-limited user needs to see the restriction reminder whenever they hit the limited feature | LOW | Banner component takes `severity` prop and renders different close-button logic |
| **Reason (preset category + admin note) visible to the user** | The user's own words from `.planning/PROJECT.md`: *"Reason shown to affected user — full transparency. Supports appeal flow via email."* No-reason suspensions feel arbitrary and erode trust | LOW | Banner body string templated from reason category translation + optional note |
| **Appeal path shown** (`support@carexmarket.com` for `blocked_with_review`) | If there is no reversal path, the banner becomes a dead-end. Even a permanent ban needs an email of record for GDPR-style data requests | LOW | Static mailto: link or contact instruction in banner. No in-app ticketing this milestone |
| **Read-only view of the user's own past orders and data** | A banned seller still has real-world delivery obligations on in-flight orders. Buyers still need to reach the seller about a car they already paid for. Hard-cutting access can break real transactions | MEDIUM | Order list screen stays reachable in read-only mode even when user is `blocked_with_review` or `permanently_banned`. Pairs with the "orders pause, don't auto-cancel" constraint |
| **Instruction text for `feature_limited`** explains what to do to resolve | "Your account is restricted" with no next step is hostile UX. Milestone calls out "verify phone", "re-submit documents" as example resolutions | LOW | Note-field on the audit row doubles as the instruction text |

### Differentiators (Competitive Edge at This Scale)

Features that move the panel from "functional" to "pleasant to operate" for a small admin team. Each one earns its keep by saving admin time or preventing a known class of mistake.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Smart search** (matches email substring, UID prefix, phone, display name in one box) | A single input that just works beats a tab of filter widgets. Admins paste whatever the support ticket gave them — email, UID, phone — and want it to resolve | MEDIUM | Server-side `$or` across indexed fields. Cap result count |
| **Saved filters / bookmarks** ("All suspended brokers", "Banned in last 30 days") | Admin triage is repetitive. A saved filter is a 1-second action; reconstructing it is a 20-second action repeated 10×/day | LOW | Persist filter state in AsyncStorage (mobile-local). No backend change needed |
| **Pinned admin notes on a user** (separate from audit-row notes) | The audit log records individual actions. A pinned note records context: "known ex-seller who came back as a buyer — watch". Different lifetime, different purpose | LOW | Small `adminNote` field on the user record, editable by any admin, audited when edited |
| **Admin-to-admin handoff comments on a moderation thread** | When two admins work the same case, the second needs to know what the first already checked. Avoids duplicate work and contradictory actions | MEDIUM | `comments` array on the user moderation document, admin-only readable. Essentially a tiny per-user threaded chat |
| **Moderation SLA tracking** (time-from-flag-to-action) | Once the admin queue exists, knowing whether cases are getting stale is genuinely useful. At a small scale this is just a dashboard widget, not an ops system | MEDIUM | Presupposes a flag/queue model — out of scope this milestone, but flagged as where to go next |
| **IP / device fingerprint captured at moderation time** | Lightweight ban-evasion detection: if a freshly-created buyer account shares IP and device hash with a recently-banned seller, flag it. Not automated blocking, just context for the admin | MEDIUM | Backend already sees request IP; capture User-Agent and (optionally) a device-id header from mobile. Store on the audit row, not on the user. **Legal gotcha:** RU and EU privacy regimes — disclose in privacy policy |
| **Export CSV of audit log** (for a given user, date range, or admin actor) | Needed the first time anyone asks "show me everything admin X did last quarter." Regulators, investors, or internal reviews will ask this eventually | LOW | Server-side stream-to-CSV endpoint. No new frontend beyond a "Download" button |
| **Rate limiting / admin-action throttle** per admin UID | If a compromised admin account starts mass-banning, the throttle is the last line of defense. Also catches accidental scripts | LOW | Simple counter middleware (e.g., 20 moderation actions / 5 min / admin UID → require confirm-again) |
| **Read-only / senior-only permissions** (not all admins can ban) | Even a small admin team benefits from one-step escalation: junior admin can suspend feature-limited, senior admin approves blocked/banned | MEDIUM | Extend existing `adminRole` (already in `AuthContext`) with capability flags. Not strictly table stakes for an all-trusted team, but a cheap safety valve |
| **Automated flagging + admin queue** (listings with banned keywords, rapid signup, payment failures auto-enter a review queue) | The biggest single win at scale, and the natural v2 of this system. Turns moderation from "someone complained" to "the system surfaced this" | HIGH | **Explicitly deferred this milestone.** Requires flag-source taxonomy, queue UI, assignment model. Belongs to a later milestone once the audit + status foundation is live |

### Anti-Features (Do NOT Build This Milestone)

Features that sound reasonable, sometimes even get requested, but introduce harm, scope creep, or contradict the milestone's explicit decisions.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Shadow ban** (silently mute the user without their knowledge; their listings become invisible to others while they still see them) | "We don't want banned users to know they're banned so they don't create new accounts" | **Ethically and legally hostile at marketplace scale.** Users make real economic decisions (listing a car, paying for services) based on visibility they no longer have. Under DSA-style transparency regimes and general consumer-protection principles, silently degrading a paying user's reach while they believe the service is functioning is "black box gaslighting." Also creates a class of bugs where admins forget who is shadow-banned. A single-team operation has neither the ops maturity nor the legal cover to run this | Use the three explicit severity levels. Transparency is required; the banner is the whole point |
| **Automated bulk ban** across the admin user list | "Check a bunch of users and ban them all with one click" | Amplifies the blast radius of a single mistake to arbitrary scale. At a few dozen actions per week, the throughput gain is zero and the miscategorization risk is enormous. Also defeats the per-user confirm dialog that is table stakes | Bulk **selection** to open actions individually. If triage really needs batching, build a queue (deferred) — not a button |
| **Free-text-only reason** (no preset categories, just a textarea) | "Simpler to implement, more flexible" | Makes the audit log un-queryable. "How many fraud bans did we issue?" becomes an afternoon of grep. Also leads to inconsistent categorization across admins over time. Milestone decision in `.planning/PROJECT.md` is correct: preset + optional note | Preset picker with free-text note alongside. Already the chosen design |
| **Email / SMS / push notification on every moderation action** | "Users should be told immediately" | Pulls Twilio, email infra, and deliverability monitoring into a user-moderation milestone. Milestone explicitly defers this. In-app banner on next login covers the same outcome with a fraction of the surface area | In-app banner only. Revisit once email infra exists for other features |
| **Listing-level takedowns in this milestone** (pull a specific listing without touching the seller) | "Sometimes one listing is bad but the seller is fine" | Requires a whole second moderation surface (listing status model, listing audit log, listing banner). Milestone decision: suspending the seller indirectly hides their listings; single-listing moderation is a later milestone | Suspend the seller short-term, or revoke their seller role. Accept that single-listing moderation is a known gap |
| **Auto-cancel / auto-refund orders on suspension** | "A banned provider obviously can't fulfill orders" | Destructive side effects: a broker whose account got banned at 11pm still has a car delivery scheduled for 9am tomorrow with a paid buyer waiting. Auto-cancel lights real money on fire. Milestone decision: orders **pause**, admin manually decides per order | Pause in-flight orders. Buyer sees a status banner. Admin cancels manually if needed |
| **In-app appeal ticket system** | "If we block someone, we should let them appeal inside the app" | Ticketing infrastructure is its own multi-milestone feature (threads, SLAs, assignment, resolution codes, notification on reply). `support@carexmarket.com` handles this in the meantime | Email appeal via banner. Deferred |
| **Hard-delete the user record** (as opposed to delete the provider profile) | "GDPR says we have to delete" | Breaks referential integrity on past orders, payments, and audit history. Not what GDPR actually requires — anonymization of personal fields is acceptable. Milestone's design (delete provider profile only, anonymize seller reference on past orders) is the correct compromise | Keep the pattern: delete provider profile, anonymize seller reference on historical orders. Full-user deletion is a separate, rarely-exercised request path |
| **Reason-disclosure-only-to-admins** (user sees "your account is restricted" with no reason) | "Don't want users to argue about the reason" | Drives support emails up, not down. Creates the impression of arbitrary enforcement. Milestone decision: reason + note shown to user. Keep it | Reason + note visible to affected user. Admin controls what goes in the note |

## Feature Dependencies

```
                    ┌─────────────────────────┐
                    │  UserStatus model       │  (enum on user record)
                    │  active / feature_      │
                    │  limited / blocked /    │
                    │  permanently_banned     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
           ┌────────▼─────────┐     ┌─────────▼──────────┐
           │  Audit log       │     │  Enforcement       │
           │  collection      │     │  middleware on     │
           │  (who/when/      │     │  user endpoints    │
           │   what/why)      │     │                    │
           └────────┬─────────┘     └────────────────────┘
                    │                         ▲
                    │                         │
          ┌─────────┼─────────────────────────┤
          │         │                         │
┌─────────▼──┐ ┌────▼──────┐   ┌──────────────┴─────────┐
│ Admin      │ │ Unsuspend │   │ Affected-user banner   │
│ moderation │ │ / undo    │   │ (severity-aware,       │
│ actions    │ │           │   │  reason + appeal path) │
│ (suspend / │ │           │   │                        │
│  revoke /  │ │           │   └────────────────────────┘
│  delete /  │ │           │
│  edit)     │ │           │
└─────┬──────┘ └───────────┘
      │
      ├──────────────────┬────────────────────┬──────────────────┐
      │                  │                    │                  │
┌─────▼──────┐  ┌────────▼────────┐  ┌────────▼───────┐ ┌────────▼────────┐
│ Admin-only │  │ Reason picker + │  │ Per-user       │ │ Rate-limit /    │
│ server     │  │ optional note   │  │ history view   │ │ throttle on     │
│ enforce-   │  │                 │  │                │ │ admin actions   │
│ ment       │  │                 │  │                │ │                 │
└────────────┘  └─────────────────┘  └────────────────┘ └─────────────────┘
                                              │
                                              ▼
                                     ┌────────────────┐
                                     │ CSV export     │
                                     │ (reads audit)  │
                                     └────────────────┘

                (deferred to later milestone)
                 │
                 ▼
       ┌─────────────────────────┐
       │ Automated flagging +    │
       │ admin queue / SLA       │
       │ tracking                │
       └─────────────────────────┘
```

### Dependency Notes

- **`UserStatus` model is the keystone.** Every other feature — banner, enforcement, unsuspend, history filtering, the admin list's status column — reads this one field. It has to land in the first commit of the milestone. No UI work is safe before it exists.
- **Audit log is the second-most-fundamental dependency.** Every action must write an audit row. Undo/unsuspend works by *writing a new row*, never by mutating or deleting the original — that's what makes the log trustworthy. Reason picker, per-user history, and CSV export all read from this one collection.
- **Enforcement middleware depends on `UserStatus` and blocks every non-`active` user from write operations.** This is where the milestone's moderation becomes "real." Without it, the whole feature is cosmetic — a banned user could still list cars.
- **Affected-user banner depends on `UserStatus` + reason being readable by the user.** Requires audit collection to be queryable by `targetUid`, returning the most recent action.
- **Rate limit, CSV export, and pinned admin notes are leaves.** They depend on the foundation but nothing depends on them — can ship in any order after the foundation lands.
- **Smart search, saved filters, and handoff comments depend on the admin screens existing.** Pure UX polish on top of the admin panel — defer to the end of the milestone if time-boxed.
- **Automated flagging + queue is the natural v2** once this foundation exists. Flagged explicitly as out of scope this milestone; belongs to its own milestone later.

## MVP Definition

Calibrated to **this milestone's scope**, not a greenfield launch.

### Launch With (this milestone)

Everything below is table stakes. Missing any one of them means the feature isn't really shipped.

- [ ] `UserStatus` enum on user record (`active` / `feature_limited` / `blocked_with_review` / `permanently_banned`) with default `active` and migration
- [ ] `moderation_audit` collection with admin UID, timestamp, target UID, action, severity, reason category, optional note
- [ ] Four admin actions: Suspend (with severity), Revoke role, Delete provider profile, Edit provider profile — each with confirm dialog, preset reason, optional note
- [ ] Unsuspend action (writes new audit row; never mutates originals)
- [ ] Per-user audit history view in admin UI
- [ ] Admin user list with search (email, UID), filter by role and status, pagination
- [ ] Server-side admin enforcement on every moderation endpoint
- [ ] Server-side status enforcement middleware on all user write endpoints (listings, orders, contact-seller, etc.)
- [ ] Severity-aware affected-user banner with reason + note + appeal path (`support@carexmarket.com`)
- [ ] Read-only access to past orders preserved for suspended/banned users
- [ ] RU + EN i18n for all new admin and user-facing strings
- [ ] Order pause (not auto-cancel) when a provider is suspended
- [ ] Anonymized seller reference on past orders when provider profile is deleted

### Add After Validation (this milestone, time-permitting)

Nice differentiators that can land inside the same milestone if the foundation goes fast, or slip to a polish follow-up without blocking the release.

- [ ] Smart search (single box matches email / UID / phone)
- [ ] Saved filters in AsyncStorage
- [ ] Pinned admin note per user
- [ ] CSV export of audit log
- [ ] Rate limit on admin moderation actions per admin UID
- [ ] Admin-to-admin handoff comments on a user
- [ ] IP + device fingerprint captured on audit rows (disclose in privacy policy first)

### Future Consideration (next milestone+)

Defer hard.

- [ ] Automated flagging pipeline + admin queue
- [ ] Moderation SLA tracking dashboard
- [ ] Listing-level moderation (takedown a single listing without touching the seller)
- [ ] In-app appeal ticket system
- [ ] Email / push notifications on moderation events
- [ ] Tiered admin permissions (junior can suspend; senior must approve ban)
- [ ] Full-user hard-delete compliance workflow (GDPR erasure request path)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `UserStatus` model + migration | HIGH | LOW | P1 |
| Audit log collection | HIGH | LOW | P1 |
| Four core actions with confirm + reason | HIGH | MEDIUM | P1 |
| Unsuspend | HIGH | LOW | P1 |
| Per-user history view | HIGH | MEDIUM | P1 |
| Admin list: search + filter + pagination | HIGH | MEDIUM | P1 |
| Admin-only enforcement on moderation endpoints | HIGH | LOW | P1 |
| Status-enforcement middleware on user endpoints | HIGH | MEDIUM | P1 |
| Affected-user banner with reason + appeal | HIGH | MEDIUM | P1 |
| Order pause + anonymized-seller on past orders | HIGH | MEDIUM | P1 |
| RU + EN translations for all new strings | HIGH | LOW | P1 |
| Smart search (email / UID / phone one-box) | MEDIUM | MEDIUM | P2 |
| Saved filters | MEDIUM | LOW | P2 |
| Pinned admin note per user | MEDIUM | LOW | P2 |
| CSV export of audit log | MEDIUM | LOW | P2 |
| Rate limit on admin actions | MEDIUM | LOW | P2 |
| Admin-to-admin handoff comments | MEDIUM | MEDIUM | P2 |
| IP / device fingerprint on audit row | MEDIUM | MEDIUM | P2 |
| Tiered admin permissions | MEDIUM | MEDIUM | P3 |
| Automated flagging + queue | HIGH | HIGH | P3 (next milestone) |
| SLA tracking dashboard | LOW | MEDIUM | P3 (next milestone) |
| Listing-level moderation | MEDIUM | HIGH | P3 (later milestone) |
| In-app appeal ticketing | LOW | HIGH | P3 (later milestone) |
| Email / push notifications | MEDIUM | HIGH | P3 (later milestone) |

**Priority key:**
- P1: Must ship this milestone — part of the core moderation contract
- P2: Should ship this milestone if foundation goes cleanly, else slip to polish follow-up
- P3: Explicit next-milestone or later — do not expand scope

## Comparable-Platform Feature Analysis

| Feature | eBay Seller Hub | Facebook Marketplace | Turo Admin | CarEx Approach |
|---------|-----------------|----------------------|------------|---------------|
| Severity tiers | Yes (restriction / suspension / permanent) | Yes (warn / restrict / ban) | Yes (warning / hold / removal) | Three tiers: feature_limited / blocked_with_review / permanently_banned — **matches industry norm** |
| Reason shown to user | Yes (category + policy link) | Yes (category + policy link) | Yes (category + appeal link) | Preset category + optional admin note shown to user — **aligned; simpler than full policy link** |
| Appeal inside app | Yes | Yes | Yes | No — email-based appeal via `support@carexmarket.com`. **Deliberate simplification for milestone** |
| Audit trail | Yes (internal) | Yes (internal) | Yes (internal) | Yes, first-class, CSV-exportable — **aligned** |
| Shadow ban / silent limits | Historically yes (controversial) | Reportedly yes (denied publicly) | No public evidence | **Explicitly not built** — anti-feature |
| Automated flagging queue | Yes (at scale) | Yes (at scale) | Yes (moderate scale) | Deferred to next milestone — **right call for admin-team scale of 1–5** |
| Order / transaction handling on suspension | Holds funds, pauses in-flight | Removes listings, pauses in-flight | Pauses trips, manual refund | **Orders pause, not auto-cancel** — matches Turo; avoids destructive side effects |
| Role revocation preserving data | Yes (seller → buyer) | Limited | Yes (host → guest) | Revoke provider role, keep profile; separately delete profile with anonymized past-order reference — **aligned with norm** |

## Sources

Verified against current domain practice; marketplace-moderation conventions are stable and well-documented.

- [Marketplace Content Moderation Guide — GetStream](https://getstream.io/blog/marketplace-content-moderation/)
- [Content Moderation for Marketplaces & Ecommerce Platforms — Lasso](https://www.lassomoderation.com/industries/content-moderation-for-marketplaces-ecommerce/)
- [Content Moderation for Marketplaces: Basics — Markko](https://meetmarkko.com/knowledge/content-moderation-for-marketplaces-basics/)
- [What is an Admin Panel? The Complete Guide for 2026 — Refine](https://refine.dev/blog/what-is-an-admin-panel/)
- [User Role Management Guide for Marketplaces — Fleexy](https://fleexy.dev/blog/user-role-management-guide-for-marketplaces-2024/)
- [A Guide to Effective Content Moderation in Marketplaces — CometChat](https://www.cometchat.com/blog/marketplace-content-moderation)
- [An end to shadow banning? Transparency rights in the Digital Services Act — ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0267364923000018) — informs the shadow-ban anti-feature stance
- [Platform Visibility and Content Moderation: Algorithms, Shadow Bans & Governance — Medium/Adnan Masood](https://medium.com/@adnanmasood/platform-visibility-and-content-moderation-algorithms-shadow-bans-governance-3e50ab628d87)
- [Recognizing and responding to shadow bans — RJI](https://rjionline.org/news/recognizing-and-responding-to-shadow-bans/)
- `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/PROJECT.md` — milestone scope, constraints, decisions
- `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/codebase/ARCHITECTURE.md` — existing auth model, admin plumbing
- `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/codebase/STRUCTURE.md` — existing admin screens and services

---
*Feature research for: admin moderation on mobile car marketplace, post-approval user lifecycle*
*Researched: 2026-04-17*
