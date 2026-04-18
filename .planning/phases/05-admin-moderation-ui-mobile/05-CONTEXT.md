# Phase 5: Admin Moderation UI (Mobile) - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the admin-facing mobile UI for moderating approved users: per-row quick actions on a repurposed users list screen, and a new dedicated moderation screen with search, role/state filters, paginated results, per-user detail panel with full audit history, and an unsuspend action.

**In scope:**
- Repurposing `AdminManagementScreen` from admin-roster to approved-users roster (with "Admins only" filter chip preserving today's use)
- A new `AdminModerationScreen` (search, filter, paginated list)
- A new `AdminUserDetailScreen` (user summary + moderation history + unsuspend CTA)
- A shared `ModerationActionModal` component driving all 5 admin actions (suspend / unsuspend / revoke role / delete profile / edit profile)
- A shared `TypedConfirmationModal` component for destructive actions
- Backend endpoints required for the UI: `GET /api/admin/moderation/:targetUid/history` + `GET /api/admin/users/search?q=&role=&state=&page=`
- RU + EN translation keys for every new user-facing string

**Out of scope (deferred to later phases):**
- Affected-user UX: `UserStatusBanner`, `FeatureGateOverlay`, reason-category display on restricted screens (Phase 6)
- Translation audit, 10k-user load test, security review (Phase 6)
- Superadmin-only gating of specific actions — all admins treated equal for this milestone

</domain>

<decisions>
## Implementation Decisions

### Area 1 — Quick-action trigger UX on AdminManagementScreen

- **D-01:** Trailing icon per row → bottom action sheet with the 5 actions. Icon choice (`MoreVertical` / `Shield` / `MoreHorizontal`) is Claude's discretion during planning. Row tap itself is reserved for opening the user's detail view once `AdminUserDetailScreen` is wired.
- **D-02:** Row-level colored severity badge (small pill next to email) derived from `user.moderationStatus.state`:
  - `active` → green
  - `feature_limited` → amber
  - `blocked_with_review` → red
  - `permanently_banned` → black (or dark neutral)
- **D-03:** Repurpose `AdminManagementScreen` to list **all approved users**, not just admins. Add an "Admins only" filter chip preserving the current admin-roster use case. This resolves the UI-01 literal-reading ambiguity (admins are rarely moderation targets). Rename of file/route is Claude's discretion during planning — if renamed, update `RootStackParamList` and navigation entry points; otherwise keep the filename and widen the data source.
- **D-04:** Destructive actions (**Delete provider profile**, **Revoke role**, **Suspend at `permanently_banned`**) require a `TypedConfirmationModal` — the admin must type a sentinel string (user's email or literal like `DELETE`; exact sentinel is Claude's discretion) before the Confirm button enables. Non-destructive actions (Unsuspend, Suspend at `feature_limited` / `blocked_with_review`, Edit profile) rely on the single Confirm gate inside `ModerationActionModal`.

### Area 2 — Moderation action modal shape

- **D-05:** **One generic** `ModerationActionModal` component, not five. Props shape: `{ action, targetUser, onSubmit, onClose, visible }`. Field set is conditional on `action`:
  - `suspend` → severity + reason + note
  - `unsuspend` → optional note only
  - `revoke_role` → role picker + reason + optional note
  - `delete_profile` → renders inside a TypedConfirmationModal (typed sentinel flow)
  - `edit_profile` → field form (broker vs logistics field set differs — service-layer bodyShape types already expose both)
- **D-06:** **Single-sheet** modal (not wizard, not inline-expanding). All fields visible in one scroll inside the modal body. Confirm / Cancel at bottom.
- **D-07:** Severity picker renders as **three tappable radio cards** stacked vertically. Each card shows: title, one-line description, and a capability preview line ("User can browse but cannot list, order, or message"). Picks from the Phase 1 `STATUS_POLICY` capability map so the preview is authoritative, not hard-coded strings.
- **D-08:** **Optimistic update with rollback**. On Confirm: close modal → flip the row badge immediately → fire the API call. On API error: revert the badge + show `Alert.alert` with the error message (use `ModerationError.reasonCategory` / `note` if the error is a backend validation error like `last_admin_protected` or `cannot_moderate_self`).

### Area 3 — AdminModerationScreen list → detail navigation

- **D-09:** **Push `AdminUserDetailScreen`** on row tap. Stack-nav pattern matching `CarDetails` / `ServiceDetails`. `RootStackParamList` gets a new entry `AdminUserDetail: { targetUid: string }`.
- **D-10:** **Live debounced search**, 300ms debounce. Typing in the search bar cancels the prior request (axios cancel token) and fires a new `GET /api/admin/users/search?q=...` after the debounce window. Search matches email substring AND Firebase UID prefix server-side.
- **D-11:** **Horizontal scrollable chip row** under the search bar for role + state filters. Two chip groups:
  - Role: `[All | Buyer | Seller | Broker | Logistics | Admin]`
  - State: `[All | Active | Feature-limited | Blocked | Banned]`
  Filters are additive (AND across groups). Selected chip is filled; tap to toggle.
- **D-12:** **Infinite scroll** via `FlatList onEndReached`. Page size = Claude's discretion during planning (suggest 25). `RefreshControl` for pull-to-refresh at the top. Loading footer renders `ActivityIndicator` below the list while next page fetches.

### Area 4 — Moderation history visual treatment

- **D-13:** **Card list with severity-accented left border**. Each card shows:
  - Top row: action name + severity badge (reuses D-02's color scheme)
  - Meta row: admin email + absolute timestamp (`YYYY-MM-DD HH:mm`)
  - Reason row: reason category as a small filled chip
  - Note row: free-text note (if present), italicized
- **D-14:** **Sticky header summary card** above the history list on `AdminUserDetailScreen`, containing:
  - User email + role badges
  - Current moderation state badge (D-02)
  - **Unsuspend button** (visible only when `moderationStatus.state !== 'active'`) — tapping opens `ModerationActionModal` in `unsuspend` mode
- **D-15:** **Flat list** of history entries, most recent first, with absolute timestamps. No relative-date section grouping (Today / Yesterday / Older). Suitable for the ≤few-entries-per-user common case.

### Scope decision

- **D-16:** Phase 5 ships **two backend endpoints** alongside the mobile UI:
  1. `GET /api/admin/moderation/:targetUid/history?limit=&cursor=` — returns `ModerationAction` rows for target, most recent first, paginated (cursor-based). Admin-only (existing `requireAdmin` middleware).
  2. `GET /api/admin/users/search?q=&role=&state=&page=&limit=` — returns matching users for the admin search/filter UI. Admin-only.
  Both endpoints use the Phase 2 pattern (`requireAdmin`, rate-limited, typed responses). Phase 5 plan will include backend plans for these two routes plus mobile plans that consume them.

### Claude's Discretion

- Exact trailing-icon glyph on user rows (`MoreVertical` / `Shield` / `MoreHorizontal` / `ChevronRight`)
- Page size for search + history pagination (25 suggested)
- Severity badge exact color tokens — may extend `src/constants/theme.ts` `COLORS` if the palette lacks amber/red
- Typed-confirmation sentinel: target user's email vs literal `DELETE` vs target UID (whichever balances safety and admin ergonomics)
- Animation timings, skeleton loading vs ActivityIndicator, empty-state copy + icon, search-bar placement (in header vs above list), keyboard-avoidance behavior inside modals
- Whether `AdminManagementScreen` is renamed to `AdminUsersScreen` or kept under the same name with widened scope (affects `RootStackParamList` + navigator entries)
- Exact cursor/offset shape for pagination endpoints (align with existing admin endpoints if a convention exists)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + requirements
- `.planning/PROJECT.md` — Admin moderation milestone spec, Core Value, Key Decisions
- `.planning/REQUIREMENTS.md` — UI-01..04 traceability, constraints, QUAL-01 i18n rule
- `.planning/ROADMAP.md` §Phase 5 — goal + 4 ROADMAP success criteria (see `**Phase 5: Admin Moderation UI (Mobile)**`)

### Prior phase contracts this UI consumes
- `.planning/phases/02-admin-moderation-endpoints-backend/02-CONTEXT.md` — backend moderation endpoint shapes, error envelope, rate-limit, last-admin + cannot-moderate-self guards
- `.planning/phases/02-admin-moderation-endpoints-backend/02-*-SUMMARY.md` — actual shipped endpoint request/response bodies (suspend/unsuspend/revoke/delete/edit)
- `.planning/phases/04-mobile-plumbing-mobile/04-CONTEXT.md` — `ModerationService` API, `ModerationError` shape, 403 interceptor + refresh flow, AppState refresh, `_skipModerationInterceptor` loop-guard
- `.planning/phases/04-mobile-plumbing-mobile/04-02-SUMMARY.md` — concrete `ModerationService` method signatures (6 admin + `getHistory` stub)
- `.planning/phases/04-mobile-plumbing-mobile/04-04-SUMMARY.md` — `AuthContext` refreshUser + force variant + generation counter
- `.planning/phases/04-mobile-plumbing-mobile/04-REVIEW.md` + `04-REVIEW-FIX.md` — known mobile-plumbing invariants to preserve

### Source files being modified or consumed
- `src/screens/AdminManagementScreen.tsx` — existing screen, being repurposed per D-03
- `src/screens/AdminDashboardScreen.tsx` — entry point; new nav to `AdminModerationScreen`
- `src/services/moderation/ModerationService.ts` — extend with `getHistory` real implementation + new `searchUsers` method
- `src/services/moderation/errors.ts` — `ModerationError` used for typed error UX in action modal
- `src/context/AuthContext.tsx` — `isAdmin` / `adminRole` gate + `refreshUser` for post-action state
- `src/constants/theme.ts` — `COLORS` + `SIZES` tokens; may extend with severity palette
- `src/constants/translations.ts` — every new user-facing string added here under RU + EN
- `src/types/navigation.ts` — add `AdminModerationScreen` + `AdminUserDetailScreen` routes to `RootStackParamList`
- `src/components/FilterBar.tsx` (if exists) — analog chip-filter pattern to mirror
- `src/components/OfflineNotice.tsx` — analog for "wrapper component inside Provider" pattern (for any context-dependent sub-component)

### Backend-side contracts Phase 5 creates
- `backend-services/carEx-services/src/moderation/router.js` (extend) — new `GET /api/admin/moderation/:targetUid/history` route
- `backend-services/carEx-services/src/admin/router.js` (extend) — new `GET /api/admin/users/search` route
- Both routes reuse Phase 1 `requireAdmin` + Phase 2 rate-limiter middleware

### CarEx project conventions
- `CLAUDE.md` — project instructions (provider stack order, `AuthService` scope, i18n pattern, naming conventions)
- `.planning/codebase/` — if present, project architecture maps

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`AdminManagementScreen.tsx`** — existing FlatList + Modal + Alert.alert pattern; directly repurposed and widened (D-03). Code patterns (`RefreshControl`, modal state, confirm handlers) port directly to `AdminModerationScreen`.
- **`ModerationService` (Phase 4)** — 6 admin write methods already live. Phase 5 extends with:
  1. Wire `getHistory` to the new backend route (replace stub)
  2. Add `searchUsers(q, role, state, page, limit)` calling the new `GET /api/admin/users/search`
- **`ModerationError` (Phase 4)** — typed 403 / validation errors. Action modal catches this and maps `code`/`reasonCategory`/`note` to user-facing `Alert`.
- **`AuthContext.refreshUser({ force: true })` (Phase 4 fix WR-01)** — call after any moderation action against the **current admin's own row** (edge case: admin can edit their own profile fields via edit_profile). Normal case: refresh target user's state in context only if target === current user.
- **lucide-react-native icons already in use**: `Shield`, `ShieldCheck`, `ArrowLeft`, `Plus`, `Trash2`, `X`. Phase 5 likely adds `ShieldAlert`, `ShieldOff`, `MoreVertical`, `Search`, `Filter`, `Check`.
- **`useLanguage()` + `translations.ts`** — every string goes here under RU + EN.
- **`useAuth()`** — `isAdmin`, `adminRole`, `user.localId` gate + current admin identity for audit writes.
- **`COLORS` / `SIZES` theme tokens** — severity palette may extend these.

### Established Patterns

- **One file per screen** in `src/screens/`, PascalCase + `Screen` suffix. Default or named export.
- **Inline `StyleSheet.create()` at bottom of each component file**.
- **Modal pattern** (see `AdminManagementScreen.handleAdd`): `Modal` visible state + `TextInput` + `TouchableOpacity` Confirm/Cancel.
- **Destructive confirmation via `Alert.alert`** (see `AdminManagementScreen.handleRemove`) — Phase 5 replaces this specifically for destructive moderation actions with `TypedConfirmationModal` (per D-04), while non-destructive stays on Alert.
- **List screens**: `useState` + `useCallback` + `useEffect` trio; `FlatList` + `RefreshControl` + `ActivityIndicator` as loading footer.
- **RU-first translations**: default language is RU; EN parity mandatory.
- **Firebase UID as primary key** (`user.localId`) for all backend references (target, caller, admin audit writes).

### Integration Points

- **Navigation**: `App.tsx` → `RootStackParamList` in `src/types/navigation.ts` gets two new routes:
  - `AdminModerationScreen` — no params
  - `AdminUserDetailScreen` — `{ targetUid: string }` param
- **Entry from AdminDashboardScreen**: add a new navigation card / button → `AdminModerationScreen`
- **ModerationService extensions**: `getHistory(targetUid, { limit, cursor })` and `searchUsers({ q, role, state, page, limit })` added to the existing service. Both return typed responses — define response shapes in `src/services/moderation/types.ts` (or inline) and export.
- **Backend router mounts**: history route inside `src/moderation/router.js`; search route inside `src/admin/router.js` (or its equivalent) — reuses existing `requireAdmin` middleware.

</code_context>

<specifics>
## Specific Ideas

- Severity badge colors should be consistent across the moderation UI AND the future Phase 6 `UserStatusBanner` — define them once in `COLORS.moderation.{active,featureLimited,blockedReview,permaBanned}` so Phase 6 just imports.
- Typed-confirmation sentinel pattern: the user's email (trimmed + lowercased) is likely the right choice — memorable by the admin, tied to the target, and naturally varies between actions. Claude's discretion confirms during planning.
- Action-sheet menu should show **disabled states** for impossible actions (e.g., "Unsuspend" only enabled if target is suspended; "Delete provider profile" only enabled if target has a broker or logistics profile). This pre-gates obvious invalid actions without a roundtrip.
- The sticky header card on `AdminUserDetailScreen` should show the **count of history entries** as a subtle pill ("12 actions") so admins gauge moderation activity at a glance before scrolling.

</specifics>

<deferred>
## Deferred Ideas

- **Superadmin-only gating of specific actions** — discussed in Phase 4 code review (out of scope there); not part of this milestone. All admins treated equal for now.
- **Offline queueing of moderation actions** — no in-flight queue when admin is offline; show a clear error and defer. Future enhancement.
- **Moderator handoff notes / pinned notes per user** — tracked in v2 requirements (MOD2-05).
- **Bulk selection with per-row confirm** — tracked in v2 requirements (MOD2-03).
- **Empty-state illustrations and copy polish** — Claude's discretion in planning; polish can wait until post-ship feedback.

</deferred>

---

*Phase: 05-admin-moderation-ui-mobile*
*Context gathered: 2026-04-18*
