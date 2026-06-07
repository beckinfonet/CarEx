# Phase 12: Notification Domain + In-App Center - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Buyers can subscribe to inventory (**Saved Search**) and watch specific cars (**Watch**), then see relevant events in an in-app notification center — **entirely over REST, with zero native code**, so the center works standalone as the eventual denied-push fallback.

Scope is locked by `.planning/REQUIREMENTS.md` (24 requirements: NDOM-01..06, NSUB-01..04, NCEN-01..06, NPRF-01..05, NPRF-07, NI18N-01..03) and the approved design spec. This discussion covered **only the mobile UX placement decisions** that were genuinely open — the data model, after-commit emit hooks, guards, i18n approach, and cadence rules are already decided upstream and were NOT re-litigated.

**`fcm.send` ships as a no-op stub.** Push transport (native) is Phase 13; daily digest is Phase 14.

**Out of scope (deferred to later phases):** all native FCM/APNs work, the daily-digest worker + actual daily delivery, the contextual OS-push permission prompt (Phase 13 NPRF-06).

</domain>

<decisions>
## Implementation Decisions

All decisions below are USER-DECIDED unless marked otherwise.

### Watch control (vs. existing Favorite heart) — NSUB-02, NSUB-04, NCEN-06

- **D-01:** **Watch is a labeled bell button**, not an icon-only toggle. A `Bell` icon **with a text label** ("Watch" / RU "Отслеживать"), rendered as a distinct pill/button — explicitly separate from the icon-only red `Heart` favorite. This removes all ambiguity between the new server-side Watch subscription and the existing local-only Favorite. Sibling-component discipline (Phase 11 D-01/D-12): the Watch control is its own component, NOT a variant of the favorite heart.
- **D-02:** **Placement: below the hero image** on `CarDetailsScreen`, above the spec/details block — separated from the transactional CTA stack (Book it / Get services / Telegram / WhatsApp at `CarDetailsScreen.tsx:787-898`) and from the top-right icon action row (Report / Heart / Edit at `:612`). High visibility, clearly distinct from both existing affordance clusters.
- **D-03:** **Watching opts into all 4 events by default** (price-drop [decrease only], booked, sold, back-available [booked→active only]). One tap = "follow this car," lowest friction. Per-event opt-out toggles live in `NotificationSettingsScreen` (see D-10), NOT at watch time. The `Subscription.events: string[]` field is populated with all four on creation.
- **D-04:** Watch keys on `car._id || car.id || carId` — **never bare `car.id`** (project memory: bare `car.id` caused a silent prod booking-status bug). Re-affirmed from NSUB-04.

### Feed entry point + unread badge — NCEN-01, NCEN-02

- **D-05 [reinterprets NCEN-01]:** **No top-header bell, and NO new bottom navigator.** The app already has a persistent `BottomBar` (`src/components/BottomBar.tsx`: Home / Sell Car / **More**) mounted on `HomeScreenV2.tsx:328`. The notification entry point reuses this existing global nav: the **More** button is the entry, opening the existing `MoreMenu` bottom-sheet (`src/components/MoreMenu.tsx`). NCEN-01's "bell icon in the app header" is satisfied via this BottomBar/MoreMenu surface — which IS CarEx's de-facto global header/nav — not via a new top-of-screen header bell. **A global bottom-tab navigator was explicitly rejected as out-of-scope** (it would be an app-wide nav restructure = its own phase, and risks the "no breaking changes to existing flows" constraint).
- **D-06:** **Add a "Notifications" grid item to `MoreMenu`** (a `Bell` icon, following the existing grid-item pattern at `MoreMenu.tsx:31-41/76-89`) that navigates to the new `NotificationsScreen`. To avoid colliding with the settings entry (D-11), this feed item reads **"Notifications"**.
- **D-07:** **Badge split — red dot on More, count in menu.** The `BottomBar` **More** button shows a plain **red dot** when unread > 0 (clean, doesn't crowd the tab; visible while browsing Home since BottomBar mounts on HomeScreenV2). The precise **count badge, capped "9+"**, renders on the "Notifications" item *inside* the MoreMenu sheet. Badge derives from the unread count exposed by `NotificationContext`.

### "Notify me about new matches" save-search action — NCEN-06, NSUB-01, NSUB-03

- **D-08:** **Sticky bar above results.** A persistent "🔔 Notify me about new matches" bar/button pinned in the `SearchResultsV2` header area (near the FilterChipRow / result-count region, `SearchResultsV2.tsx:115-167`), visible whenever filters are active. This is THE conversion moment — keep it in view, not buried in the filter modal.
- **D-09:** **One-tap + toast.** Tapping instantly creates the Saved Search from the currently-applied filter criteria (make/model + price/year/body) with **instant** cadence (the locked default), then shows a confirmation toast ("We'll alert you about new matches") with an **Undo** affordance. No confirm sheet at the conversion moment — naming/cadence editing happens later in settings.
- **D-10 [resolves roadmap tension]:** **Cadence selector = Instant selected, Daily shown-but-disabled.** Daily-digest delivery does not exist until Phase 14, so in Phase 12 the instant/daily selector (which lives in subscription edit within `NotificationSettingsScreen`) renders **Instant as selected and Daily greyed-out with a "coming soon" hint**. No buyer can pick a Daily cadence that won't deliver. Phase 14 simply **enables** the existing Daily option (matches ROADMAP Phase 14's "enables the daily-cadence selector shipped disabled in Phase 12"). The `Subscription.cadence` field exists and defaults to `instant`.

### Settings + subscription management structure — NPRF-01, NPRF-02

- **D-11:** **Single `NotificationSettingsScreen`** containing, in order: master mute, per-category toggles (saved-search / watch), quiet-hours controls (plumbing only — delivery is Phase 14), then a **"My saved searches"** list and a **"My watched cars"** list, each row editable (cadence for saved searches, per-event toggles for watches per D-03) and deletable inline. Subscription management is NOT split into a separate screen (matches NPRF-01/02 as written; revisit only if lists grow unwieldy).
- **D-12:** **Reached via a "Notifications" row in `ProfileScreen`** (Bell + ChevronRight, following the existing menu-row pattern at `ProfileScreen.tsx:141-150`). To disambiguate from the MoreMenu feed entry (D-06), this settings row reads **"Notification settings"** (RU equivalent). So: MoreMenu "Notifications" → feed; ProfileScreen "Notification settings" → `NotificationSettingsScreen`.

### Claude's Discretion (planner / UI-phase may decide without re-asking)

- **D-13:** Exact RU/EN label strings, icon sizing, toast component choice, and the visual treatment of the sticky save-search bar — within the constraints above. All new user-facing strings must be added to `translations.ts` with RU+EN parity (enforced by the jest parity scanner).
- **D-14:** Empty-state copy for `NotificationsScreen` (NCEN-05) — research suggests "Save a search or watch a car to get alerts"; planner finalizes wording per RU-first tone (see audience-tone memory).
- **D-15:** Notification feed-item appearance (per-category icons, read/unread styling per NCEN-04, day grouping if cheap) — UI-phase detail; reverse-chron + base64 `{createdAt,_id}` cursor pagination is locked by NCEN-02.
- **D-16:** Quiet-hours default values and the soft daily-cap (2–3/day) default — plumbing lands in Phase 12, delivery in Phase 14; planner may pick sensible defaults (research: quiet-hours seeded from the existing device-timezone→city signal; no GPS, no per-user TZ field).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements & design (read first)
- `.planning/REQUIREMENTS.md` — the 24 Phase-12 requirements (NDOM/NSUB/NCEN/NPRF/NI18N) + Out-of-Scope table. Authoritative on WHAT to build.
- `docs/superpowers/specs/2026-06-06-notifications-system-design.md` — approved design: 3-model data model + indexes, event→hook table, send pipeline, i18n approach, mobile surfaces, phasing. Authoritative on the domain architecture.
- `.planning/research/v1.2/SUMMARY.md` — HIGH-confidence research synthesis. Key refinements that OVERRIDE looser spec wording: instant-is-default cadence; `notificationService.emit()` after-commit (NOT post-save hooks); hide-hook respect by OMITTING bypass flags; `firebase-admin@13.8.0` already installed (do NOT add `google-auth-library`); `User.language` + `LanguageContext` persistence are NEW work; `yearMax` added to criteria; zero new mobile packages in Phase 12.
- `.planning/ROADMAP.md` §"Phase 12" — the 5 success criteria (the verification target).

### Prior-phase patterns to follow
- `.planning/phases/11-buyer-affected-ux-quality-security-review/11-CONTEXT.md` — sibling-component discipline (D-01/D-12), RU/EN parity scanner pattern, base64 cursor.
- `.planning/phases/09-backend-read-time-toctou-enforcement/09-CONTEXT.md` — hide-hook + TOCTOU contract the emit guards must respect.
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/ARCHITECTURE.md` — context/hook provider pattern, service-split precedent (`ModerationService`), translations conventions.

### Backend (sibling repo)
- Backend lives at `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` (NOT in this repo). New `src/notifications/` dir mirrors `src/moderation/`. Railway deploys backend `main` — watch the split-repo deploy gotcha.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`BottomBar.tsx` + `MoreMenu.tsx`** — the existing global nav surface; the notification feed entry hangs off these (D-05/D-06/D-07). MoreMenu uses a grid-item pattern (`MoreMenu.tsx:76-89`); add the Notifications item there.
- **`ProfileScreen.tsx:141-150`** — settings menu-row pattern (icon + title + ChevronRight); the "Notification settings" row reuses it (D-12).
- **`FavoritesContext.tsx`** — the local-favorite pattern; `NotificationContext` mirrors the provider+hook+auto-clear-on-uid-change shape (like `CartContext`), but is server-backed.
- **`SearchResultsV2.tsx:115-167`** — results header / FilterChipRow region where the sticky save-search bar mounts (D-08). `useHomeListings` holds `activeFilters` (the criteria to capture).
- **`CarDetailsScreen.tsx`** — hero/title block (Watch button mounts below it, D-02); existing heart at `:612`, CTA stack `:787-898`.
- **base64 `{createdAt,_id}` cursor** (house pattern from v1.1) — reused for the feed (NCEN-02).
- **jest parity scanner** (`__tests__/translation-parity.test.ts`, `moderation-literals.test.ts`) — extend to cover new notification strings (RU/EN parity, KGS som).

### Established Patterns
- **Service split, NOT AuthService bloat:** new mobile `NotificationService.ts` follows the `ModerationService` precedent (do NOT bolt onto `AuthService.ts`).
- **Provider stack order** (`App.tsx`): insert `NotificationProvider` where it can `useAuth` (after AuthProvider; research suggests after FavoritesProvider). Register `NotificationsScreen` + `NotificationSettingsScreen` in the Stack.Navigator and `RootStackParamList` (`src/types/navigation.ts`).
- **Single native stack navigator** — no tab navigator exists; do not introduce one (D-05).
- **emit after commit, not post-save hooks** — backend guards: hide-hook by omitting bypass flags, actor-exclusion, dedup per `(uid, carId, eventType)`.

### Integration Points
- Mobile: `MoreMenu` (feed entry + badge), `BottomBar` (red dot), `ProfileScreen` (settings row), `CarDetailsScreen` (Watch button), `SearchResultsV2`/`HomeScreenV2`/`FilterModal` (save-search bar), `LanguageContext` (persist `language` to backend + AsyncStorage), `App.tsx` + `navigation.ts` (new provider + screens).
- Backend (sibling repo): 3 new models, `/api/notifications/*` router (uid from verified token, NOT admin-gated), `notificationService.emit()` at 6 trigger points, `matchSavedSearches` pure module, backend `translations.js` (RU/EN parity test), `User.language` field + `PUT /api/users/:uid` extension, `fcm.send` no-op stub.

</code_context>

<specifics>
## Specific Ideas

- The user thinks of the `BottomBar` (Home / Sell Car / More) as the app's "bottom navigator" — the notification entry must live there (More → red dot → MoreMenu → Notifications), matching that mental model. Honor it; do not relocate to a top-header bell.
- Watch must be unmistakably different from the Favorite heart — the user wants a **labeled** control, not another icon in the heart's row.
- Conversion is king for save-search: one tap, instant, toast-with-undo — no friction sheet at the moment of intent.

</specifics>

<deferred>
## Deferred Ideas

- **Global bottom-tab navigator** — the user described the existing `BottomBar` as a "bottom navigator." A *true* tab navigator (with the More tab carrying the badge) was discussed and explicitly deferred: it's an app-wide navigation restructure (its own phase), not part of Phase 12. Current approach reuses the existing BottomBar/MoreMenu instead. (Capture for a future nav-overhaul phase if desired.)
- Per-event opt-out granularity beyond settings, confirm-sheet save flow, day-grouping/swipe-dismiss in the feed — all noted as v2 / nice-to-have (NOTF2 backlog already tracks feed differentiators).

None of the above blocks Phase 12.

</deferred>

---

*Phase: 12-notification-domain-in-app-center*
*Context gathered: 2026-06-06*
