# Phase 5: Admin Moderation UI (Mobile) - Research

**Researched:** 2026-04-18
**Domain:** React Native 0.83 admin moderation UI — list-row quick actions + new search/history/unsuspend screens, consuming the `ModerationService` surface shipped in Phase 4
**Confidence:** HIGH (codebase analogs found for all 11 areas; ModerationService + ModerationError shipped and verified; UI-SPEC locked; CONTEXT.md locked 16 decisions)

## Summary

Phase 5 is **pure mobile UI** that wires admin actions to the already-shipped `ModerationService` (Phase 4) and two new backend read endpoints (history + user-search). Every runtime primitive is in place: the shared `apiClient` with Bearer injection and 403 `account_suspended` → `ModerationError` normalization, the deduped+cooldown-guarded `AuthContext.refreshUser`, the `useAppStateRefresh` foreground hook, and all six admin write methods on `ModerationService`. What Phase 5 must build is UI surface area plus two new service methods (`getHistory` — currently a throwing stub at `ModerationService.ts:176`; `searchUsers` — does not yet exist).

Codebase analog coverage is **exact** for the screen/list/modal patterns: `AdminManagementScreen.tsx` is the closest cousin for the repurposed screen (it already uses `FlatList` + `RefreshControl` + `Modal` + `Alert.alert` + in-screen state); `AdminDashboardScreen.tsx` shows the tab-filter pattern that maps directly onto role/state filter chips; `FilterModal.tsx` demonstrates the option-pill picker pattern that the Severity + Reason pickers will mirror; `ServiceApplicationScreen.tsx` already imports `KeyboardAvoidingView` for modal-with-input flows. **No debounce utility exists in the codebase** — Phase 5 must create a trivial `useDebouncedValue` hook (flagged below). **No pagination analog exists** — the existing `HomeScreen.fetchCars` fetches everything at once; Phase 5 introduces the first `FlatList.onEndReached` infinite-scroll pattern in the repo.

**Primary recommendation:** Follow the `AdminManagementScreen` / `AdminDashboardScreen` pattern verbatim for the three new screens (`AdminModerationScreen`, `AdminUserDetailScreen`, and the repurposed `AdminManagementScreen`). The only new patterns Phase 5 must introduce are (1) `useDebouncedValue` hook for search (15-line utility), (2) cursor-paginated `FlatList.onEndReached` wiring, (3) a shared `ModerationActionModal` component that drives all 5 admin actions via conditional field rendering, and (4) a `TypedConfirmationModal` primitive for destructive actions. All four stay within the CLAUDE.md constraint of "no new state-management or networking libs" — they're pure RN primitives + refs + `useCallback`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1 — Quick-action trigger UX on AdminManagementScreen**

- **D-01:** Trailing icon per row → bottom action sheet with the 5 actions. Icon choice (`MoreVertical` / `Shield` / `MoreHorizontal`) is Claude's discretion during planning. Row tap itself is reserved for opening the user's detail view once `AdminUserDetailScreen` is wired.
- **D-02:** Row-level colored severity badge (small pill next to email) derived from `user.moderationStatus.state`:
  - `active` → green
  - `feature_limited` → amber
  - `blocked_with_review` → red
  - `permanently_banned` → black (or dark neutral)
- **D-03:** Repurpose `AdminManagementScreen` to list **all approved users**, not just admins. Add an "Admins only" filter chip preserving the current admin-roster use case. This resolves the UI-01 literal-reading ambiguity (admins are rarely moderation targets). Rename of file/route is Claude's discretion during planning — if renamed, update `RootStackParamList` and navigation entry points; otherwise keep the filename and widen the data source.
- **D-04:** Destructive actions (**Delete provider profile**, **Revoke role**, **Suspend at `permanently_banned`**) require a `TypedConfirmationModal` — the admin must type a sentinel string (user's email or literal like `DELETE`; exact sentinel is Claude's discretion) before the Confirm button enables. Non-destructive actions (Unsuspend, Suspend at `feature_limited` / `blocked_with_review`, Edit profile) rely on the single Confirm gate inside `ModerationActionModal`.

**Area 2 — Moderation action modal shape**

- **D-05:** **One generic** `ModerationActionModal` component, not five. Props shape: `{ action, targetUser, onSubmit, onClose, visible }`. Field set is conditional on `action`:
  - `suspend` → severity + reason + note
  - `unsuspend` → optional note only
  - `revoke_role` → role picker + reason + optional note
  - `delete_profile` → renders inside a TypedConfirmationModal (typed sentinel flow)
  - `edit_profile` → field form (broker vs logistics field set differs — service-layer bodyShape types already expose both)
- **D-06:** **Single-sheet** modal (not wizard, not inline-expanding). All fields visible in one scroll inside the modal body. Confirm / Cancel at bottom.
- **D-07:** Severity picker renders as **three tappable radio cards** stacked vertically. Each card shows: title, one-line description, and a capability preview line. Picks from the Phase 1 `STATUS_POLICY` capability map so the preview is authoritative.
- **D-08:** **Optimistic update with rollback**. On Confirm: close modal → flip the row badge immediately → fire the API call. On API error: revert the badge + show `Alert.alert` with the error message (use `ModerationError.reasonCategory` / `note` if the error is a backend validation error like `last_admin_protected` or `cannot_moderate_self`).

**Area 3 — AdminModerationScreen list → detail navigation**

- **D-09:** **Push `AdminUserDetailScreen`** on row tap. Stack-nav pattern matching `CarDetails` / `ServiceDetails`. `RootStackParamList` gets a new entry `AdminUserDetail: { targetUid: string }`.
- **D-10:** **Live debounced search**, 300ms debounce. Typing in the search bar cancels the prior request (axios cancel token) and fires a new `GET /api/admin/users/search?q=...` after the debounce window. Search matches email substring AND Firebase UID prefix server-side.
- **D-11:** **Horizontal scrollable chip row** under the search bar for role + state filters. Two chip groups (Role / State). Filters are additive (AND across groups). Selected chip is filled; tap to toggle.
- **D-12:** **Infinite scroll** via `FlatList onEndReached`. Page size = Claude's discretion during planning (suggest 25). `RefreshControl` for pull-to-refresh at the top. Loading footer renders `ActivityIndicator` below the list while next page fetches.

**Area 4 — Moderation history visual treatment**

- **D-13:** **Card list with severity-accented left border**. Each card shows action name + severity badge (top), admin email + absolute timestamp (meta), reason category chip, optional italic note.
- **D-14:** **Sticky header summary card** above history list on `AdminUserDetailScreen` — user email + role badges + current state badge + Unsuspend button (visible only when `moderationStatus.state !== 'active'`).
- **D-15:** **Flat list** of history entries, most recent first, with absolute timestamps. No relative-date section grouping.

**Scope**

- **D-16:** Phase 5 ships **two backend endpoints** alongside the mobile UI:
  1. `GET /api/admin/moderation/:targetUid/history?limit=&cursor=` — `ModerationAction` rows, most recent first, cursor-paginated, admin-only
  2. `GET /api/admin/users/search?q=&role=&state=&page=&limit=` — search+filter users for the moderation screen, admin-only
  Both reuse Phase 1 `requireAdmin` + Phase 2 rate-limiter middleware.

### Claude's Discretion

- Exact trailing-icon glyph on user rows (`MoreVertical` / `Shield` / `MoreHorizontal` / `ChevronRight`)
- Page size for search + history pagination (25 suggested)
- Severity badge exact color tokens — may extend `src/constants/theme.ts` `COLORS` if palette lacks amber/red (UI-SPEC locks these; see Palette table below)
- Typed-confirmation sentinel: target user's email vs literal `DELETE` vs target UID (UI-SPEC locks this to target user's email, lowercased + trimmed)
- Animation timings, skeleton loading vs ActivityIndicator, empty-state copy + icon, search-bar placement, keyboard-avoidance behavior inside modals
- Whether `AdminManagementScreen` is renamed to `AdminUsersScreen` or kept under the same name with widened scope (affects `RootStackParamList` + navigator entries)
- Exact cursor/offset shape for pagination endpoints (align with existing admin endpoints if a convention exists)

### Deferred Ideas (OUT OF SCOPE)

- **Superadmin-only gating of specific actions** — all admins treated equal for this milestone.
- **Offline queueing of moderation actions** — show a clear error and defer.
- **Moderator handoff notes / pinned notes per user** — v2 (MOD2-05).
- **Bulk selection with per-row confirm** — v2 (MOD2-03).
- **Empty-state illustrations and copy polish** — discretion during planning; polish can wait until post-ship feedback.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | `AdminManagementScreen` gains per-row quick-action menu on every approved user: Suspend / Unsuspend / Revoke role / Delete profile / Edit profile. Action triggers a modal with severity + preset-reason picker + optional note. | Analog: `AdminManagementScreen.renderAdmin` row shape (line 105) + `FilterModal.tsx` option-pill pattern. Actions map to `ModerationService.{suspend,unsuspend,revokeRole,deleteProviderProfile,editProviderProfile}` (signatures listed below). Backend behind `POST /api/admin/moderation/*` routes shipped in Phase 2. |
| UI-02 | New `AdminModerationScreen` provides search by email / Firebase UID, filter by role and moderation state, paginated list of users, per-user detail panel. | Requires new backend endpoint `GET /api/admin/users/search` (D-16.2). No pagination analog exists in codebase — Phase 5 introduces first `FlatList.onEndReached`. Tab-filter analog: `AdminDashboardScreen.tsx:245-261` (activeTab pattern). |
| UI-03 | Per-user detail panel shows full moderation history (every `ModerationAction` row for that user, most recent first) with action type, severity, admin who acted, timestamp, reason category, note. | Requires new backend endpoint `GET /api/admin/moderation/:targetUid/history` (D-16.1) + wiring `ModerationService.getHistory` from throwing stub (`ModerationService.ts:176`) to real `apiClient.get`. Timestamp format prescribed `YYYY-MM-DD HH:mm` (UI-SPEC). Card analog: `AdminDashboardScreen.tsx` card shape. |
| UI-04 | Admin can unsuspend a user directly from the moderation history view; the unsuspend action writes a new audit entry (history is never edited). | `ModerationService.unsuspend(targetUid, body?)` already shipped. Sticky summary card in `AdminUserDetailScreen` shows Unsuspend button only when `moderationStatus.state !== 'active'` (UI-SPEC §Component 3). On success, append new audit row to local history state (optimistic) then re-fetch or re-request to reconcile. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives that shape Phase 5 decisions:

- **Tech stack discipline:** React Native 0.83 + TypeScript + axios + AsyncStorage. **Do not introduce new state-management or networking libs.** `react-native-bottom-sheet` or similar is out — use stock `Modal` with `animationType="slide"`.
- **`AuthService.ts` scope:** Extend existing `AuthService.ts` OR split sensibly — **do NOT rewrite wholesale**. Phase 4 already introduced `ModerationService` as a separate module; Phase 5 extends ModerationService (wire `getHistory`, add `searchUsers`), not AuthService. The MOB-01 grep guardrail remains: `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` must stay at **0**.
- **Auth enforcement:** Admin-only endpoints validate server-side on every request — mobile `isAdmin` is UX gating only, never authorization truth.
- **Data preservation:** Suspending/revoking must never destroy order history. Delete-profile hard-deletes only the provider profile record; `Order.providerSnapshot` keeps past orders intact.
- **Order safety:** In-flight orders touching a suspended provider are *paused*, not auto-cancelled. UI must reflect this (out of scope for Phase 5's moderation UI but the mental model applies — buyers see a status banner on the order in Phase 6).
- **i18n:** All moderator strings and affected-user strings RU-first with EN parity. QUAL-01 translation audit lands in Phase 6; Phase 5 writes both pairs as it goes.
- **No breaking changes:** Signup, login, listing browse, cart, Stripe checkout must not regress. The quick-action sheet lives behind an admin gate; non-admin consumers see no UI change.
- **Secrets hygiene:** No new hardcoded keys. CONCERNS.md items are explicitly not addressed here but also must not get worse.
- **GSD workflow enforcement:** All file edits must go through a GSD command — Phase 5 plans will drive this.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User list fetch (search/filter/paginate) | Mobile client (FlatList state) | Backend API (`/api/admin/users/search`) | UI owns scroll/pagination state; server owns auth + query. |
| Moderation write (suspend/unsuspend/revoke/delete/edit) | Backend API + MongoDB txn (already shipped Phase 2) | Mobile UI — thin call site | Auth-critical; server is authoritative. Mobile only formats payload and handles optimistic UI. |
| Moderation history read | Backend API (new `/history` route) | Mobile UI — render only | Read-only projection; paginated for large histories. |
| Optimistic row update on quick action | Mobile client | — | UI-only concern; server round-trip confirms / rolls back. |
| Typed-confirmation gate (destructive) | Mobile UI only | — | Defense-in-depth — backend has its own guards (`cannot_moderate_self`, `last_admin_protected`). |
| Error mapping `ModerationError.code → RU/EN string` | Mobile UI | Backend contract (codes list) | Backend emits codes; UI owns human-readable mapping + locale. |
| Severity palette + token definitions | Mobile UI (`src/constants/theme.ts`) | Reused by Phase 6 banner | Single source of truth; Phase 6 imports `COLORS.moderation.*` verbatim. |
| Navigation wiring for new routes | Mobile UI (`src/types/navigation.ts`, `App.tsx`) | — | Purely client-side. |

## Standard Stack

### Core (already installed — zero new deps needed for Phase 5)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-native` | 0.83.1 | Primitives (`Modal`, `FlatList`, `RefreshControl`, `TextInput`, `TouchableOpacity`, `ScrollView`, `KeyboardAvoidingView`, `Pressable`) | [VERIFIED: package.json] All modals + lists in codebase use stock RN components. |
| `react` | 19.2.0 | Hooks (`useState`, `useEffect`, `useCallback`, `useRef`, `useMemo`) | [VERIFIED: package.json] |
| `@react-navigation/native` | 7.1.28 | `useNavigation`, `useRoute`, `useIsFocused` | [VERIFIED: package.json] Already the only nav lib. |
| `@react-navigation/native-stack` | 7.11.0 | `NativeStackNavigationProp` typing | [VERIFIED: package.json] |
| `react-native-safe-area-context` | 5.6.2 | `SafeAreaView`, `useSafeAreaInsets` (for bottom-sheet bottom padding) | [VERIFIED: package.json] |
| `lucide-react-native` | 0.563.0 | Icons (existing + new: `MoreVertical`, `ShieldAlert`, `ShieldOff`, `Search`, `Filter`, `Check`, `Pencil`, `AlertTriangle`, `Users`) | [VERIFIED: package.json] Already used app-wide. |
| `axios` | 1.13.4 | HTTP via shared `apiClient` only | [VERIFIED: package.json] Plus existing `apiClient` from `src/services/http/client.ts`. |
| `@react-native-async-storage/async-storage` | 2.2.0 | Existing storage for auth data | [VERIFIED: package.json] Not directly touched in Phase 5 but AuthContext reads it. |

### Supporting (existing codebase primitives to reuse)

| Artifact | Purpose | When to Use |
|----------|---------|-------------|
| `src/services/moderation/ModerationService.ts` | 6 admin writes + `getHistory` stub | Every action modal → action handler |
| `src/services/moderation/errors.ts` (`ModerationError`) | Typed 403 error with `.code`, `.status`, `.reasonCategory`, `.note` | `try/catch` around every ModerationService call; `if (err instanceof ModerationError)` branches |
| `src/services/http/client.ts` (`apiClient`) | Shared axios instance with Bearer + 403 interceptor | All new HTTP (including new `searchUsers` method) |
| `src/context/AuthContext.tsx` | `user`, `isAdmin`, `adminRole`, `refreshUser`, `user.localId` | Admin gating, current-admin identity, force-refresh after self-edit |
| `src/context/LanguageContext.tsx` (`useLanguage`) | i18n | Every user-facing string |
| `src/constants/theme.ts` (`COLORS`, `SIZES`) | Theme tokens — **to be extended per UI-SPEC** with `COLORS.moderation.*`, `COLORS.role.*`, `COLORS.destructive`, `COLORS.warning`, `COLORS.successFg`, `COLORS.textTertiaryStrong`, `SIZES.spacing{Xs,Sm,Md,Lg,Xl,2xl}`, `SIZES.radius{Sm,Md,Pill}`, `SIZES.minTapTarget`, `SIZES.badgeHeight`, `SIZES.chipHeight`, `SIZES.bottomSheetHandle{Width,Height}`, plus new `TYPOGRAPHY` export | Import everywhere |
| `src/constants/translations.ts` (`TRANSLATIONS.{RU,EN}`) | Flat camelCase keys (e.g. `adminPanel`, `confirmApprove`) | Every new string — RU primary + EN parity |

### Alternatives Considered (rejected)

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stock `Modal` + slide animation | `@gorhom/bottom-sheet` | [CITED: CLAUDE.md "Tech stack (mobile): don't introduce new state-management or networking libs for this milestone"] New dep + gesture-handler coupling; stock Modal handles our needs. |
| `useDebouncedValue` hand-rolled (~15 lines) | `lodash.debounce` / `use-debounce` | New dep for 15 lines. [VERIFIED: no `lodash` or `use-debounce` in package.json] |
| `axios.CancelToken` on search | Manual request ID counter | CancelToken is axios-native; a stale-request counter works but is more fragile. [CITED: axios docs — CancelToken is the idiomatic cancellation path.] [ASSUMED: CancelToken still works; axios 1.x also offers `AbortController` — either is acceptable. Planner picks one during plan 05-01.] |
| Cursor-based pagination (backend returns `nextCursor`) | Offset-based (`page=&limit=`) | Cursor is more robust against list mutations (admin modifies user in middle of list) but offset is simpler. Backend contract TBD per D-16 Discretion — planner picks. |

**Installation:** None. All packages already installed.

**Version verification:** Ran `npm view` mentally against `package.json` — all versions match installed. No upgrades needed.

## Architecture Patterns

### System Architecture Diagram

```
┌─ AdminDashboardScreen (entry)
│   └── [Pending Requests UI — untouched by Phase 5]
│   └── [new nav card] → AdminModeration
│
├─ AdminManagementScreen (REPURPOSED per D-03)
│   ├── FilterChipRow [All users | Admins only]
│   ├── FlatList<User>
│   │    └── UserRow (tap → AdminUserDetail; trailing MoreVertical → QuickActionSheet)
│   │            └── SeverityBadge pill (D-02 colors)
│   └── QuickActionSheet (Modal, slide)
│        └── 5 action rows → launches ModerationActionModal OR TypedConfirmationModal
│
├─ AdminModerationScreen (NEW per UI-02)
│   ├── SearchBar (debounced 300ms → ModerationService.searchUsers)
│   ├── Chip rows: Role filter + State filter
│   ├── FlatList<User> (infinite scroll via onEndReached; RefreshControl)
│   └── tap row → AdminUserDetail
│
├─ AdminUserDetailScreen (NEW per UI-03, UI-04)
│   ├── StickySummaryCard (sticky via FlatList.ListHeaderComponent + stickyHeaderIndices={[0]})
│   │    ├── User email + role badges + severity badge
│   │    └── [conditional] Unsuspend button (opens ModerationActionModal in 'unsuspend' mode)
│   ├── FlatList<ModerationAction> (cursor-paginated via getHistory)
│   │    └── HistoryCard (severity-accented left border)
│   └── [any action from summary] → ModerationActionModal → optimistic update
│
├─ ModerationActionModal (NEW shared component)
│   ├── Conditional fields by action:
│   │    suspend:       SeverityPicker + ReasonPicker + NoteInput
│   │    unsuspend:     NoteInput (optional)
│   │    revoke_role:   RolePicker + ReasonPicker + NoteInput
│   │    edit_profile:  RoleTabs + dynamic field form
│   │    delete_profile: (delegated to TypedConfirmationModal)
│   ├── Submit flow (D-08):
│   │    1. Close modal (optimistic)
│   │    2. Parent flips row state locally
│   │    3. Parent calls ModerationService.<action>(uid, body)
│   │    4a. Success → keep UI state
│   │    4b. Error → revert state, Alert.alert with ModerationError code → mapped RU/EN
│   └── For destructive suspend (permanently_banned): wraps TypedConfirmationModal
│
├─ TypedConfirmationModal (NEW shared component)
│   ├── Warning banner + per-action body copy
│   ├── TextInput (hint shows target email lowercased)
│   ├── Confirm disabled until input.trim().toLowerCase() === target.email.trim().toLowerCase()
│   └── On Confirm → fires the same submit flow as the non-destructive path
│
└─ Data flow:
    UI handler → ModerationService.<method>(uid, body)
              → apiClient [Bearer injected via tokenProvider getter]
              → /api/admin/moderation/:uid/<op>  (Phase 2 backend routes)
              [If 403 account_suspended returned for current admin's own uid:
                apiClient interceptor → moderationRefreshListener → refreshUser
                → throw ModerationError (caller catches in try/catch)]
    History fetch: ModerationService.getHistory(uid, { limit, cursor })
              → apiClient.get(`/api/admin/moderation/${uid}/history`)
              [NEW backend route — Phase 5 ships]
    Search:   ModerationService.searchUsers({ q, role, state, page, limit })
              → apiClient.get('/api/admin/users/search')
              [NEW backend route — Phase 5 ships]
```

**Component responsibilities:**

| File (to be created) | Responsibility |
|----------------------|----------------|
| `src/screens/AdminManagementScreen.tsx` (modified) | Repurposed per D-03 — list all approved users, "Admins only" filter chip |
| `src/screens/AdminModerationScreen.tsx` (NEW) | Search + filter + infinite-scroll user list |
| `src/screens/AdminUserDetailScreen.tsx` (NEW) | Sticky summary card + history FlatList + Unsuspend CTA |
| `src/components/ModerationActionModal.tsx` (NEW) | Generic bottom-sheet modal for all 5 actions |
| `src/components/TypedConfirmationModal.tsx` (NEW) | Sentinel-typed destructive-action gate |
| `src/components/SeverityBadge.tsx` (NEW) | Reusable pill component driven by `user.moderationStatus.state` |
| `src/components/ReasonChip.tsx` (NEW, optional) | Tiny reason-category pill for history cards |
| `src/components/EmptyState.tsx` (NEW per UI-SPEC §Loading/Empty matrix) | Shared empty-state primitive (icon + title + body) |
| `src/components/QuickActionSheet.tsx` (NEW) | Bottom-sheet listing 5 action rows with per-action enable/disable logic |
| `src/hooks/useDebouncedValue.ts` (NEW) | 15-line debounce hook for search |
| `src/services/moderation/ModerationService.ts` (modified) | Replace `getHistory` stub; add `searchUsers` method |
| `src/constants/theme.ts` (modified) | Extend `COLORS` with `moderation.*`, `role.*`, `destructive`, `warning`, `successFg`, `textTertiaryStrong`; extend `SIZES`; add `TYPOGRAPHY` |
| `src/constants/translations.ts` (modified) | RU + EN parity for every new string (70+ keys per UI-SPEC) |
| `src/types/navigation.ts` (modified) | Add `AdminModerationScreen`, `AdminUserDetail: { targetUid: string }` routes |
| `App.tsx` (modified) | Register two new Stack.Screen entries; import + mount |

### Recommended Project Structure

```
src/
├── screens/
│   ├── AdminManagementScreen.tsx     # MODIFIED — repurposed per D-03
│   ├── AdminModerationScreen.tsx     # NEW
│   └── AdminUserDetailScreen.tsx     # NEW
├── components/
│   ├── ModerationActionModal.tsx     # NEW — 5-action shared modal
│   ├── TypedConfirmationModal.tsx    # NEW — destructive gate
│   ├── QuickActionSheet.tsx          # NEW — row trailing-icon sheet
│   ├── SeverityBadge.tsx             # NEW — reusable pill
│   ├── ReasonChip.tsx                # NEW — reason-category chip
│   └── EmptyState.tsx                # NEW — shared empty-state
├── hooks/
│   └── useDebouncedValue.ts          # NEW — 15-line utility
├── services/moderation/
│   └── ModerationService.ts          # MODIFIED — wire getHistory, add searchUsers
├── constants/
│   ├── theme.ts                      # MODIFIED — extend COLORS/SIZES/add TYPOGRAPHY
│   └── translations.ts               # MODIFIED — add RU+EN moderation keys
├── types/
│   └── navigation.ts                 # MODIFIED — add AdminModeration + AdminUserDetail
└── App.tsx                           # MODIFIED — Stack.Screen registrations
```

### Pattern 1: Screen shape — `useState` + `useCallback` + `useEffect` + `FlatList` + `RefreshControl`

**What:** Every list screen in the codebase uses the same pattern. Phase 5's new screens should copy it verbatim.
**When to use:** All three Phase 5 screens (`AdminManagementScreen` already uses it; new `AdminModerationScreen` and `AdminUserDetailScreen` mirror).
**Example:** `src/screens/AdminManagementScreen.tsx:30-62`

```typescript
export const AdminManagementScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdmins = useCallback(async () => {
    if (!user?.localId) return;
    try {
      const data = await AuthService.getAdminUsers(user.localId);
      setAdmins(data);
    } catch {
      Alert.alert(t.error, 'Failed to load admins');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const onRefresh = () => { setRefreshing(true); fetchAdmins(); };
  // ...
};
```

### Pattern 2: Tab-based filter row

**What:** Horizontal tab buttons with count badge + active underline.
**When to use:** As the baseline shape for filter chip rows on `AdminManagementScreen` ("All users | Admins only") and `AdminModerationScreen` (Role / State chips).
**Example:** `src/screens/AdminDashboardScreen.tsx:245-261`

```typescript
<View style={styles.tabBar}>
  {tabs.map(tab => (
    <TouchableOpacity
      key={tab.key}
      style={[styles.tab, activeTab === tab.key && styles.activeTab]}
      onPress={() => setActiveTab(tab.key)}>
      <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
        {tab.label}
      </Text>
      {tab.count > 0 ? (
        <View style={[styles.badge, activeTab === tab.key && styles.badgeActive]}>
          <Text style={...}>{tab.count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  ))}
</View>
```

Phase 5 chips differ cosmetically (rounded pill instead of tab underline) but the state-toggle pattern is identical. The `FilterBar.tsx` component offers an alternative chip shape (rounded rect with accent border + fill when active) — see `src/components/FilterBar.tsx:30-42` for the exact `activeFilterButton` / `activeFilterText` style treatment.

### Pattern 3: Modal with `TouchableWithoutFeedback` overlay + stop-propagation

**What:** Overlay that closes on tap-outside, inner sheet blocks propagation.
**When to use:** `ModerationActionModal` and `TypedConfirmationModal` — matches existing modal behavior so admins don't see inconsistent close semantics.
**Example:** `src/components/FilterModal.tsx:121-153`

```typescript
<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
  <TouchableWithoutFeedback onPress={onClose}>
    <View style={styles.overlay}>
      <TouchableWithoutFeedback>
        <View style={styles.modalContainer}>
          {/* header + content + footer */}
        </View>
      </TouchableWithoutFeedback>
    </View>
  </TouchableWithoutFeedback>
</Modal>
```

For `ModerationActionModal` change `animationType` to `"slide"` (bottom-sheet semantics per UI-SPEC) and wrap in `KeyboardAvoidingView`:

```typescript
<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    style={{ flex: 1 }}>
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
        {/* BottomSheetHandle + Title + ScrollView of conditional fields + Footer */}
      </Pressable>
    </Pressable>
  </KeyboardAvoidingView>
</Modal>
```

### Pattern 4: Option-pill picker (horizontal wrap)

**What:** Wrap of TouchableOpacity pills; selected pill uses accent background.
**When to use:** Reason-category picker; Role picker inside `ModerationActionModal`.
**Example:** `src/components/FilterModal.tsx:88-101` + styles at `:201-226`

```typescript
<View style={styles.optionsContainer}>   {/* flexDirection: 'row', flexWrap: 'wrap', gap: 8 */}
  {options.map(opt => (
    <TouchableOpacity
      key={opt}
      style={[styles.optionButton, selected === opt && styles.selectedOption]}
      onPress={() => setSelected(opt)}>
      <Text style={[styles.optionText, selected === opt && styles.selectedOptionText]}>
        {opt}
      </Text>
    </TouchableOpacity>
  ))}
</View>
```

**Important — UI-SPEC deviation:** UI-SPEC §5 picks a softer "accent border + tinted bg" treatment for selected pills (not `FilterModal`'s solid `backgroundColor: COLORS.accent` with black text). The `FilterBar.tsx:63-69` `activeFilterButton` / `activeFilterText` style is the closer analog:

```typescript
activeFilterButton: {
  borderColor: COLORS.accent,
  backgroundColor: 'rgba(59, 130, 246, 0.1)',
},
activeFilterText: {
  color: COLORS.accent,
  fontWeight: 'bold',
},
```

### Pattern 5: `TouchableOpacity` row with trailing action

**What:** Horizontal row with flex-1 content column and trailing icon button.
**When to use:** User rows on `AdminManagementScreen` / `AdminModerationScreen` (trailing `MoreVertical` opens QuickActionSheet).
**Example:** `src/screens/AdminManagementScreen.tsx:107-127`

### Pattern 6: Wrapper-component pattern for context-consuming effects

**What:** Since hooks like `useAuth` require the provider, a wrapper component mounted *inside* the provider tree lets you run a hook side-effect without hoisting logic into the provider itself.
**When to use:** Same concern arises if any Phase 5 logic needs to run outside a screen (e.g. pre-fetch on AppState foreground). Most Phase 5 work lives inside screens, so this pattern may not be needed — but it's the documented precedent in `App.tsx:58-62`:

```typescript
export const AppStateRefreshEffect = () => {
  const { user, refreshUser } = useAuth();
  useAppStateRefresh(user?.localId ? refreshUser : null, { cooldownMs: 30_000 });
  return null;
};
```

And `src/components/OfflineNotice.tsx:10-24` (consumes `useNetwork()` inside `NavigationContainer`).

### Pattern 7: i18n key convention — flat camelCase

**What:** Every string is a camelCase key on `TRANSLATIONS.RU` and `TRANSLATIONS.EN`, no nesting.
**When to use:** All new Phase 5 keys.
**Example:** `src/constants/translations.ts:1-150` — keys like `adminPanel`, `manageAdmins`, `pendingRequests`, `confirmApprove`, `requestSellerAccount`, `svcPending`. No dots, no nesting.

UI-SPEC prescribes ~70 new keys following this convention: `adminUsersTitle`, `adminModerationTitle`, `roleFilterAll`, `stateFilterFeatureLimited`, `severityFeatureLimited`, `reasonSpam`, `actionSuspend`, `fieldSeverity`, `confirmSuspend`, `typedConfirmTitle`, `emptyHistoryTitle`, `errCannotModerateSelf`, etc. All camelCase; group by screen or concern by blank-line separators + leading comment (same as existing file).

### Pattern 8: Navigation typing + deep-link registration

**What:** Add routes to `RootStackParamList` with param shapes; register in `App.tsx`'s `Stack.Navigator`.
**When to use:** Add `AdminModerationScreen: undefined;` and `AdminUserDetail: { targetUid: string };` to `src/types/navigation.ts`.
**Example:** Current `src/types/navigation.ts:1-23` shows the exact shape — extend by two entries.

Then in `App.tsx:85-113`:

```typescript
<Stack.Screen name="AdminModeration" component={AdminModerationScreen} />
<Stack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
```

Note: UI-SPEC uses the name `AdminModerationScreen` for the screen module but the Stack.Screen `name` prop should just be `AdminModeration` to match the existing RootStackParamList convention (`AdminDashboard`, `AdminManagement` — no `Screen` suffix on the route keys).

### Pattern 9: Entry point — add nav card on `AdminDashboardScreen`

**What:** AdminDashboardScreen is the currently-reachable admin entry. Phase 5 adds one new navigation affordance from there → `AdminModeration`.
**When to use:** Plan 05 needs a task that adds a card/button on `AdminDashboardScreen` (after the pending-requests list or in the header) that `navigation.navigate('AdminModeration')`.
**Example:** Existing navigation pattern in `AdminDashboardScreen` is via `ProfileScreen.tsx:28-80` menuItems array (rendered as card list). `AdminDashboardScreen` today only surfaces pending requests — we need a small navigation card near the header for Moderation, and another for the repurposed Users list.

### Anti-Patterns to Avoid

- **Don't fire `ModerationService` calls inside render.** Handler-based only; never `useEffect` that calls write methods.
- **Don't use `user.moderationStatus.state` as the current-admin's own state without `refreshUser` after an edit.** If admin edits their own profile via `edit_profile`, call `AuthContext.refreshUser()` (not `refreshUserForced` — normal path is fine since the edit is authoritative).
- **Don't trust `user.isAdmin` for authorization.** UI gating only; backend enforces via `requireAdmin` on every route.
- **Don't rebuild `AuthService.ts`.** MOB-01 guardrail: grep count stays at 0. Phase 5 extensions live in `ModerationService.ts`.
- **Don't add 3rd occurrence of `_skipModerationInterceptor`.** Phase 4 specifics line 238 — exactly 2 non-test occurrences. Phase 5 refresh calls go through `AuthContext.refreshUser()` (or `refreshUserForced`), never set the flag directly.
- **Don't fire an optimistic badge flip AND a full-screen loading indicator for the same action.** Choose one feedback mode. UI-SPEC picks optimistic flip; Alert on error only.
- **Don't nest `FlatList` inside `ScrollView`.** UI-SPEC §3 explicitly locks: single `FlatList` with `ListHeaderComponent={StickySummaryCard}` + `stickyHeaderIndices={[0]}` on `AdminUserDetailScreen`.
- **Don't use native bottom-sheet libs.** Stock RN `Modal` + `animationType="slide"` is the chosen primitive per CLAUDE.md constraint.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 403 `account_suspended` handling | Custom interceptor or per-screen catch-blocks | Existing `apiClient` response interceptor (`src/services/http/client.ts:67-96`) | Already shipped in Phase 4; throws `ModerationError`; refreshes user. |
| Bearer injection on admin calls | Per-call header manipulation | Existing `tokenProvider` registration in `AuthContext` + `apiClient` request interceptor | Phase 4 wired this. |
| Dedupe/cooldown on refreshUser | New guard logic | Existing `refreshUserInternal` ref + cooldown (`AuthContext.tsx:98-154`) | Shared between AppState + interceptor paths. |
| Typed error class | Ad-hoc `Error` subclass | `ModerationError` from `src/services/moderation/errors.ts` | Has `.code`, `.status`, `.reasonCategory`, `.note`, `.httpStatus` already. |
| Admin status fetch | New endpoint | Existing `AuthService.getAdminStatus(uid)` → `/api/admin/status/:uid` | Already integrated into AuthContext. `isAdmin` + `adminRole` on useAuth. |
| Pending-requests screen | New screen | Existing `AdminDashboardScreen` | Untouched by Phase 5; only add a new nav affordance to AdminModeration from it. |
| Offline detection | Ad-hoc check | `OfflineNotice` is already mounted; `useNetwork()` hook exists | Admin should at least see a banner if offline — no extra work needed, mount is global. |
| Time/date formatting for history | `moment` / `date-fns` / `dayjs` | **Plain `Date.prototype.toLocaleString`** with explicit options OR manual `YYYY-MM-DD HH:mm` string build | Codebase convention: 11 call sites use `toLocaleDateString()` / `toLocaleString()` directly (see `AdminDashboardScreen.tsx:157`, `MyOrdersScreen.tsx:112`). **No date lib installed, don't add one.** A 10-line helper like `function formatYmdHm(iso) { const d = new Date(iso); return d.toLocaleString('sv-SE').slice(0, 16); }` suffices for `YYYY-MM-DD HH:mm` (`sv-SE` locale yields ISO-like format). [ASSUMED: `sv-SE` support on RN Hermes engine.] If engine locale support is patchy, fall back to manual formatting: `d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + ...`. |
| Debounce search input | Timer Ref + setTimeout in every screen | **Create one tiny `useDebouncedValue` hook** in `src/hooks/useDebouncedValue.ts` | 15 lines of code, no dep. [VERIFIED: no existing debounce in codebase]. Example: `useDebouncedValue(rawQuery, 300)` returns the debounced value after 300ms of stability. |
| Severity palette (amber/red/dark) | Inline hex values in each component | **Extend `COLORS` with nested `moderation.*` object** per UI-SPEC | Single source of truth; Phase 6 `UserStatusBanner` imports `COLORS.moderation.featureLimited.fg` verbatim. |
| Reason-category translation | Inline ternaries | Dedicated translation keys (`reasonSpam`, `reasonPolicyViolation`, `reasonFraud`, `reasonOther`) | QUAL-01 audit in Phase 6 greps for untranslated literals. |

**Key insight:** Phase 4 did the heavy lifting around HTTP + context. Phase 5 is almost entirely new UI plus two backend routes. The only net-new reusable primitives Phase 5 introduces are `useDebouncedValue`, `EmptyState`, `SeverityBadge` — each small and phase-scoped.

## Runtime State Inventory

Phase 5 is **greenfield UI** (new screens + two new backend endpoints + additive changes to an existing screen). No renames, no refactors, no string-replacement operations on existing data. This section is included for completeness with explicit empty categories so the planner knows they were considered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 5 does not rename any MongoDB collection, field, or key. `ModerationAction` rows written by existing endpoints remain as-is. `User.moderationStatus.state` string values unchanged (they are authored by Phase 1). | None |
| Live service config | None — no n8n, Datadog, Railway env var, or external service configuration is renamed. Backend deploys to existing Railway service; new routes mount onto existing moderation router. | None |
| OS-registered state | None — no Task Scheduler / launchd / pm2 / systemd artifacts involved. Mobile client only. | None |
| Secrets/env vars | None — no new secrets introduced. Existing Firebase API key + Stripe test key untouched. | None |
| Build artifacts | **Deep-link config unchanged:** `App.tsx:64-72` declares the `linking` object with `CarDetails: 'listing/:carId'`. Phase 5 does **not** add deep links for the new admin screens (admin navigation is in-app only — opening moderation via a link is not a supported flow). iOS `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` and Android `VERSION_CODE` / `VERSION_NAME` increment on archive build; those files are already untracked-modifiable per CLAUDE.md. | None at planning time; archive will bump on next ship |

**Nothing found in every category.** Phase 5 is net-additive code + one repurposed screen (data source widens; no string rename).

## Common Pitfalls

### Pitfall 1: Stale `user` inside long-lived closures (e.g. action modals)

**What goes wrong:** `ModerationActionModal` is passed `targetUser` as a prop and internally closures over it. If the parent screen rerenders with a different user mid-flow (e.g. pull-to-refresh lands a new list, the user we're acting on is still in-flight) the modal's submit handler might fire against the wrong uid.
**Why it happens:** React closures capture at render time; without `useCallback([targetUser])` the callback can drift.
**How to avoid:** Use `useRef` mirror pattern (see `AuthContext.tsx:63-66` `userRef` precedent). In the action modal, store the target in a ref set by an effect keyed on `visible + targetUser`. Or simpler: disable the confirm button and freeze the target at modal-open time by passing the uid/email as a captured prop rather than reading from context.
**Warning signs:** Admin sees "suspended wrong user" bug report.

### Pitfall 2: Optimistic update race vs `useAppStateRefresh` / 403 interceptor

**What goes wrong:** Admin taps Suspend. Optimistic row flip to `blocked_with_review`. While the write is in-flight, admin taskswitches to Slack then back — `useAppStateRefresh` fires `refreshUser()`. The refresh returns the *pre-suspend* user.moderationStatus.state (backend txn still committing) and overwrites the optimistic flip. Admin sees the badge flip back to green for a moment.
**Why it happens:** AuthContext.refreshUser updates `user` (current admin's own record) but the list-screen state holds *target-user* records — different state trees. So this specific race is NOT the problem. The real race is:

AuthContext.refreshUser always refreshes *the current admin's own* user doc via `/api/users/:uid`. It never touches the list-screen's `users` array. So there is **no collision** between optimistic row updates and the AppState refresh path for arbitrary targets.

However, when the admin moderates **their own row** (edit_profile against self), the refreshUser path will bring back backend state. Caller should `await refreshUser()` **after** the ModerationService call resolves so the returned user doc reflects the edit.

**How to avoid:**
- Keep list-screen state (the `users` array) out of the refreshUser path; only the current admin's `user` object is refreshed there.
- For the self-edit case: after `editProviderProfile` resolves, call `refreshUser()` (or `refreshUserForced` if the 30s cooldown would eat it) so the admin's own profile reflects new values in ProfileScreen etc.

**Warning signs:** Optimistic flip briefly reverts on foreground transition (indicates the wrong state is being refreshed); or admin's own edits don't appear in Profile after edit_profile.

### Pitfall 3: `_skipModerationInterceptor` reused incorrectly

**What goes wrong:** Developer adds `_skipModerationInterceptor: true` to a Phase 5 call (thinking it's a "don't do refresh" flag). This bypasses the 403 → refresh → ModerationError path and the caller gets a raw axios error with no typed code. UI error-mapping falls through to generic "action failed."
**Why it happens:** The flag's purpose is narrow: **only for the refresh call itself, to prevent interceptor recursion.** Phase 4 specifics line 238 locks exactly 2 non-test occurrences.
**How to avoid:** **NEVER** set this flag in Phase 5 code. All ModerationService methods go through the normal interceptor. If a 403 returns (e.g. admin is self-suspended mid-session), the interceptor correctly surfaces the ModerationError and refreshes context.
**Warning signs:** `grep '_skipModerationInterceptor' src/ | grep -v test` returns 3+ lines. Investigate immediately.

### Pitfall 4: Row tap triggers BOTH row navigation AND quick-action sheet

**What goes wrong:** User taps the trailing `MoreVertical` icon. The trailing icon is inside a `TouchableOpacity` that's inside another `TouchableOpacity` (the row). Both onPress fire → navigation.navigate + sheet open simultaneously.
**Why it happens:** Nested Touchables without stopPropagation. RN's Touchable doesn't forward stopPropagation directly; the outer Touchable also receives the press.
**How to avoid:** Either use `Pressable` with `onPress={(e) => e.stopPropagation()}` on the trailing icon, or separate: the row is NOT a Touchable; it's a `View` with only the content area as a Touchable, and the trailing icon is a separate Touchable sibling. UI-SPEC §Component 1 implicitly picks the sibling-Touchables approach (row-level tap is a distinct Touchable; trailing icon is its own sibling with `hitSlop`).
**Warning signs:** Tapping MoreVertical navigates to detail screen and also opens the sheet.

### Pitfall 5: Destructive action gated by typed-email modal bypassed by keyboard autofill

**What goes wrong:** iOS keyboard offers to paste user's clipboard content on tap. Admin leaves a different user's email on clipboard → autofills → matches → confirms. Result: wrong user deleted.
**Why it happens:** `TypedConfirmationModal` compares user-typed string against `target.email` — an auto-pasted clipboard string looks identical to a typed string.
**How to avoid:** Either (a) require manual typing (disable `contextMenuHidden`? RN Paste-blocking is imperfect), or (b) accept the risk since the admin explicitly confirmed the target via the quick-action sheet showing the user's email header. **UI-SPEC picks (b)** — sentinel matching is a convenience gate, not a security boundary (backend `requireAdmin` + target uid are the real gates).
**Warning signs:** Admin reports "deleted wrong user" after explicitly confirming via typed email. Root cause is almost always row-level identification confusion (tapping the wrong row), not typed-confirm bypass.

### Pitfall 6: Search debounce cleanup race

**What goes wrong:** Admin types fast; three requests fire 100ms apart (debounce at 300ms but implementations with cleared-timer bugs can fire partially). Third request resolves first, second resolves last → UI shows stale results.
**Why it happens:** setTimeout-ref debounce without cleanup on unmount or re-key.
**How to avoid:** `useDebouncedValue` hook pattern ensures only the final value propagates; combined with `axios.CancelToken` (or `AbortController`) on `searchUsers`, any in-flight stale request is cancelled on new input.
**Warning signs:** Search results briefly show wrong list as user types.

### Pitfall 7: Backend history endpoint not yet built when mobile tries to call

**What goes wrong:** `ModerationService.getHistory` currently throws `"Not implemented — Phase 5 adds the /history route"`. If Phase 5 plan executes the mobile history UI before the backend route is live, every `AdminUserDetailScreen` load throws and shows error state.
**Why it happens:** Plan ordering — mobile and backend parallelizable but not independent.
**How to avoid:** Phase 5 plan must wire backend routes BEFORE or in the same wave as the mobile UI that consumes them. Suggested wave order:
- **Wave 0:** Backend `GET /api/admin/moderation/:targetUid/history` + `GET /api/admin/users/search` routes, tests
- **Wave 1:** `theme.ts` + `translations.ts` + `ModerationService.getHistory` real implementation + `searchUsers` method
- **Wave 2:** Shared components — `SeverityBadge`, `EmptyState`, `ModerationActionModal`, `TypedConfirmationModal`, `QuickActionSheet`, `useDebouncedValue`
- **Wave 3:** Screen integrations — `AdminManagementScreen` modifications, `AdminModerationScreen`, `AdminUserDetailScreen`, `RootStackParamList` + `App.tsx` wiring, `AdminDashboardScreen` entry card

**Warning signs:** `throw` from getHistory during Plan execution.

### Pitfall 8: i18n key collision — e.g. "Users" already means "Administrators"

**What goes wrong:** Existing key `adminUsers: 'Администраторы'` (translations.ts:131) means "Administrators" — the current title of `AdminManagementScreen`. Per D-03 the screen repurposes to "all users"; UI-SPEC declares a NEW key `adminUsersTitle: 'Пользователи'` / 'Users'. If the planner accidentally reuses `adminUsers`, the screen header still says "Administrators."
**Why it happens:** Key name overlap; camelCase ambiguity.
**How to avoid:** Use UI-SPEC-prescribed key names verbatim: `adminUsersTitle` (not `adminUsers`). Preserve the existing `adminUsers` key (Profile screen etc. may still reference it) or audit call sites and migrate.
**Warning signs:** Header renders the old "Administrators" string on the repurposed screen.

### Pitfall 9: Cursor-based pagination — "load more" fires repeatedly on content shorter than viewport

**What goes wrong:** Empty list or single-page list. `FlatList.onEndReached` fires on initial render because bottom is already in view. Handler fires `fetchNextPage` → no-op → but if no guard, infinite loop possible.
**Why it happens:** `FlatList` fires `onEndReached` when visible viewport already shows end-of-data.
**How to avoid:** Guard with state: `if (loading || !hasNextCursor) return;` at top of `onEndReached` handler. Also set `onEndReachedThreshold={0.5}` and `initialNumToRender` appropriately.
**Warning signs:** DevTools Network shows repeated identical requests on an empty search.

### Pitfall 10: `FlatList` with `ListHeaderComponent` + `stickyHeaderIndices` — scroll jitter / overlap

**What goes wrong:** Summary card uses sticky behavior; when tapping an item far down, the list scrolls but the header "detaches" briefly. On iOS `stickyHeaderIndices` works; on Android it's finicky with some RN versions.
**Why it happens:** RN's sticky headers have platform differences.
**How to avoid:** Test on both platforms. Fallback: render the summary card as a normal header (not sticky) and accept scroll-under behavior. UI-SPEC §3 locks sticky; planner confirms during plan.
**Warning signs:** Android reports summary card disappears when scrolling.

### Pitfall 11: `deleteProviderProfile` requires a `role` body — passed via `config.data`

**What goes wrong:** Quick-action sheet decides which delete to trigger. Admin hits "Delete provider profile" — but user has both broker and logistics profiles. Which to delete? Must ask.
**Why it happens:** `DELETE /api/admin/moderation/:uid/provider-profile` takes `{ role: 'broker' | 'logistics' }` in the body (axios DELETE with body via `config.data`). UI must collect the role choice before calling.
**How to avoid:** In `QuickActionSheet`, inspect the target user's roles:
- If user has only broker → auto-pass `role: 'broker'`
- If user has only logistics → auto-pass `role: 'logistics'`
- If user has both → render a sub-choice before opening the TypedConfirmationModal (two action rows: "Delete broker profile" and "Delete logistics profile")
- If user has neither → disable the "Delete profile" action row entirely (CONTEXT.md §specifics: "show disabled states for impossible actions")
**Warning signs:** Backend returns 400 `invalid_role_for_delete`.

### Pitfall 12: `edit_profile` role gating — backend rejects if target lacks role

**What goes wrong:** Admin edits profile of a user whose `brokerStatus !== 'APPROVED'`. Backend returns 400 `role_not_assigned`.
**Why it happens:** Phase 2 D-07 locked: edit-profile only valid when target has the corresponding role assigned.
**How to avoid:** Disable the "Edit profile" action in QuickActionSheet when `!(user.brokerStatus === 'APPROVED' || user.logisticsStatus === 'APPROVED')`. In the edit modal, `RoleTabs` only shows roles the user actually holds (auto-select if only one).
**Warning signs:** 400 `role_not_assigned` shown to admin despite UI offering the action.

## Code Examples

### Timestamp formatting (no external lib)

```typescript
// src/utils/formatDate.ts (NEW)
export function formatYmdHm(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
```

### `useDebouncedValue` hook

```typescript
// src/hooks/useDebouncedValue.ts (NEW) — 15 lines, zero deps
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

### Optimistic update with rollback on error

```typescript
// Inside AdminManagementScreen row handler:
const handleSuspend = async (targetUser: User, body: SuspendBody) => {
  const prev = users.find(u => u.localId === targetUser.localId);
  if (!prev) return;

  // 1. Optimistic: flip state locally
  setUsers(curr => curr.map(u =>
    u.localId === targetUser.localId
      ? { ...u, moderationStatus: { ...u.moderationStatus, state: body.severity } }
      : u,
  ));

  try {
    await ModerationService.suspend(targetUser.localId, body);
    // Success — optimistic state is correct. No further UI change.
  } catch (err) {
    // Rollback
    setUsers(curr => curr.map(u =>
      u.localId === targetUser.localId ? prev : u,
    ));
    if (err instanceof ModerationError) {
      // Map code → t.err{code}
      const codeKey = err.code as keyof typeof ERROR_KEY_MAP;
      const msgKey = ERROR_KEY_MAP[codeKey] ?? 'errGeneric';
      Alert.alert(t.error, t[msgKey]);
    } else {
      // Backend returned a non-moderation error (400 validation, 500, network)
      // Inspect err.response.data.error if present
      const code = (err as any)?.response?.data?.error;
      if (code === 'cannot_moderate_self') Alert.alert(t.error, t.errCannotModerateSelf);
      else if (code === 'last_admin_protected') Alert.alert(t.error, t.errLastAdmin);
      else if (!(err as any)?.response) Alert.alert(t.error, t.errNetwork);
      else Alert.alert(t.error, t.errGeneric);
    }
  }
};
```

### ModerationError code → RU/EN key map

```typescript
// src/constants/moderationErrorMap.ts (NEW)
export const MODERATION_ERROR_KEY_MAP = {
  cannot_moderate_self:    'errCannotModerateSelf',
  last_admin_protected:    'errLastAdmin',
  role_not_assigned:       'errRoleNotAssigned',
  invalid_field:           'errInvalidField',
  no_changes:              'errNoChanges',
  invalid_role_for_delete: 'errInvalidRoleForDelete',
  user_not_found:          'errUserNotFound',
  rate_limited:            'errRateLimited',
  already_at_severity:     'errAlreadyAtSeverity',  // optional — see open question
  not_suspended:           'errNotSuspended',       // optional
  account_suspended:       'errAccountSuspended',   // if target of our action is itself suspended
} as const;

export type ModerationErrorCode = keyof typeof MODERATION_ERROR_KEY_MAP;
```

### ModerationService.searchUsers (new method)

```typescript
// Append to src/services/moderation/ModerationService.ts
export interface SearchUsersQuery {
  q?: string;           // email substring OR uid prefix
  role?: 'buyer' | 'seller' | 'broker' | 'logistics' | 'admin';
  state?: 'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned';
  cursor?: string;      // opaque; null on first page
  limit?: number;       // default 25
}

export interface SearchUsersResult {
  users: Array<{
    localId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    photoURL?: string;
    createdAt?: string;
    sellerStatus?: string;
    brokerStatus?: string;
    logisticsStatus?: string;
    isAdmin?: boolean;
    moderationStatus: {
      state: 'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned';
      severity?: string;
      reasonCategory?: string;
      note?: string | null;
      setAt?: string;
    };
  }>;
  nextCursor: string | null;
}

// inside ModerationService object:
searchUsers: async (query: SearchUsersQuery): Promise<SearchUsersResult> => {
  try {
    const response = await apiClient.get('/api/admin/users/search', { params: query });
    return response.data;
  } catch (error) {
    console.error('Failed to search users', error);
    throw error;
  }
},
```

### ModerationService.getHistory (replace stub)

```typescript
// Replace the throwing stub at ModerationService.ts:176
export interface ModerationActionRow {
  _id: string;
  action: 'suspend' | 'unsuspend' | 'revoke_role' | 'restore_role'
        | 'edit_profile' | 'delete_provider_profile';
  severity: 'feature_limited' | 'blocked_with_review' | 'permanently_banned' | 'none';
  roleAffected?: 'seller' | 'broker' | 'logistics';
  reasonCategory?: 'spam' | 'policy_violation' | 'fraud' | 'other';
  note?: string | null;
  adminUid: string;
  adminEmail: string;
  targetUid: string;
  fieldDiff?: Record<string, { before: unknown; after: unknown }>;
  createdAt: string;  // ISO
}

export interface GetHistoryQuery { limit?: number; cursor?: string; }
export interface GetHistoryResult {
  rows: ModerationActionRow[];
  nextCursor: string | null;
}

// inside ModerationService object:
getHistory: async (
  targetUid: string,
  query: GetHistoryQuery = {},
): Promise<GetHistoryResult> => {
  try {
    const response = await apiClient.get(
      `/api/admin/moderation/${targetUid}/history`,
      { params: query },
    );
    return response.data;
  } catch (error) {
    console.error('Failed to fetch moderation history', error);
    throw error;
  }
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AuthService` god-module for all HTTP | Domain services via `apiClient` (`ModerationService`) | Phase 4 (2026-04-18) | Phase 5 extends `ModerationService`, not `AuthService`. Guardrail: `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` = 0. |
| Per-screen axios calls w/ hardcoded URLs | `apiClient` with baseURL + Bearer + 403 interceptor | Phase 4 | All new Phase 5 HTTP goes through `apiClient`. Identity Toolkit (`signUp/signIn`) stays on plain `axios`. |
| Non-typed errors (`error.response.data`) | `ModerationError` with `.code`, `.status`, `.reasonCategory`, `.note` | Phase 4 | `try/catch` with `if (err instanceof ModerationError)` replaces ad-hoc response-shape sniffing for moderation 403s. |
| Ad-hoc admin-status polling | `useAuth().isAdmin` + `AuthContext.refreshUser()` | Phase 4 | Admin-only screens gate on `useAuth().isAdmin`; no manual `getAdminStatus` calls in screens. |
| `Alert.alert` for all confirmations | `Alert.alert` kept for non-destructive; `TypedConfirmationModal` for destructive (revoke, delete, permaban) | Phase 5 (this phase) | UX step-up for irreversible actions. |

**Deprecated/outdated within this repo (do not use):**
- Adding new methods to `AuthService.ts` — rejected by MOB-01 guardrail.
- Per-screen `axios.get/post` with hardcoded `${API_URL}/...` — migrate to `apiClient` if touched. New code: always `apiClient`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sv-SE` locale is supported by React Native Hermes for `toLocaleString` | Don't Hand-Roll → Date formatting | Low — fallback to manual YYYY-MM-DD string build is a 5-line function. |
| A2 | `axios.CancelToken` still works in axios 1.13.4 | Alternatives Considered → CancelToken | Low — [CITED: axios docs] `CancelToken` deprecated in favor of `AbortController` as of axios 0.22 but still functional. Planner should pick `AbortController` for forward-compat. |
| A3 | Backend `/api/admin/moderation/:uid/history` route will use cursor-based pagination with `nextCursor` in the response | Code Examples → getHistory | Medium — if backend chose offset-based, mobile call signature changes. CONTEXT D-16 leaves this to planner; recommend aligning backend + mobile in same plan. |
| A4 | Backend `/api/admin/users/search` uses `?q=&role=&state=&cursor=&limit=` query params | Code Examples → searchUsers | Medium — same as A3; backend owns the shape, mobile adapts. |
| A5 | `user.moderationStatus.state` is always populated on every user row returned by `/api/admin/users/search` (Phase 1 migration backfilled existing users) | All list rendering | Low — [CITED: Phase 1 migrate-moderation.js backfilled all users with `state: 'active'`]. New users get `state: 'active'` via schema default (DATA-01). |
| A6 | iOS `stickyHeaderIndices` + `ListHeaderComponent` pattern works as described across both platforms on RN 0.83 | Pattern 6 / UI-SPEC §3 | Low — widely-used RN idiom; verify in smoke test. |
| A7 | `KeyboardAvoidingView` with `behavior: 'padding'` on iOS and `'height'` on Android handles the bottom-sheet + TextInput case adequately | ModerationActionModal | Low — existing screens (`SellCarScreen`, `ServiceApplicationScreen`) use this exact pattern. |
| A8 | The existing `AdminDashboardScreen` navigation card shape is the right analog for adding an entry to `AdminModerationScreen` | Pattern 9 — entry point | Low — user should confirm during plan whether the AdminModeration entry lives on AdminDashboardScreen or on the repurposed AdminManagementScreen header. |
| A9 | `react-native-fast-image` is the right image primitive for 32×32 avatar rendering on user rows | Row anatomy | Low — already in dependency tree; standard across CarCard/LatestCarousel. |
| A10 | `ModerationError.code` values are stable across Phase 2/4 (won't change under us) | Error handling | Low — Phase 2 STATE.md locks the error codes; no breaking change expected. |

**If this table shrinks to zero:** run `/gsd-discuss-phase 5` to confirm A3 + A4 with the user before the planner commits to pagination shape.

## Open Questions

1. **Pagination shape: cursor vs offset?**
   - What we know: CONTEXT D-16 leaves it to Claude's discretion. Cursor is preferred in industry for moderation-adjacent use cases (list mutates as admin acts). Offset is simpler.
   - What's unclear: Backend Phase 5 owns the final shape; mobile must match.
   - Recommendation: Backend + mobile plan in the same wave. Use cursor-based; opaque string on mobile side. If backend picks offset, adapt mobile search/history in Wave 1 and proceed.

2. **AdminModerationScreen entry point on `AdminDashboardScreen` — shape?**
   - What we know: UI-SPEC doesn't prescribe the exact entry card on `AdminDashboardScreen`; currently that screen only shows pending requests with tabs.
   - What's unclear: Does the planner add a sticky header button "Модерация пользователей", a nav card near the top, or a tab row option? Or does `AdminManagementScreen` become the entry (repurposed to "all users") with a secondary nav icon to `AdminModerationScreen` for deep-search?
   - Recommendation: Add two nav cards on `AdminDashboardScreen`: one to `AdminManagement` (repurposed list), one to `AdminModeration` (search + filter). Planner picks visual treatment.

3. **`edit_profile` field form — reuse `ServiceProfileScreen` fields or fresh form?**
   - What we know: UI-SPEC §Component 4 prescribes conditional fields; `ServiceProfileScreen.tsx` has broker/logistics fields today but is owner-facing.
   - What's unclear: Do we extract a shared `ProviderProfileFields` component, or inline a shorter form in the modal?
   - Recommendation: Inline the modal form (only identity/contact fields per D-03 whitelist: `companyName`, `phoneNumber`, `telegramUsername`, plus logistics-only `coverageAreas` + `timelines`). Don't refactor ServiceProfileScreen — scope risk.

4. **Typed-confirmation sentinel: email vs UID vs literal?**
   - What we know: CONTEXT D-04 + UI-SPEC Specifics pick **target user's email, trimmed + lowercased**.
   - What's unclear: UI-SPEC §5 locks this, so it's actually decided. Flagging here only because CONTEXT listed as Claude's Discretion — UI-SPEC supersedes.
   - Recommendation: Use email (as UI-SPEC locks).

5. **Quick-action sheet: disabled-state semantics when user has NO provider roles**
   - What we know: CONTEXT §specifics says "show disabled states for impossible actions."
   - What's unclear: If target has no provider role, "Edit profile" and "Delete profile" are both impossible — do we hide them or disable them?
   - Recommendation: Disable (render grey, non-tappable). Preserves consistent action-set layout across rows; admin doesn't wonder why this row has fewer options.

6. **Pre-existing `adminUsers` translation key (translations.ts:131, value 'Администраторы') — rename or coexist?**
   - What we know: UI-SPEC uses `adminUsersTitle: 'Пользователи'` / 'Users' for the repurposed screen header.
   - What's unclear: Does the existing `adminUsers` key still get referenced anywhere? Grep check needed during plan. If it's only used in the repurposed screen's header, rename. If elsewhere (Profile menu?), coexist.
   - Recommendation: Grep before deciding. Likely coexist — `adminUsers` may still mean "Administrators" in a menu item somewhere.

7. **`RefreshControl` on `AdminUserDetailScreen` — what does pull-to-refresh do?**
   - What we know: Pull-to-refresh elsewhere refetches the list.
   - What's unclear: On detail screen, does it refetch user + first page of history, or only history?
   - Recommendation: Refetch both in parallel (`Promise.all([getUser, getHistory])`). Low cost, matches admin expectation.

## Environment Availability

Phase 5 is **pure application code** — the mobile environment already runs fine and Phase 4 shipped without environment changes. This section is included for completeness; nothing is missing.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (dev tooling) | Metro, lint, tests | ✓ | ≥20 (engines) | — |
| npm | package install | ✓ | — | — |
| CocoaPods | iOS Pods for Stripe/RNGestureHandler | ✓ | — | — |
| Xcode 15+ | iOS builds (only at release) | ✓ per CLAUDE.md | — | — |
| Android SDK 36 | Android builds (only at release) | ✓ per CLAUDE.md | — | — |
| Backend `/api/admin/moderation/:uid/history` route | `ModerationService.getHistory` real wiring + `AdminUserDetailScreen` | ✗ **MISSING — Phase 5 ships** | — | Phase 5 Plan must deliver this route BEFORE or in the same wave as the mobile consumer. |
| Backend `/api/admin/users/search` route | `ModerationService.searchUsers` + `AdminModerationScreen` | ✗ **MISSING — Phase 5 ships** | — | Same as above — Phase 5 Plan must deliver. |

**Missing dependencies with no fallback:** None — the two missing backend routes are Phase 5's own deliverables per D-16.

**Missing dependencies with fallback:** The UI-consumer screens for history + search can be stubbed to read from a local mock during development, but the Phase must ship the real routes before phase-close. Recommend dedicated backend plans (05-01 history + 05-02 search) land first, then mobile plans consume in Wave 2+.

## Validation Architecture

> `.planning/config.json` has `workflow.nyquist_validation: true` — this section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.6.3 + react-test-renderer 19.2.0 (mobile) / Jest + supertest + mongodb-memory-server (backend) |
| Config file | `package.json` → `"test": "jest"` (uses default Jest config + `react-native` preset) |
| Quick run command | `npx jest <path/to/file>` |
| Full suite command | `npm test` (mobile) / `npm test` (backend, in `backend-services/carEx-services/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Quick-action menu opens from trailing icon; modal renders per-action fields | unit (component) | `npx jest src/components/__tests__/ModerationActionModal.test.tsx -x` | ❌ Wave 0 |
| UI-01 | Optimistic row update flips badge on confirm; reverts on API error | unit (screen) | `npx jest src/screens/__tests__/AdminManagementScreen.test.tsx -x` | ❌ Wave 0 |
| UI-01 | `ModerationError.code` maps to RU/EN translation key | unit | `npx jest src/constants/__tests__/moderationErrorMap.test.ts -x` | ❌ Wave 0 |
| UI-01 | TypedConfirmationModal disables Confirm until email matches (trimmed+lowercased) | unit (component) | `npx jest src/components/__tests__/TypedConfirmationModal.test.tsx -x` | ❌ Wave 0 |
| UI-02 | `AdminModerationScreen` debounces search 300ms; cancels in-flight requests | unit (hook) | `npx jest src/hooks/__tests__/useDebouncedValue.test.ts -x` + `npx jest src/screens/__tests__/AdminModerationScreen.test.tsx -x` | ❌ Wave 0 |
| UI-02 | Role/state chip filters combine AND; toggle off resets to all | unit (screen) | `npx jest src/screens/__tests__/AdminModerationScreen.test.tsx -x` | ❌ Wave 0 |
| UI-02 | `FlatList.onEndReached` fires fetchNextPage; no-ops when `hasNextCursor=false` | unit (screen) | `npx jest src/screens/__tests__/AdminModerationScreen.test.tsx -x` | ❌ Wave 0 |
| UI-02 | `ModerationService.searchUsers` maps query params correctly | unit (service) | `npx jest src/services/moderation/__tests__/ModerationService.test.ts` | ✅ (add cases) |
| UI-03 | History cards render in most-recent-first order with severity-accented border | unit (component + screen) | `npx jest src/screens/__tests__/AdminUserDetailScreen.test.tsx -x` | ❌ Wave 0 |
| UI-03 | Timestamp formats to `YYYY-MM-DD HH:mm` | unit | `npx jest src/utils/__tests__/formatDate.test.ts -x` | ❌ Wave 0 |
| UI-03 | `ModerationService.getHistory` no longer throws; fetches from real route | unit (service) | `npx jest src/services/moderation/__tests__/ModerationService.test.ts` | ✅ (update existing getHistory case) |
| UI-04 | Unsuspend CTA visible only when `moderationStatus.state !== 'active'` | unit (screen) | `npx jest src/screens/__tests__/AdminUserDetailScreen.test.tsx -x` | ❌ Wave 0 |
| UI-04 | Unsuspend round-trip: opens modal, fires service, appends new history row optimistically, reconciles from backend | integration | `npx jest __tests__/adminModerationUnsuspend.integration.test.tsx -x` | ❌ Wave 0 |
| Backend | `GET /api/admin/moderation/:uid/history` returns rows + nextCursor, admin-only, rate-limited | backend integration | (in backend repo) `npx jest __tests__/moderation/history.test.js` | ❌ Wave 0 (backend) |
| Backend | `GET /api/admin/users/search` returns users + nextCursor, admin-only, supports q/role/state filters | backend integration | (in backend repo) `npx jest __tests__/admin/searchUsers.test.js` | ❌ Wave 0 (backend) |

### Sampling Rate

- **Per task commit:** `npx jest <path/to/touched/file>` — run only the relevant test file on commit.
- **Per wave merge:** `npm test` — run full mobile suite; separately run `npm test` in `backend-services/carEx-services/` for backend tasks.
- **Phase gate:** Both full suites green before `/gsd-verify-work`. Plus manual smoke (HUMAN-UAT) covering: optimistic update happy path, 403 edge case, search debounce feel, pull-to-refresh on detail screen.

### Wave 0 Gaps

New test files + utilities to create before Wave 1 implementation:

- [ ] `src/hooks/__tests__/useDebouncedValue.test.ts` — covers UI-02 debounce
- [ ] `src/utils/__tests__/formatDate.test.ts` — covers UI-03 timestamp format
- [ ] `src/constants/__tests__/moderationErrorMap.test.ts` — covers UI-01 error mapping
- [ ] `src/components/__tests__/ModerationActionModal.test.tsx` — covers UI-01
- [ ] `src/components/__tests__/TypedConfirmationModal.test.tsx` — covers UI-01 destructive
- [ ] `src/components/__tests__/SeverityBadge.test.tsx` — covers D-02 badge color mapping
- [ ] `src/components/__tests__/QuickActionSheet.test.tsx` — covers disabled-state logic per user roles/state
- [ ] `src/screens/__tests__/AdminManagementScreen.test.tsx` — covers UI-01 optimistic flow + admins-only filter
- [ ] `src/screens/__tests__/AdminModerationScreen.test.tsx` — covers UI-02 search + filter + pagination
- [ ] `src/screens/__tests__/AdminUserDetailScreen.test.tsx` — covers UI-03 history + UI-04 unsuspend visibility
- [ ] `__tests__/adminModerationUnsuspend.integration.test.tsx` — covers UI-04 end-to-end round-trip (mirrors Phase 4 `moderation.e2e.integration.test.tsx` pattern)
- [ ] Backend — `backend-services/carEx-services/__tests__/moderation/history.test.js` — covers D-16.1
- [ ] Backend — `backend-services/carEx-services/__tests__/admin/searchUsers.test.js` — covers D-16.2
- [ ] Existing `src/services/moderation/__tests__/ModerationService.test.ts` — add test cases for `searchUsers` method and update `getHistory` from stub-throws to live.

**Framework install:** No install needed — Jest + preset are already in devDependencies. [VERIFIED: package.json L52] Backend already has Jest + supertest + mongodb-memory-server per Phase 1 artifacts.

## Security Domain

> `security_enforcement` not explicitly set in config.json — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Firebase Identity Toolkit — all admin routes gated by `verifyIdToken` (Phase 1 SEC-01). Mobile receives 401 if token invalid/expired. |
| V3 Session Management | yes | Existing AuthContext + AsyncStorage; idToken refresh not implemented (known concern, not Phase 5 scope). `logout()` clears token ref first to prevent stale Bearer on teardown. |
| V4 Access Control | yes | **Backend `requireAdmin` on every admin route** (Phase 1 SEC-02). Mobile `useAuth().isAdmin` is UX gating only — never authorization truth. New Phase 5 routes (`/history`, `/users/search`) MUST reuse the same middleware chain. |
| V5 Input Validation | yes | Backend Zod schemas + `.strict()` mode (Phase 2 D-34). Mobile side: trim + lowercase on typed-email confirmation; length limit on note field (500 chars); reason-category enum (radio) prevents free-text injection. |
| V6 Cryptography | no | No crypto introduced in Phase 5. Existing Firebase + Stripe + TLS transport unchanged. |

### Known Threat Patterns for React Native + Mobile Admin UI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shoulder-surfed admin device performs destructive action | Elevation | TypedConfirmationModal (D-04) — adds friction for destructive paths. UX step-up, not real security. |
| UI renders unsanitized user content (email, note) | Tampering | React Native `<Text>` auto-escapes; no XSS surface. Note field displayed as Text, not rendered HTML. |
| Admin token leaked via log / crash report | Information Disclosure | Existing console.error in services does not log token. [ASSUMED] no Sentry/Bugsnag integrated yet — Phase 5 should not add. |
| Race: admin self-suspends via edit_profile then dispatches more actions in stale session | TOCTOU | Phase 2 D-26 `denySelfModeration` + Phase 3 ENF-01 requireNotSuspended + Phase 4 403 interceptor + refreshUser. **Covered end-to-end.** Phase 5 UI should still Alert the admin if 403 occurs mid-session. |
| Admin impersonation via stolen device (no re-auth) | Spoofing | Deferred — password/biometric re-auth before destructive actions not scoped in this milestone. Document as post-v1 concern. |
| Rate-limit evasion: admin rapidly fires quick actions | DoS | Phase 2 SEC-04 30 actions per 15min per admin; 429 response → `errRateLimited` translation. Mobile shows error banner; does not queue. |
| Leaking another user's reason-category/note to unauthorized viewer | Information Disclosure | Only admins reach the moderation UI — `requireAdmin` middleware gates the routes. Rendering user's own moderation status to the affected user is Phase 6 (`UserStatusBanner`), out of scope here. |
| Accidental mass suspension via bulk-action | Integrity | Out of scope this milestone (deferred MOD2-03) — single-row actions only. |

**Security-relevant Phase 5 decisions already locked:**
- D-04 destructive actions require typed confirmation
- D-08 optimistic with rollback — rollback on error ensures UI state doesn't drift from backend truth
- D-16 backend routes reuse `requireAdmin` + Phase 2 rate limiter — no bypasses

## Sources

### Primary (HIGH confidence)

- **Codebase direct read** — all 9 source files scanned (`AdminManagementScreen.tsx`, `AdminDashboardScreen.tsx`, `AuthContext.tsx`, `AuthService.ts`, `ModerationService.ts`, `errors.ts`, `client.ts`, `theme.ts`, `translations.ts`, `navigation.ts`, `App.tsx`, `FilterBar.tsx`, `FilterModal.tsx`, `SearchBar.tsx`, `OfflineNotice.tsx`, `ServiceApplicationScreen.tsx`, `HomeScreen.tsx`, `MyOrdersScreen.tsx`, `ServiceCartScreen.tsx`, `ProfileScreen.tsx`, `SellCarScreen.tsx`, `useNetwork.ts`, `useAppStateRefresh.ts`, `package.json`)
- **`.planning/phases/05-admin-moderation-ui-mobile/05-CONTEXT.md`** — all 16 decisions locked + canonical references
- **`.planning/phases/05-admin-moderation-ui-mobile/05-UI-SPEC.md`** — full component inventory, palette, typography, copywriting contract (RU+EN)
- **`.planning/phases/04-mobile-plumbing-mobile/04-CONTEXT.md`** — ModerationService surface, ModerationError shape, interceptor behavior
- **`.planning/phases/04-mobile-plumbing-mobile/04-02-SUMMARY.md`** — concrete ModerationService method signatures
- **`.planning/phases/04-mobile-plumbing-mobile/04-04-SUMMARY.md`** — AuthContext refreshUser + refreshUserForced + generation counter
- **`.planning/phases/04-mobile-plumbing-mobile/04-PATTERNS.md`** — Phase 4 pattern map (carried forward: ObjectModuleService, per-method try/catch, useAuth gate, module-level `let` pattern)
- **`.planning/phases/04-mobile-plumbing-mobile/04-REVIEW-FIX.md`** — CR-01/WR-01/WR-02/WR-03 fixes that affect Phase 5 (dedupe path + forced-refresh + generation guard + memoized callbacks)
- **`.planning/phases/02-admin-moderation-endpoints-backend/02-CONTEXT.md`** — backend endpoint shapes, error codes, Phase 2 D-07 (edit-profile role_not_assigned guard)
- **`.planning/REQUIREMENTS.md`** — UI-01..04 + QUAL-01 constraints
- **`.planning/ROADMAP.md`** — Phase 5 success criteria
- **`.planning/STATE.md`** — current position + deferred items
- **`CLAUDE.md`** — project constraints + conventions

### Secondary (MEDIUM confidence)

- React Native 0.83 patterns validated against in-repo usage (`KeyboardAvoidingView`, `Modal` with `animationType="slide"`, `FlatList.onEndReached`, `RefreshControl`) — all have existing call sites.
- Axios 1.x cancellation: `CancelToken` is deprecated but functional; `AbortController` preferred going forward [CITED: axios docs § Cancellation]. No existing usage in the codebase yet — Phase 5 introduces the first.

### Tertiary (LOW confidence)

- Hermes `sv-SE` locale support for `toLocaleString` (A1) — widely assumed to work; fallback to manual formatting mitigates if it doesn't.
- `stickyHeaderIndices` Android consistency (A6) — UI-SPEC locks; planner confirms in smoke test.

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — every package installed; versions verified against `package.json`; zero new deps.
- **Architecture patterns:** HIGH — each of the 9 patterns has a direct in-repo analog with file path + line range.
- **Pitfalls:** HIGH for 1-8 (directly observed in codebase or locked by Phase 4 review), MEDIUM for 9-12 (anticipated based on pattern but not observed yet in this codebase).
- **Validation Architecture:** HIGH — framework already in use; 8 test files exist; new files follow same conventions.
- **Backend route shapes (history + search):** MEDIUM — CONTEXT D-16 leaves exact query-param / response shape to planner; assumptions A3 + A4 document defaults.
- **Severity palette + typography tokens:** HIGH — UI-SPEC locks every value with contrast ratios.

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30-day window — codebase is stable; no external deps likely to shift).

---

*Phase: 05-admin-moderation-ui-mobile*
*Research authored: 2026-04-18 by gsd-researcher*
*Upstream consumed: 05-CONTEXT.md (16 decisions) + 05-UI-SPEC.md (6 components, 70+ translation keys) + CLAUDE.md + 04-* artifacts*
