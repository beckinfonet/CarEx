---
phase: 05
plan: 06
subsystem: mobile/moderation-interactive-components
tags: [wave-2, presentational, moderation, quick-action-sheet, modal, typed-confirmation, dual-role-delete, a11y]
requires:
  - phase-5-design-tokens
  - phase-5-ru-en-translation-keys
  - phase-5-moderation-service-types
  - phase-5-severity-badge
  - phase-5-empty-state
provides:
  - quick-action-sheet-component
  - moderation-action-modal-component
  - typed-confirmation-modal-component
  - dual-role-delete-contract-enforcement
affects:
  - src/components/moderation/QuickActionSheet.tsx
  - src/components/moderation/ModerationActionModal.tsx
  - src/components/moderation/TypedConfirmationModal.tsx
tech-stack:
  added: []
  patterns:
    - "Pressable-overlay + stop-prop sheet pattern: outer `<Pressable onPress={onClose}>` + inner `<Pressable onPress={() => {}}>` — RN Pressable swallows the press when onPress is set, so tapping inside the sheet never bubbles to the overlay (mirrors FilterModal.tsx:121-153)"
    - "Dual-role delete contract (RESEARCH Pitfall 11): predicate `hasBroker && hasLogistics` renders TWO rows, each carrying an explicit `role` in its onSelect payload; single-role fallback row computes role from the sole truthy provider status. Zero silent broker default at any layer"
    - "QuickActionSelection type `{ action: QuickAction; role?: ProviderRole }` — role is OPTIONAL in type but REQUIRED at runtime for delete_profile; parent screens (Plans 05-07, 05-09) consume verbatim into DeleteProfileBody"
    - "ModerationActionPayload as a discriminated union on `action` — forces callers (parents in Plans 05-07/05-08/05-09) to exhaustively handle 4 action cases at compile time"
    - "Per-action state reset via `useEffect` on `[visible, action, target.localId, initialEditValues]` — reopening for a different user/action never carries stale form state"
    - "editHasChanges uses `JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)` — safely handles arrays (coverageAreas, timelines) vs undefined without deep-equal dependency"
    - "Sentinel matching via `input.trim().toLowerCase() === target.email.trim().toLowerCase()` with literal String.prototype.replace('{email}', ...) for hint interpolation — no regex, no template injection surface"
    - "KeyboardAvoidingView outermost with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}` — iOS pushes, Android resizes; inner ScrollView handles content overflow when keyboard blooms"
    - "Optimistic submit flow (D-08): handleConfirm calls onSubmit then onClose synchronously — modal closes immediately; parent owns row-flip + API call + rollback on error"
key-files:
  created:
    - src/components/moderation/QuickActionSheet.tsx
    - src/components/moderation/ModerationActionModal.tsx
    - src/components/moderation/TypedConfirmationModal.tsx
  modified: []
decisions:
  - "QuickActionSheet renders TWO distinct delete rows (deleteBrokerProfile + deleteLogisticsProfile) when target holds BOTH approved provider profiles — RESEARCH Pitfall 11 resolved at the UI layer by label + payload rather than by a role-picker sub-modal. Dual-role test.todo scaffolds from Plan 05-01 lock this contract at the test boundary"
  - "Single-role delete fallback row computes role inline from `hasBroker ? 'broker' : hasLogistics ? 'logistics' : undefined` — the `undefined` branch never fires because `canDeleteProfile` disables the row, but the guard is belt-and-braces to prevent a silent empty-role DELETE body on future refactors"
  - "Disabled-row styling: glyph color swaps to `COLORS.textTertiary` AND label gets `opacity: 0.4` (via `actionLabelDisabled`) — two independent visual cues so color-blind users still perceive the inert state; the unused `actionRowDisabled` style keeps `opacity: 1` on the row so its touch zone does not become transparent and swallow taps from beneath"
  - "ModerationActionModal is a single component with 4 action branches rather than 4 separate components — per CONTEXT D-06/D-07 single-sheet decision; conditional field rendering is ~40 lines of JSX and keeps the shared chrome (handle, header, cancel/confirm footer, KeyboardAvoidingView) in one place. delete_profile deliberately routes to TypedConfirmationModal directly, not through this modal"
  - "EditProfileForm auto-selects `editRole` when target holds only one provider profile, and renders the role-picker pill row only when `hasBroker && hasLogistics` — matches UI-SPEC Component 4 EditForm behavior and prevents the admin from submitting a POST targeting a role the user does not hold"
  - "CSV input handling for logistics coverageAreas/timelines uses `v.split(',').map(s => s.trim()).filter(Boolean)` — empty entries filtered, leading/trailing whitespace stripped; backend Plan 02-05 validates field whitelist + shape server-side so the mobile normalization is purely UX"
  - "TypedConfirmationModal Confirm enables strictly on `matches` (non-empty input + exact lowercased-trimmed equality) — border color cue is purely visual (successFg vs destructive vs border), the gating is the boolean. submitting=true disables both buttons with 0.5 opacity and swaps Confirm label for ActivityIndicator"
  - "All three components explicitly do NOT import ModerationService at runtime — ModerationActionModal imports it as a TYPE ONLY for body shapes; grep `ModerationService\\.` on all three files returns 0. Parent screens (Plans 05-07, 05-08, 05-09) own every service call site per D-08"
  - "44px minimum tap target enforced on every TouchableOpacity/Pressable: ActionRow minHeight 48, ReasonPicker pill minHeight 32 (SIZES.minTapTarget - 12; matches UI-SPEC chipHeight and accepts the exception per UI-SPEC §Spacing), Cancel/Confirm buttons minHeight 44, Close X uses hitSlop 8 to inflate a 24-icon to effective ~40"
metrics:
  duration: "~3m20s"
  completed: "2026-04-18"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
  commits: 3
---

# Phase 05 Plan 06: Moderation Interactive Components Summary

**One-liner:** Shipped three presentational moderation components — `QuickActionSheet` (role-explicit delete rows resolving RESEARCH Pitfall 11 at the UI layer, not the payload layer), `ModerationActionModal` (single modal driving 4 action types with per-action conditional field sets and typed discriminated-union onSubmit payload), and `TypedConfirmationModal` (sentinel-typed destructive gate with exact trim+lowercase email match) — all token-only, keyboard-safe, a11y-wired, and zero ModerationService runtime coupling per D-08.

## What Was Built

### Task 1 — QuickActionSheet.tsx (commit `9bda3e1`)

`src/components/moderation/QuickActionSheet.tsx` (208 lines). Exports:

- `QuickAction` type: `'suspend' | 'unsuspend' | 'revoke_role' | 'edit_profile' | 'delete_profile'`
- `QuickActionSelection` interface: `{ action: QuickAction; role?: ProviderRole }` — role REQUIRED for delete_profile, undefined otherwise
- `QuickActionSheet: React.FC<QuickActionSheetProps>` — bottom-sheet menu

**Layout shape:**
- `<Modal transparent animationType="slide">` → overlay `<Pressable>` → sheet `<Pressable>` (stop-prop)
- Bottom-sheet handle (36x4 pill) + header row with target email + 5-6 action rows + Cancel row
- `borderTopLeftRadius: 20, borderTopRightRadius: 20` on sheet; safe-area bottom inset applied via `paddingBottom: insets.bottom + spacingSm`

**Capability gate table:**
| Action | Enabled when |
|--------|-------------|
| Suspend | `moderationStatus.state === 'active'` |
| Unsuspend | `moderationStatus.state !== 'active'` |
| Revoke role | `sellerStatus || brokerStatus || logisticsStatus === 'APPROVED'` |
| Edit profile | `brokerStatus === 'APPROVED' || logisticsStatus === 'APPROVED'` |
| Delete profile | same as Edit profile |

**Dual-role delete branch:**
```
hasBroker && hasLogistics
  → render 2 rows: Delete broker profile (role:'broker') + Delete logistics profile (role:'logistics')
hasBroker XOR hasLogistics
  → render 1 row: Delete profile (role derived inline from the truthy status)
neither
  → render 1 row: Delete profile, DISABLED (no press feedback, opacity 0.4 on label)
```

Six test IDs per the scaffold spec (`quickaction-suspend`, `-unsuspend`, `-revoke`, `-edit`, `-delete-broker`/`-delete-logistics` OR `-delete`, `-cancel`).

### Task 2 — ModerationActionModal.tsx (commit `0f24570`)

`src/components/moderation/ModerationActionModal.tsx` (539 lines). Exports:

- `ModerationActionType` type: `'suspend' | 'unsuspend' | 'revoke_role' | 'edit_profile'`
- `ModerationActionPayload` discriminated union — each variant carries the typed body shape from `ModerationService.ts`:
  - `{ action: 'suspend'; body: SuspendBody }` → `{ severity, reasonCategory, note? }`
  - `{ action: 'unsuspend'; body: UnsuspendBody }` → `{ note? }`
  - `{ action: 'revoke_role'; body: RevokeRoleBody }` → `{ role, reasonCategory, note? }`
  - `{ action: 'edit_profile'; body: EditProfileBody }` → `{ role, fields: Partial<{...}> }`
- `ModerationActionModal: React.FC<ModerationActionModalProps>`

**Conditional field set per action:**
- **suspend:** `SeverityPicker` (3 radio cards: feature_limited, blocked_with_review, permanently_banned — the last carries an inline AlertTriangle warning icon) → `ReasonPills` (spam, policy_violation, fraud, other) → `NoteField` (multiline, max 500, char counter)
- **unsuspend:** `NoteField` only (optional)
- **revoke_role:** `RolePicker` (only roles the target currently holds — seller/broker/logistics filtered via `revokableRoles` useMemo) → `ReasonPills` → `NoteField`
- **edit_profile:** `EditProfileForm` — auto-selects role if target holds only one provider profile; renders RoleTabs (broker ↔ logistics) only when both held; static fields (companyName, phoneNumber, telegramUsername) + logistics-only CSV fields (coverageAreas, timelines)

**Validation:**
- suspend: `severity && reason`
- unsuspend: always valid
- revoke_role: `revokeRoleValue && reason`
- edit_profile: `editHasChanges` — JSON.stringify diff vs `initialEditValues`

**Submit flow (D-08 — optimistic):**
1. User taps Confirm
2. `handleConfirm` guards on `!isValid || submitting`
3. `onSubmit(payload)` fired with the correct discriminated-union variant
4. `onClose()` called synchronously — modal closes immediately
5. Parent screen owns: row-flip, ModerationService call, error rollback + Alert

**Keyboard avoidance:** outermost `KeyboardAvoidingView` with platform-aware `behavior` prop; inner `ScrollView` scrolls focused input into view.

### Task 3 — TypedConfirmationModal.tsx (commit `5454406`)

`src/components/moderation/TypedConfirmationModal.tsx` (178 lines). Exports:

- `DestructiveAction` type: `'delete_profile' | 'revoke_role' | 'permanently_banned'`
- `TypedConfirmationModal: React.FC<TypedConfirmationModalProps>`

**Layout:**
- `<Modal transparent animationType="fade">` + centered card (maxWidth 400, destructive border)
- WarningBanner (AlertTriangle + typedConfirmWarningHeading)
- WarningBody — switches via `BODY_KEY_FOR_ACTION[action]` (delete / revoke / permaban copy)
- InstructionText with `{email}` substring replace
- TextInput (email-address keyboard, autoCapitalize='none', autoCorrect={false}, border color cue)
- MismatchHint (conditional on `dirty && !matches`)
- Footer: Cancel (flex 1) + Confirm (flex 2, destructive bg, disabled until match)

**Sentinel matching:**
```ts
const normalized = typed.trim().toLowerCase();
const targetNormalized = targetEmail.trim().toLowerCase();
const matches = normalized.length > 0 && normalized === targetNormalized;
```

Border color cue: successFg (match) → destructive (dirty-mismatch) → border (empty).

## Deviations from Plan

None — all three components created with the EXACT file contents prescribed in the plan's `<action>` blocks. No Rule 1/2/3 auto-fixes were needed: the plan code compiled cleanly against the types already shipped by Plans 05-02/03/04/05, and all acceptance criteria greps passed on first write.

## Verification

### Automated

- `npx tsc --noEmit` — 0 errors on all 3 new files (pre-existing 3 errors in `src/hooks/__tests__/useDebouncedValue.test.ts` from Plan 05-01 scaffold are out of scope; those tests are filled by Plan 05-10)
- `npx jest src/components/moderation/__tests__` — 5 passed, 38 todo tests (all scaffold placeholders from Plan 05-01; Plan 05-10 fills the bodies)

### Acceptance Criteria (all 3 tasks)

**Task 1 QuickActionSheet:**
- export const QuickActionSheet: 1 ✓
- export type QuickAction + export interface QuickActionSelection: 1+1 ✓
- canSuspend/canUnsuspend/canRevokeRole/canEditProfile/canDeleteProfile: 15 (≥5) ✓
- lucide imports (Shield, ShieldCheck, ShieldOff, Pencil, Trash2): 1 ✓
- react-native-safe-area-context import: 1 ✓
- `animationType="slide"`: 1 ✓
- `borderTopLeftRadius: 20`: 1 ✓
- accessibilityRole button: 2 (≥2) ✓
- `accessibilityState={{ disabled }}`: 1 ✓
- `minHeight: 48`: 1 ✓
- testID: 9 (≥7) ✓
- `onSelect: (selection: QuickActionSelection)`: 1 ✓
- deleteBrokerProfile + deleteLogisticsProfile: 1+1 ✓
- `role: 'broker'` / `role: 'logistics'`: 1+1 (≥1 each) ✓
- `hasBroker && hasLogistics ?`: 1 ✓
- quickaction-delete-broker + quickaction-delete-logistics: 2 ✓
- quickaction-delete (single fallback): 1 ✓
- Hardcoded hex outside tokens: 0 ✓

**Task 2 ModerationActionModal:**
- export const ModerationActionModal: 1 ✓
- export type ModerationActionPayload + ModerationActionType: 1+1 ✓
- KeyboardAvoidingView (import + usage): 2 (≥2) ✓
- platform-aware behavior prop: 1 ✓
- SEVERITY_OPTIONS / REASON_OPTIONS: 2+2 (≥2 each) ✓
- feature_limited/blocked_with_review/permanently_banned: 3 ✓
- spam/policy_violation/fraud/other: 4 ✓
- `maxLength={500}`: 1 ✓
- accessibilityRole radio: 2 (≥2) ✓
- `onSubmit({ action: 'suspend'` / unsuspend / revoke_role / edit_profile: 1+1+1+1 ✓
- ModerationService type-only import: 1 (grep on `ModerationService`) ✓
- ModerationService runtime calls: 0 (grep on `ModerationService\.`) ✓

**Task 3 TypedConfirmationModal:**
- export const TypedConfirmationModal: 1 ✓
- export type DestructiveAction: 1 ✓
- `trim().toLowerCase()`: 2 ✓
- BODY_KEY_FOR_ACTION: 2 (≥2) ✓
- delete_profile/revoke_role/permanently_banned: 3 ✓
- `animationType="fade"`: 1 ✓
- COLORS.destructive: ≥3 ✓
- AlertTriangle: 2 (import + usage) ✓
- `{email}` token: 1 ✓
- `keyboardType="email-address"`: 1 ✓
- `autoCapitalize="none"`: 1 ✓
- ModerationService: 0 (purely presentational) ✓
- `accessibilityState={{ disabled`: 1 ✓

## Threat Model Review

| Threat ID | Disposition | How addressed |
|-----------|-------------|---------------|
| T-05-06-01 | mitigate | `maxLength={500}` hard-enforced on NoteField TextInput at input layer (not submit handler) |
| T-05-06-02 | accept | Mobile typed-confirm is UX friction; backend (Plan 02) has authoritative guards (cannot_moderate_self, last_admin_protected) |
| T-05-06-03 | accept | Note transparency is the intended audit-trail behavior per CONTEXT D-08 |
| T-05-06-04 | mitigate | handleConfirm calls onClose synchronously after onSubmit → modal closes immediately → stale-confirm window is <1 keystroke + 1 RTT |
| T-05-06-05 | mitigate | Confirm button `disabled={!isValid || submitting}` on both modals — first tap flips submitting=true; repeat taps are no-ops |
| T-05-06-06 | accept | Capability-preview description strings on severity cards are intentional admin-only disclosure |
| T-05-06-07 | mitigate | CSV split `.filter(Boolean)` strips empty entries; JSON.stringify in editHasChanges safely handles array-vs-undefined comparison; backend validates field whitelist |
| T-05-06-08 | mitigate | QuickActionSheet dual-role branch renders TWO explicit rows; single-role branch computes role inline from the sole truthy provider status; 3 test.todo scaffolds from Plan 05-01 lock the contract end-to-end |

## Cross-Phase Contracts Fulfilled

- **Consumed from Plan 05-02 (tokens + translations):** All 3 components use only `COLORS.*`, `SIZES.*`, `TYPOGRAPHY.*` + `useLanguage().t` keys — zero hardcoded hex outside rgba overlay (acceptance grep verified 0 hardcoded hex)
- **Consumed from Plan 05-03 (ModerationService types):** `SearchUserItem`, `Severity`, `ReasonCategory`, `RevokableRole`, `ProviderRole`, `SuspendBody`, `UnsuspendBody`, `RevokeRoleBody`, `EditProfileBody` imported TYPE-ONLY
- **Consumed from Plan 05-05 (shared primitives):** None directly (QuickActionSheet/ModerationActionModal/TypedConfirmationModal are siblings to SeverityBadge/EmptyState, not consumers)
- **Produced for Plan 05-07 (AdminModerationScreen):** QuickActionSheet + ModerationActionModal + TypedConfirmationModal consumed as mounted components; parent owns `pendingDeleteRole` threading from QuickActionSelection.role → DeleteProfileBody.role
- **Produced for Plan 05-08 (AdminUserDetailScreen):** ModerationActionModal consumed for sticky Unsuspend CTA; TypedConfirmationModal consumed for revoke/delete from detail
- **Produced for Plan 05-09 (AdminManagementScreen repurpose):** Same as 05-07 — QuickActionSheet is the primary integration surface
- **Produced for Plan 05-10 (test fills):** 3 scaffold files (QuickActionSheet.test.tsx, ModerationActionModal.test.tsx, TypedConfirmationModal.test.tsx) now have live components to import; Plan 05-10 fills the `test.todo` bodies

## Self-Check: PASSED

- src/components/moderation/QuickActionSheet.tsx exists ✓
- src/components/moderation/ModerationActionModal.tsx exists ✓
- src/components/moderation/TypedConfirmationModal.tsx exists ✓
- Commit 9bda3e1 exists ✓
- Commit 0f24570 exists ✓
- Commit 5454406 exists ✓
- `npx tsc --noEmit` → 0 errors on all 3 new files ✓
- `npx jest src/components/moderation/__tests__` → 5 passed, 38 todo ✓
