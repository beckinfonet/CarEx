# Phase 5: Admin Moderation UI (Mobile) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 05-admin-moderation-ui-mobile
**Areas discussed:** Quick-action trigger UX, Moderation action modal shape, AdminModerationScreen list→detail navigation, Moderation history visual treatment, Backend scope

---

## Quick-action trigger UX

### Trigger style

| Option | Description | Selected |
|--------|-------------|----------|
| Trailing icon → action sheet | Each row gets a trailing ⋮ / Shield icon; tap opens bottom action sheet with 5 actions. Matches existing × (remove-admin) icon pattern. Discoverable, thumb-reachable. | ✓ |
| Long-press row → context menu | Whole row tap for "view details"; long-press opens context menu. iOS-native but low discoverability; new pattern for codebase. | |
| Inline action buttons | 5 small icon buttons per row. Fastest but crowded on narrow phones. | |
| Tap row → full action screen | Tap row to push a dedicated action screen. Adds nav layer per action. | |

**User's choice:** Trailing icon → action sheet
**Notes:** Marked Recommended; chosen. Matches existing AdminManagementScreen icon pattern.

### Row state badge

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — colored severity badge | Small pill next to email: green active, amber feature-limited, red blocked, black banned. | ✓ |
| Yes — icon only | Icon (Shield = active, ShieldAlert = suspended). Less detail. | |
| No — keep rows clean | Status only visible inside detail view. | |

**User's choice:** Yes — colored severity badge
**Notes:** Fast triage value. Extends theme COLORS tokens.

### Screen scope

| Option | Description | Selected |
|--------|-------------|----------|
| Rename & repurpose: list all approved users | AdminManagementScreen becomes main user roster; "Admins only" filter chip preserves today's use. Quick-actions on every row. | ✓ |
| Keep admin-only; put quick-actions on AdminModerationScreen only | AdminManagementScreen stays admin-roster; moderation lives elsewhere. UI-01 wording loses literal accuracy. | |
| Two tabs on same screen | Tab A admins, Tab B all users. Quick-actions on both. | |

**User's choice:** Rename & repurpose: list all approved users
**Notes:** Resolves UI-01 ambiguity directly. Admins rarely moderation targets. Rename vs keep-name is Claude's discretion during planning.

### Confirm style

| Option | Description | Selected |
|--------|-------------|----------|
| Native Alert.alert | Matches existing confirmRemoveAdmin pattern. Zero new components. | |
| Custom modal with typed confirmation | Admin must type sentinel (email/DELETE) before confirm button enables. Extra friction for irreversible actions. | ✓ |
| Single gate in action modal (no double-confirm) | Action modal's primary button fires directly. Fastest, riskiest for delete-profile. | |

**User's choice:** Custom modal with typed confirmation
**Notes:** Applies to destructive actions (Delete provider profile, Revoke role, Suspend at permanent_banned). Non-destructive actions (Unsuspend, Edit, Suspend at feature_limited/blocked_with_review) rely on ModerationActionModal's single Confirm gate.

---

## Moderation action modal shape

### Modal form

| Option | Description | Selected |
|--------|-------------|----------|
| Single modal with all fields | Bottom-sheet modal: severity + reason + note all visible. Matches RN convention for quick forms. | ✓ |
| Two-step wizard | Step 1 severity with capability preview; step 2 reason+note. Visually guides but overkill for 2-3 fields. | |
| Inline expand | Severity as segmented control → reveals reason+note after pick. Middle ground. | |

**User's choice:** Single modal with all fields

### One-vs-many modals

| Option | Description | Selected |
|--------|-------------|----------|
| One modal, conditional fields | ModerationActionModal takes { action, targetUser }; renders right fields per action. | ✓ |
| Separate modal per action | 5 independent components. More files, each trivially simple. | |
| Hybrid — generic for suspend/unsuspend/revoke/delete, dedicated for edit-profile | Different field sets split. | |

**User's choice:** One modal, conditional fields

### Severity UI

| Option | Description | Selected |
|--------|-------------|----------|
| Three radio cards with description + capability preview | Each severity is a tappable card showing consequences. Informed decisions. | ✓ |
| Segmented control (3 buttons) | Compact iOS-style 3-option control. Space-efficient but easy to mis-tap. | |
| Dropdown / picker | Native picker. Hides severity descriptions. | |

**User's choice:** Three radio cards with description

### Optimistic updates

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic with rollback on error | Close modal, apply new state to row immediately; revert + Alert on error. | ✓ |
| Wait for API, show pending state | Subtle spinner on row until API returns. Slower feel. | |
| Keep modal open with loading state | Confirm button spinner; modal closes only on 200. Safest but slowest. | |

**User's choice:** Optimistic with rollback on error

---

## AdminModerationScreen list→detail navigation

### Detail navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Push AdminUserDetailScreen | Stack-nav pattern matching CarDetails/ServiceDetails. Natural back button, deep-linkable. | ✓ |
| Bottom sheet modal | Sheet over the list; stays in context. Requires new component. | |
| Inline expanded row (accordion) | Row expands in place. Awkward for long history. | |

**User's choice:** Push AdminUserDetailScreen

### Search UX

| Option | Description | Selected |
|--------|-------------|----------|
| Live debounced search (300ms) | Auto-updates after 300ms pause. Standard mobile pattern. | ✓ |
| Explicit search button | Type + tap Search. Saves API calls; sluggish feel. | |
| Live — no debounce | Query per keystroke. Too chatty. | |

**User's choice:** Live debounced search (300ms)

### Filter UX

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal chip row under search bar | Scrollable chips: role + state groups. Matches existing FilterBar pattern. | ✓ |
| Filter icon → bottom sheet | Icon in header opens filter sheet. Hides current filter state. | |
| Segmented control + dropdown | Permanent screen space; always visible. | |

**User's choice:** Horizontal chip row under search bar

### Pagination

| Option | Description | Selected |
|--------|-------------|----------|
| Infinite scroll via FlatList onEndReached | Matches existing list patterns (HomeScreen, Services). | ✓ |
| Explicit "Load more" button | Safer, extra friction. Less common in mobile. | |
| Numbered pagination | Desktop-style; doesn't fit codebase conventions. | |

**User's choice:** Infinite scroll via FlatList onEndReached

---

## Moderation history visual treatment

### History UI

| Option | Description | Selected |
|--------|-------------|----------|
| Card list, severity-accented left border | Each card: action + severity, admin + timestamp, reason chip, note. Matches CarEx card patterns. | ✓ |
| Compact timeline with left-rail dots | Visual chronology emphasis. More custom code. | |
| Dense table rows | 4-column layout. Good for many entries; less mobile-native. | |

**User's choice:** Card list, severity-accented

### Unsuspend CTA

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky header card above history list | Top of AdminUserDetailScreen: summary + Unsuspend button (visible if state !== active). Always reachable. | ✓ |
| Inline after most recent suspend entry | Hidden if admin scrolls past. | |
| Floating action button (FAB) | Heavy for single action; FAB not used elsewhere in CarEx. | |

**User's choice:** Sticky header card above history list

### Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Flat list, absolute timestamps | Simpler; audit thin per user. | ✓ |
| Grouped by relative date | Today/Yesterday/This month/Older. Overkill for common case. | |

**User's choice:** Flat list, absolute timestamps

---

## Backend scope

| Option | Description | Selected |
|--------|-------------|----------|
| Ship it in Phase 5 | Phase 5 adds GET /api/admin/moderation/:targetUid/history AND GET /api/admin/users/search. Clean, no separate phase. | ✓ |
| Split — history in Phase 5, search in Phase 4.5 | History is tiny; search more involved. Cleaner boundary but extra phase. | |
| Reuse existing admin-users list endpoint | Filter client-side. Works only if user count small and endpoint supports query params. | |

**User's choice:** Ship it in Phase 5
**Notes:** Phase 5 plan will include backend plans for these two routes plus mobile plans that consume them.

---

## Claude's Discretion

Areas where the user deferred to Claude during planning:
- Exact trailing-icon glyph
- Page size for pagination (suggested 25)
- Severity badge exact color tokens (may extend theme COLORS)
- Typed-confirmation sentinel (email vs "DELETE" vs UID)
- Animation timings, skeleton vs ActivityIndicator, empty-state copy
- Search bar placement (header vs above list)
- Whether AdminManagementScreen is renamed or kept with widened scope

## Deferred Ideas

- Superadmin-only gating of certain actions
- Offline queueing of moderation actions
- Moderator handoff notes / pinned notes (v2)
- Bulk selection with per-row confirm (v2)
- Empty-state illustration polish
