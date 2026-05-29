# Phase 10: Mobile Plumbing + Admin Listing UI — Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 14 (mobile) + 3 (backend) + 10 (test stubs) = 27
**Analogs found:** 27 / 27 (every target has an in-repo precedent — Phase 10 is overwhelmingly wiring + sibling-component creation, NOT build-from-scratch)

## File Classification

### Mobile — code files

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/moderation/errors.ts` (MODIFIED) | service / error class | n/a | self (`ModerationError` class above the new class in the same file) | exact (same file, sibling class) |
| `src/services/moderation/ModerationService.ts` (MODIFIED) | mobile service | request-response (axios → backend) | self (existing `suspend` / `restoreRole` / `searchUsers` methods at lines 168-319) | exact (same module, new section) |
| `src/components/moderation/ListingModerationBottomSheet.tsx` (NEW) | mobile component | event-driven (user action emit) | `src/components/moderation/QuickActionSheet.tsx` | exact (same shape, different vocabulary) |
| `src/components/moderation/ListingModerationReasonModal.tsx` (NEW) | mobile component | event-driven (form submit) | `src/components/moderation/ModerationActionModal.tsx` | role-match (sibling, NOT reuse — distinct 5-value taxonomy) |
| `src/components/moderation/ListingRestoreModal.tsx` (NEW) | mobile component | event-driven (form submit) | `src/components/moderation/ModerationActionModal.tsx` (note-only branch at lines 184-189) | role-match (thinner sibling — note-only, no reasonCategory) |
| `src/utils/listingTitle.ts` (NEW) | shared util | transform (pure function) | `src/utils/passwordPolicy.ts` | role-match (small pure-function module with named exports) |
| `src/screens/CarDetailsScreen.tsx` (MODIFIED) | mobile screen | request-response + event-driven | self (existing state hooks at lines 23-49, axios.get at line 112, headerRight area at line 451) | exact (same file additions) |
| `src/screens/SellCarScreen.tsx` (MODIFIED) | mobile screen | request-response (multipart submit) | self (existing edit-mode gates at lines 76, 87, submit at 439) | exact (conditional branches added to existing gates) |
| `src/screens/AdminModerationScreen.tsx` (MODIFIED) | mobile screen | request-response (paginated read) | self (existing user search + filter + pagination at lines 67-200, 597-611, ChipButton) | exact (parallel state buckets, port pattern) |
| `src/types/navigation.ts` (MODIFIED) | mobile types | n/a | self (existing `SellCar: { carId?: string } \| undefined` at line 4) | exact (widen existing type) |
| `src/constants/translations.ts` (MODIFIED) | mobile constants | n/a | existing translation key additions (per-phase) | exact |

### Mobile — test stubs (Wave 0)

| New File | Role | Closest Analog |
|----------|------|----------------|
| `src/services/moderation/__tests__/listingErrors.test.ts` | mobile test (unit) | existing `src/services/moderation/__tests__/` tests for `errors.ts` and `ModerationService.ts` |
| `src/services/moderation/__tests__/listingMethods.test.ts` | mobile test (unit, axios-mock) | existing `__tests__/ModerationService` test for the 7 existing methods |
| `src/services/http/__tests__/clientListing409.test.ts` | mobile test (regression) | existing `client.test.ts` for 403/account_suspended (asserts inverse — 409 does NOT hit interceptor) |
| `src/utils/__tests__/listingTitle.test.ts` | mobile test (unit, pure fn) | existing `src/utils/__tests__/passwordPolicy.test.ts` (if present) |
| `src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx` | mobile test (RNTL) | existing `QuickActionSheet` tests under `src/components/moderation/__tests__/` |
| `src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx` | mobile test (RNTL) | existing `ModerationActionModal` tests |
| `src/components/moderation/__tests__/ListingRestoreModal.test.tsx` | mobile test (RNTL) | existing `ModerationActionModal` tests (unsuspend branch shape) |
| `src/screens/__tests__/CarDetailsScreen.admin.test.tsx` | mobile test (screen integration) | existing AdminModerationScreen tests |
| `src/screens/__tests__/SellCarScreen.adminEdit.test.tsx` | mobile test (screen integration) | existing SellCarScreen edit-mode tests (if any) |
| `src/screens/__tests__/AdminModerationScreen.tabs.test.tsx` | mobile test (screen integration) | existing AdminModerationScreen tests |

### Backend — cross-repo slice

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `../backend-services/carEx-services/src/moderation/listingRouter.js` (MODIFIED) | backend route | request-response (GET, paginated) | `../backend-services/carEx-services/src/admin/router.js:93-206` (GET /users/search) | exact (verbatim port with Car substitutions) |
| `../backend-services/carEx-services/src/moderation/listingService.js` (MODIFIED) | backend service | CRUD-read (cursor paginated) | same `admin/router.js:93-206` inline service logic (no separate service module for searchUsers) | role-match (port pattern; Phase 10 keeps Phase 8's pattern of separate service module) |
| `../backend-services/carEx-services/src/moderation/listingSchemas.js` (MODIFIED) | backend schema | validation | self (`restoreListingSchema` at lines 55-57) | exact (sibling Zod `.strict()` schema in same file) |
| `../backend-services/carEx-services/src/moderation/__tests__/listingRouter.search.test.js` (NEW) | backend test | request-response | existing `__tests__/listingRouter.suspend.test.js` (Phase 8) | exact (same test harness + supertest pattern) |

---

## Pattern Assignments

### `src/services/moderation/errors.ts` (MODIFIED — sibling error class)

**Analog:** Same file. `ModerationError` (lines 1-12) is the precedent. Phase 10 appends `ListingModerationError` immediately after — same file, parallel construction.

**Existing pattern to mirror** (`errors.ts` lines 1-12):

```typescript
export class ModerationError extends Error {
  constructor(
    public code: 'account_suspended' | 'provider_suspended' | 'user_not_found' | 'deprecated' | string,
    public status?: string,        // moderationStatus.state — 'blocked_with_review' | 'feature_limited' | 'permanently_banned'
    public reasonCategory?: string,
    public note?: string,
    public httpStatus?: number,
  ) {
    super(`ModerationError: ${code}`);
    this.name = 'ModerationError';
  }
}
```

**KEEP from analog:**
- `extends Error` (not a custom base class)
- All-public-readonly constructor-parameter properties (no separate field declarations)
- String-union `code` with `| string` escape hatch for future codes
- `super(\`${ClassName}: ${code}\`)` message format
- Explicit `this.name = 'ListingModerationError'` assignment after super (D-14 + RESEARCH §Code Examples)

**CHANGE for new class:**
- Union of 10 codes (see CONTEXT D-14 + RESEARCH Code Examples §"Code coverage map" — recommend adding `invalid_make` + `invalid_model` to make 10 total)
- Listing-specific context fields: `listingStatus`, `reasonCategory`, `banner`, `refundId`, `refundFailed`, `httpStatus`
- Anti-pattern: do NOT widen `ModerationError` union — Phase 4 D-07 scoped that class. Sibling only.

---

### `src/services/moderation/ModerationService.ts` (MODIFIED — extend, don't split)

**Analog:** Same file. Existing 7 methods at lines 168-319 establish the shape. Closest analogs:
- For PATCH-with-body methods (`suspendListing`, `archiveListing`, `deleteListing`, `restoreListing`): existing `unsuspend` at lines 186-197 (PATCH with body, error catch + console.error + re-throw).
- For multipart PATCH (`adminEditListing`): no existing precedent in ModerationService; closest in repo is `SellCarScreen.tsx:439-441` (apiClient.put + multipart Content-Type header).
- For paginated GET (`searchListings`): existing `searchUsers` at lines 260-279 (apiClient.get + params + AbortSignal + `isAbortError` guard).

**Existing PATCH method to mirror** (`ModerationService.ts:186-197`):

```typescript
unsuspend: async (targetUid: string, body: UnsuspendBody = {}) => {
  try {
    const response = await apiClient.patch(
      `/api/admin/moderation/${targetUid}/unsuspend`,
      body,
    );
    return response.data;
  } catch (error) {
    console.error('Failed to unsuspend user', error);
    throw error;
  }
},
```

**Existing paginated GET method to mirror** (`ModerationService.ts:260-279`):

```typescript
searchUsers: async (
  query: SearchUsersQuery,
  config?: { signal?: AbortSignal },
): Promise<SearchUsersResult> => {
  try {
    const response = await apiClient.get('/api/admin/users/search', {
      params: query,
      signal: config?.signal,
    });
    return response.data;
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    console.error('Failed to search users', error);
    throw error;
  }
},
```

**Existing module-private helper to mirror** (`ModerationService.ts:34-38`):

```typescript
function isAbortError(err: unknown): boolean {
  if (axios.isCancel?.(err)) return true;
  const name = (err as { name?: string } | null)?.name;
  return name === 'CanceledError' || name === 'AbortError';
}
```

**KEEP from analogs:**
- `try / catch + console.error('Failed to <verb>', error) + throw error` skeleton in EVERY new method
- Section-comment convention (`// --- Admin writes ---` at line 169, `// --- Reads ---` at line 281) — add `// --- Listing moderation writes ---` and `// --- Listing moderation reads ---`
- Module-level object export (`export const ModerationService = { ... }`) — NEVER a class
- Apicl ient as the single HTTP entry point (`apiClient.patch / get`)
- AbortSignal threading via `config?.signal` for the paginated GET (mirrors `searchUsers`)
- `isAbortError(err)` guard before `console.error` for AbortSignal-bearing methods
- TypeScript interface exports for body/result types at top of file (current convention at lines 40-166)

**CHANGE for new methods:**
- Replace bare `throw error` with `throw toListingModerationError(error)` for the 5 write methods (per RESEARCH §Code Examples — `toListingModerationError` is a NEW module-private helper alongside `isAbortError`)
- `searchListings` does NOT throw `ListingModerationError` — raw axios error surfaces to caller's EmptyState (RESEARCH lines 916-921)
- `adminEditListing` accepts STRUCTURED input `{ fields, existingImageUrls?, newFiles? }` (not raw FormData) — service assembles multipart; mirrors RESEARCH §Claude's Discretion recommendation
- `adminEditListing` MUST set explicit `headers: { 'Content-Type': 'multipart/form-data' }` (RESEARCH Pitfall 9 — axios + RN FormData polyfill requires explicit header)
- Path shape: `/api/admin/moderation/listings/:carId[/<action>]` (NOT `/api/admin/moderation/:targetUid[/<action>]`)

---

### `src/components/moderation/ListingModerationBottomSheet.tsx` (NEW)

**Analog:** `src/components/moderation/QuickActionSheet.tsx` (full file, 211 lines) — exact-shape precedent.

**Modal + overlay shape to mirror** (`QuickActionSheet.tsx:61-145`):

```typescript
return (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + SIZES.spacingSm }]} onPress={() => {}}>
        <View style={styles.handle} />
        <View style={styles.header} accessible accessibilityLabel={`${T.actionSuspend} ${target.email}`}>
          <Text style={styles.headerEmail} numberOfLines={1}>{target.email}</Text>
        </View>
        <ActionRow
          icon={<Shield size={20} color={canSuspend ? COLORS.accent : COLORS.textTertiary} />}
          label={T.actionSuspend}
          disabled={!canSuspend}
          onPress={() => fire({ action: 'suspend' })}
          testID="quickaction-suspend"
        />
        {/* ... more rows ... */}
        <TouchableOpacity style={styles.cancelRow} onPress={onClose} testID="quickaction-cancel">
          <Text style={styles.cancelText}>{T.modalCancel}</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);
```

**Internal ActionRow component to mirror** (`QuickActionSheet.tsx:148-167`):

```typescript
const ActionRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}> = ({ icon, label, disabled, onPress, testID }) => (
  <TouchableOpacity
    style={[styles.actionRow, disabled && styles.actionRowDisabled]}
    disabled={disabled}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    accessibilityLabel={label}
    testID={testID}
  >
    {icon}
    <Text style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}>{label}</Text>
  </TouchableOpacity>
);
```

**StyleSheet to copy verbatim** (`QuickActionSheet.tsx:169-210`):

```typescript
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SIZES.spacingSm,
  },
  handle: {
    width: SIZES.bottomSheetHandleWidth,
    height: SIZES.bottomSheetHandleHeight,
    borderRadius: SIZES.bottomSheetHandleHeight / 2,
    backgroundColor: COLORS.textTertiary,
    alignSelf: 'center',
    marginBottom: SIZES.spacingSm,
  },
  // ... (header, headerEmail, actionRow, actionLabel, cancelRow, cancelText — copy verbatim)
});
```

**Imports header to mirror** (`QuickActionSheet.tsx:1-7`):

```typescript
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shield, ShieldCheck, ShieldOff, Pencil, Trash2 } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';
```

**KEEP from analog:**
- `Modal + transparent + animationType="slide" + onRequestClose` exactly
- Outer `<Pressable onPress={onClose}>` overlay + inner `<Pressable onPress={() => {}}>` sheet (no-op inner press stops bubbling)
- `useSafeAreaInsets()` + `paddingBottom: insets.bottom + SIZES.spacingSm`
- `<View style={styles.handle} />` decorative grab handle
- Internal `ActionRow` functional component pattern (inline in same file)
- `testID` props on every actionable row for RNTL tests
- Cancel row at bottom with `T.modalCancel`
- Use `t as unknown as Record<string, string>` cast (line 40) — the project-wide convention for tightening `useLanguage().t` access

**CHANGE for new component:**
- Props shape: `{ visible, listingTitle, moderationBadge?, onSelect, onClose }` (RESEARCH lines 388-401) instead of user-domain `target: SearchUserItem`
- Header renders `listingTitle` (year + make + model) instead of `target.email`
- Status-aware body: when `moderationBadge` present → reasonCategory chip + single Restore button; when absent (active) → 4 action rows (Edit / Suspend / Archive / Delete)
- Icons: `Pencil` / `Shield` / `Archive` / `Trash2` / `RotateCcw` / `ShieldAlert` (lucide; mostly already imported in QuickActionSheet; add `Archive` + `RotateCcw` + `ShieldAlert`)
- `ListingModerationAction` enum type: `'edit' | 'suspend' | 'archive' | 'delete' | 'restore'`
- `onSelect(action)` emits a single string (not `{ action, role }` object) — listings have no role concept

---

### `src/components/moderation/ListingModerationReasonModal.tsx` (NEW — sibling, NOT reuse)

**Analog:** `src/components/moderation/ModerationActionModal.tsx` (full file). Critical: this is a SIBLING per D-04, NOT a generalization. Copy modal SHAPE; do NOT import the existing component or its enums.

**Modal + KeyboardAvoidingView shape to mirror** (`ModerationActionModal.tsx:136-156`):

```typescript
return (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + SIZES.spacingSm }]} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{T[titleKeyForAction(action)]}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button"
              accessibilityLabel={T.modalCancel} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <X size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* per-action fields */}
          </ScrollView>
          {/* footer Confirm/Cancel */}
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>
);
```

**Reason-options module-level constant to mirror** (`ModerationActionModal.tsx:46-51`):

```typescript
const REASON_OPTIONS: Array<{ value: ReasonCategory; key: string }> = [
  { value: 'spam',              key: 'reasonSpam' },
  { value: 'policy_violation',  key: 'reasonPolicyViolation' },
  { value: 'fraud',             key: 'reasonFraud' },
  { value: 'other',             key: 'reasonOther' },
];
```

**Per-action title-key helper to mirror** (`ModerationActionModal.tsx:53-57`):

```typescript
const titleKeyForAction = (action: ModerationActionType): string =>
  action === 'suspend' ? 'actionSuspend' :
  action === 'unsuspend' ? 'actionUnsuspend' :
  action === 'revoke_role' ? 'actionRevokeRole' :
  'actionEditProfile';
```

**State reset on open to mirror** (`ModerationActionModal.tsx:87-96`):

```typescript
useEffect(() => {
  if (visible) {
    setSeverity(null);
    setReason(null);
    setNote('');
    setRevokeRoleValue(null);
    setEditFields(initialEditValues ?? {});
  }
}, [visible, action, target.localId, initialEditValues]);
```

**KEEP from analog:**
- `Modal + transparent + animationType="slide" + KeyboardAvoidingView + Platform.OS === 'ios' ? 'padding' : 'height'`
- Outer Pressable overlay + inner Pressable sheet pattern (same as QuickActionSheet)
- `useSafeAreaInsets()` + `paddingBottom: insets.bottom + SIZES.spacingSm`
- Header with title + X close button + hitSlop 8px
- `ScrollView` inside the sheet for long bodies
- Confirm/Cancel footer at bottom of sheet
- `useEffect(() => { if (visible) reset state }, [visible, ...])` reset-on-open pattern
- Module-level `REASON_OPTIONS` / `titleKeyForAction` constants (NOT inline in render)
- `submitting?: boolean` + `onSubmit` + `onClose` prop convention
- `t as unknown as Record<string, string>` cast for translations
- `isValid` derived state controlling Confirm-button disable + visual opacity
- StyleSheet at bottom of file (per CLAUDE.md "Code Style")

**CHANGE for new component:**
- Action union: `'suspend' | 'archive' | 'delete'` (NO `unsuspend` / `revoke_role` / `edit_profile`)
- Reason taxonomy: 5 values (`spam | policy_violation | fraud | inactive_seller | other`) — distinct module-level `LISTING_REASON_OPTIONS` constant; DO NOT import `REASON_OPTIONS` from `ModerationActionModal.tsx`
- NO severity picker (listings have no severity tier)
- NO role picker (listings have no role concept)
- NO edit-profile field set (Edit is routed through SellCarScreen per D-05)
- Props: `{ visible, action, carId, listingTitle, submitting?, onSubmit(payload: { reasonCategory, note? }), onClose }` per RESEARCH lines 948-956
- Delete branch: header copy reflects destructive intent; Confirm button uses `COLORS.destructive` (mirror existing `confirmButton` background-color pattern from `TypedConfirmationModal.tsx:170-178`)
- Translation keys: `listingReasonSpam` / `listingReasonPolicyViolation` / `listingReasonFraud` / `listingReasonInactiveSeller` / `listingReasonOther` (RESEARCH lines 959-965 — distinct from user-domain `reasonSpam` keys to keep enums grep-able for Phase 11 LQUAL-03)

---

### `src/components/moderation/ListingRestoreModal.tsx` (NEW — thinner sibling)

**Analog:** `ModerationActionModal.tsx:184-189` (the `unsuspend` branch — note-only field, no severity, no role). Also draws on `TypedConfirmationModal.tsx` overall card shape for the "confirm only" minimal-fields case.

**Note-only branch to mirror** (`ModerationActionModal.tsx:184-189`):

```typescript
{action === 'unsuspend' && (
  <>
    <FieldLabel text={T.fieldNote} />
    <NoteField value={note} onChange={setNote} placeholder={T.fieldNotePlaceholder} disabled={submitting} />
  </>
)}
```

**KEEP from analog:**
- Same Modal + KeyboardAvoidingView shell as `ListingModerationReasonModal`
- Single multiline note input (max 2000 chars to match `restoreListingSchema` cap from backend)
- Confirm/Cancel footer with `onSubmit({ note? })` payload
- `useEffect(() => { if (visible) setNote('') }, [visible])` reset pattern

**CHANGE for new component:**
- Props: `{ visible, carId, submitting?, onSubmit(body: { note? }), onClose }` per D-06
- Header copy: "Restore listing" (not "Suspend" / "Archive" / "Delete")
- Confirm button uses `COLORS.successFg` or accent color (NOT destructive) — Restore is constructive
- Body: just label + multiline note input — no reason picker (D-06 + Phase 8 D-C symmetry)
- Single-purpose modal — does NOT take an `action` prop (always restore)

---

### `src/utils/listingTitle.ts` (NEW)

**Analog:** `src/utils/passwordPolicy.ts` (full file, 21 lines) — small pure-function module with named exports.

**Existing module shape to mirror** (`passwordPolicy.ts:1-22`):

```typescript
export const PASSWORD_MIN_LENGTH = 7;

export type PasswordRequirementId = 'length' | 'uppercase' | 'number' | 'symbol';

export interface PasswordRequirementCheck {
  id: PasswordRequirementId;
  met: boolean;
}

export function getPasswordRequirementChecks(password: string): PasswordRequirementCheck[] {
  return [
    { id: 'length', met: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'uppercase', met: /[A-Z]/.test(password) },
    { id: 'number', met: /\d/.test(password) },
    { id: 'symbol', met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function passwordMeetsPolicy(password: string): boolean {
  return getPasswordRequirementChecks(password).every((c) => c.met);
}
```

**Canonical concatenation reference** (`CarCard.tsx:34` shows the existing make+model precedent — but Phase 10 LOCKS year+makeName+modelName per D-08 + Pitfall 6):

```typescript
<Text style={styles.title}>{data.make} {data.model}</Text>
```

`CarCard` uses `{make} {model}` (no year); `CarDetailsScreen.tsx:559` uses `{car.make} {car.model}{trimLevel?} {car.year}`. Phase 10 deliberately DIVERGES from these to lock the Phase 9 D-05 backend-thin-payload format (`${year} ${makeName} ${modelName}`).

**KEEP from `passwordPolicy.ts`:**
- Plain TypeScript module — no React, no imports from project code
- Named-export functions (no default export)
- Functions return concrete values (string), not Promises
- Type/interface exports alongside function exports
- File-top constants/types, functions below

**CHANGE / write for new module:**
- Single pure function `buildListingTitle(car)` returning `${year} ${makeName} ${modelName}` (whitespace-trimmed, falls back to `makeId` / `modelId` if names missing per D-08b)
- Sentinel match helper `matchesListingTitleSentinel(input, car)` — trimmed + lowercased compare (D-08a)
- Single source of truth — every call site must import from this module (CarDetailsScreen bottom-sheet header + TypedConfirmationModal sentinel target both consume the same string per Pitfall 6)

---

### `src/screens/CarDetailsScreen.tsx` (MODIFIED — admin Moderate badge + bottom sheet + banners)

**Analog:** Self. Existing state hooks at lines 23-49, headerRight icon area at line 451, axios deep-link fetch at lines 108-130.

**Existing state-hook block to mirror** (`CarDetailsScreen.tsx:23-46`):

```typescript
export const CarDetailsScreen = () => {
  const { width, height } = useWindowDimensions();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setCar } = useCart();
  // ...
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { carId } = route.params as { carId: string };
  // ...
  const [fetchedCar, setFetchedCar] = useState<any>(null);
  const [carLoading, setCarLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [localListingStatus, setLocalListingStatus] = useState<string | null>(null);
  // ...
  const [paymentWarningVisible, setPaymentWarningVisible] = useState(false);
  const [contactGateVisible, setContactGateVisible] = useState(false);
```

**Existing deep-link fetch to migrate** (`CarDetailsScreen.tsx:108-130` — currently `axios.get`, RESEARCH A6 says migrate to `apiClient.get`):

```typescript
useEffect(() => {
  const existingCar = CARS.find(c => c.id === carId) || (route.params as any).carData;
  if (carId && !existingCar) {
    setCarLoading(true);
    axios.get(`${API_URL}/api/cars/${carId}`)                  // ← migrate to apiClient.get(`/api/cars/${carId}`)
      .then(res => {
        const c = res.data;
        setFetchedCar({ /* ... */ });
```

**Existing isAdmin gating precedent** (project-wide; e.g., `AdminModerationScreen.tsx:76-80`):

```typescript
const auth = useAuth() as unknown as {
  user: { localId?: string } | null;
  refreshUser: () => Promise<void>;
  refreshUserForced?: () => Promise<void>;
};
```

**KEEP from analog:**
- `useState<any>` for fetchedCar + boolean flags for modal visibility (existing convention)
- `route.params as { carId: string }` cast pattern for route param access
- `t as unknown as Record<string, string>` cast for translation keys (project-wide convention from QuickActionSheet line 40, AdminModerationScreen line 72)
- Inline conditional rendering (`{isAdmin && (...)}`) — existing isOwner/isBooker patterns at lines 65-68
- `Alert.alert(t.error, 'message')` for non-recoverable errors (existing pattern at line 95)
- Pressable buttons in headerRight area (existing share/edit icons at line 451)

**CHANGE / ADD:**
- New imports: `useAuth` (already imported at line 15 — extract `isAdmin`); `ShieldAlert` icon from lucide-react-native; `ListingModerationBottomSheet`, `ListingModerationReasonModal`, `ListingRestoreModal`, `TypedConfirmationModal` from `../components/moderation/*`; `ModerationService` from `../services/moderation/ModerationService`; `ListingModerationError` from `../services/moderation/errors`; `buildListingTitle` from `../utils/listingTitle`
- New state hooks: `bottomSheetVisible`, `reasonModalAction`, `restoreModalVisible`, `typedConfirmVisible`, `pendingDeletePayload`, `errorBanner` (RESEARCH lines 989-995)
- Migrate `axios.get(\`${API_URL}/api/cars/${carId}\`)` → `apiClient.get(\`/api/cars/${carId}\`)` (RESEARCH A6 — required for the 401-refresh interceptor to fire on this fetch too)
- Admin Moderate badge in headerRight: `{isAdmin && <TouchableOpacity onPress={() => setBottomSheetVisible(true)}><ShieldAlert size={24} color={COLORS.warning} /></TouchableOpacity>}` (RESEARCH lines 1001-1005)
- Status banner above actionButtonsRow when `isAdmin && fetchedCar?.moderationBadge` (D-17 + RESEARCH lines 1008-1013)
- Error banner for `ListingModerationError` (D-15 + RESEARCH lines 1016-1023)
- Optimistic-flip handler `handleListingActionSubmit(action, body)` snapshotting BOTH `status` AND `moderationBadge` (Pitfall 2)
- Bottom-sheet + reason-modal + typed-confirm + restore-modal mount block at end of return (RESEARCH lines 1025-1092)
- Inline conditional render — `TypedConfirmationModal` receives `keyboardType="default"` prop (Pitfall 3 — new prop added to that component; planner choice (a) per Pitfall 3)

---

### `src/screens/SellCarScreen.tsx` (MODIFIED — `adminEdit` route flag bypass)

**Analog:** Self. Existing edit-mode gates at lines 30-31, 76, 87-88, 501, 439.

**Existing route-param destructure to mirror** (`SellCarScreen.tsx:29-31`):

```typescript
const route = useRoute<RouteProp<RootStackParamList, 'SellCar'>>();
const carId = route.params?.carId;
const isEditMode = !!carId;
```

**Existing seller-status gate to add admin bypass to** (`SellCarScreen.tsx:75-79`):

```typescript
useEffect(() => {
  if (user && user.sellerStatus === 'APPROVED') {
    checkProfileAndAutofill();
  }
}, [user]);
```

**Existing car-fetch gate to add admin bypass to** (`SellCarScreen.tsx:87-148`):

```typescript
useEffect(() => {
  if (carId && user?.sellerStatus === 'APPROVED') {
    const fetchCar = async () => {
      setLoadingCar(true);
      try {
        const res = await apiClient.get(`/api/cars/${carId}`);
        const c = res.data;
        if (c.sellerId !== user?.localId) {
          Alert.alert(t.error, 'Not authorized to edit this listing.');
          navigation.goBack();
          return;
        }
        // ... setFormData(...) ...
```

**Existing GatedScreenWrapper to bypass** (`SellCarScreen.tsx:499-509`):

```typescript
return (
  <SafeAreaView style={styles.container}>
    <GatedScreenWrapper capability="create_listing">
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{isEditMode ? t.editListing : t.sellHeader}</Text>
      <View style={{ width: 40 }} />
    </View>
```

**Existing submit branch to swap endpoint** (`SellCarScreen.tsx:437-458`):

```typescript
try {
  if (isEditMode) {
    await apiClient.put(`/api/cars/${carId}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    Alert.alert(t.success, 'Listing updated successfully!', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  } else {
    await apiClient.post(`/api/cars`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    // ...
  }
} catch (error: any) {
  console.error('Upload Error Details:', error);
  Alert.alert(t.error, isEditMode ? 'Failed to update listing.' : 'Failed to upload car listing.');
} finally {
  setLoading(false);
}
```

**KEEP from analog:**
- `route.params?.<flag>` destructure pattern (line 30 precedent)
- `useEffect(() => { if (gate) doWork(); }, [...deps])` pattern
- `useEffect` dependency arrays update when introducing new gating predicates (add `adminEdit` to dep arrays)
- `apiClient.put(/api/cars/:id, data, { headers: { 'Content-Type': 'multipart/form-data' } })` shape — Phase 10 keeps the seller-PUT path unchanged
- `Alert.alert(t.success, msg, [{ text: 'OK', onPress: () => navigation.goBack() }])` pattern
- `console.error('Upload Error Details:', error)` log + `Alert.alert(t.error, friendlyMsg)` UI pattern
- DEBT-03 deferral: no refactor; just inline conditional branches

**CHANGE / ADD:**
- New route-param destructure: `const adminEdit = route.params?.adminEdit ?? false;` (right after line 31)
- Gate at lines 75-79: prepend `if (adminEdit) return;` (RESEARCH line 1237 — adminEdit skips autofill; admin types fresh)
- Gate at lines 87-88: change predicate to `if (carId && (adminEdit || user?.sellerStatus === 'APPROVED'))` (RESEARCH line 1245)
- Inside car-fetch: gate ownership check on `!adminEdit` (line 94 currently rejects non-owners; admin path skips this check per RESEARCH line 1251)
- Wrap GatedScreenWrapper conditionally: `return adminEdit ? body : <GatedScreenWrapper capability="create_listing">{body}</GatedScreenWrapper>` (Pitfall 5 + RESEARCH lines 1266-1269)
- Submit branch: insert `if (adminEdit && carId) { await ModerationService.adminEditListing(carId, structuredInput); ... } else if (isEditMode) { /* existing seller-PUT */ } else { /* existing create-POST */ }` (RESEARCH lines 1274-1304)
- Catch: branch on `error instanceof ListingModerationError` for the adminEdit path (RESEARCH lines 1295-1302)
- Audit grep for ALL `sellerStatus === 'APPROVED'` occurrences in this file (Pitfall 4 — there are 4 known sites; all must be patched or admin lands on a blank form)
- Anti-pattern guard: DO NOT inline-rebuild the multipart shape inside this file's submit branch when calling `adminEditListing`. Build the structured input `{ fields, existingImageUrls, newFiles }` and let `ModerationService.adminEditListing` assemble FormData (CONTEXT anti-pattern; RESEARCH §Don't Hand-Roll)

---

### `src/screens/AdminModerationScreen.tsx` (MODIFIED — Users | Listings tabs)

**Analog:** Self. Existing user search at lines 67-200, AbortController at line 101, FlatList rendering, ChipButton component at lines 597-611.

**Existing query-state pattern to mirror** (`AdminModerationScreen.tsx:89-101`):

```typescript
const [query, setQuery] = useState('');
const [submittedQuery, setSubmittedQuery] = useState('');
const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
const [stateFilter, setStateFilter] = useState<StateFilter>('all');

// ---- list state ----
const [users, setUsers] = useState<SearchUserItem[]>([]);
const [nextCursor, setNextCursor] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
const [loadingMore, setLoadingMore] = useState(false);
const [refreshing, setRefreshing] = useState(false);
const [loadError, setLoadError] = useState(false);
const abortRef = useRef<AbortController | null>(null);
```

**Existing search + AbortController orchestration to mirror** (`AdminModerationScreen.tsx:128-165`):

```typescript
const runSearch = useCallback(
  async (resetList: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (resetList) setLoading(true);
    setLoadError(false);
    try {
      const result = await ModerationService.searchUsers(buildQuery(), {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setUsers(result.users);
      setNextCursor(result.nextCursor);
    } catch (err) {
      if (
        axios.isCancel?.(err) ||
        (err as { name?: string })?.name === 'CanceledError' ||
        (err as { name?: string })?.name === 'AbortError'
      ) {
        return;
      }
      setUsers([]);
      setNextCursor(null);
      setLoadError(true);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  },
  [buildQuery],
);
```

**Existing `fetchNextPage` infinite-scroll pattern to mirror** (`AdminModerationScreen.tsx:173-185`):

```typescript
const fetchNextPage = useCallback(async () => {
  if (loadingMore || !nextCursor) return;
  setLoadingMore(true);
  try {
    const result = await ModerationService.searchUsers(buildQuery(nextCursor));
    setUsers((curr) => [...curr, ...result.users]);
    setNextCursor(result.nextCursor);
  } catch {
    // Pagination errors surfaced silently; pull-to-refresh recovers.
  } finally {
    setLoadingMore(false);
  }
}, [loadingMore, nextCursor, buildQuery]);
```

**Existing ChipButton to reuse for filter + tab control** (`AdminModerationScreen.tsx:597-611`):

```typescript
const ChipButton: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    accessibilityLabel={label}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);
```

**Existing chip styles to extend** (`AdminModerationScreen.tsx:630-650`):

```typescript
chipRow: { flexDirection: 'row', gap: SIZES.spacingSm, paddingVertical: SIZES.spacingSm },
chip: {
  paddingHorizontal: SIZES.spacingMd,
  paddingVertical: SIZES.spacingSm,
  borderRadius: SIZES.radiusSm,
  borderWidth: 1,
  borderColor: COLORS.border,
  backgroundColor: COLORS.searchBackground,
  minHeight: SIZES.chipHeight,
  justifyContent: 'center',
},
chipActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
chipText: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
chipTextActive: { color: COLORS.accent, fontWeight: '600' },
```

**KEEP from analog:**
- `useState` + `useRef<AbortController>` + `useCallback` triad for search orchestration
- `buildQuery(cursor?)` factory + `runSearch(resetList)` + `fetchNextPage()` + `onRefresh()` shape
- `abortRef.current?.abort()` before issuing new request (race protection)
- AbortError/CanceledError guard pattern (lines 143-149) — copy verbatim into listings tab's runSearch
- `submittedQuery` vs `query` decoupling (lines 86-91 explanation comment) — submit-driven search, NOT debounced-per-keystroke (RESEARCH §State of the Art deprecation note for `useDebouncedValue`)
- FlatList + RefreshControl pagination shape
- `EmptyState` component reuse for empty / error states
- `ChipButton` component reuse for both filter chips AND the new Users|Listings tab control (Claude's Discretion choice per RESEARCH line 519)

**CHANGE / ADD:**
- New top-level type: `type ScopeTab = 'users' | 'listings';` + `const [scopeTab, setScopeTab] = useState<ScopeTab>('users');` (RESEARCH lines 502-503)
- New parallel state bucket for listings tab: `listings`, `listingNextCursor`, `listingQuery`, `listingSubmittedQuery`, `listingStatusFilter`, `listingsLoading`, `listingsAbortRef` (Pitfall 7 — separate AbortController per tab)
- New filter type: `type ListingStatusFilter = 'all' | 'active' | 'suspended' | 'archived' | 'deleted';` + `LISTING_STATUS_FILTER_OPTIONS` constant (mirror lines 57-63 ROLE_FILTER_OPTIONS shape)
- New tab control row above search/list: two `ChipButton`s for Users / Listings (RESEARCH lines 510-513)
- Conditional render `{scopeTab === 'users' ? <UsersTabBody /> : <ListingsTabBody />}` — keep both branches inside the same file (D-09: no new screen file)
- New `runListingsSearch` mirroring `runSearch` but calling `ModerationService.searchListings({ status, q, cursor, limit })` (Pitfall 7 — different abortRef)
- New `AdminListingRow` slim row renderer (or inline) per RESEARCH §Standard Stack — thumbnail + title + price + SeverityBadge + (if deleted) Recover button (D-10)
- Recover button on `status === 'deleted'` rows: opens `ListingRestoreModal` (Claude's Discretion recommendation per RESEARCH line 62) OR Alert.alert confirmation; either way calls `ModerationService.restoreListing(carId, body?)` (NEVER a separate "recover" route — CONTEXT anti-pattern)
- Row tap pushes `navigation.navigate('CarDetails', { carId: row._id })` (D-10)
- Anti-pattern: do NOT share `abortRef` between Users and Listings runSearches (Pitfall 7 — separate `useRef<AbortController>` per tab)

---

### `src/types/navigation.ts` (MODIFIED)

**Analog:** Self. Existing line 4: `SellCar: { carId?: string } | undefined;`.

**Existing route type to extend** (`navigation.ts:4`):

```typescript
SellCar: { carId?: string } | undefined;
```

**KEEP:**
- `RouteName: { ...params } | undefined` shape when all params optional
- Optional-param convention with `?`

**CHANGE:**
- Widen to `SellCar: { carId?: string; adminEdit?: boolean } | undefined;` (CONTEXT D-01 + RESEARCH line 1308)

---

### `src/constants/translations.ts` (MODIFIED)

**Analog:** Self. Existing translation keys (project-wide pattern). RU+EN parity audit deferred to Phase 11 LQUAL-01; Phase 10 adds keys with EN placeholders.

**KEEP:**
- Key naming convention: camelCase (e.g., `actionSuspend`, `reasonSpam`)
- Both `RU` and `EN` blocks must receive every new key (Phase 11 will audit RU parity; Phase 10 may use EN placeholders for both)

**CHANGE / ADD (suggested keys; planner finalizes):**
- Listing reason taxonomy: `listingReasonSpam`, `listingReasonPolicyViolation`, `listingReasonFraud`, `listingReasonInactiveSeller`, `listingReasonOther`
- Listing actions: `listingActionEdit`, `listingActionSuspend`, `listingActionArchive`, `listingActionDelete`, `listingActionRestore`
- Status filters: `listingStatusFilterAll`, `listingStatusFilterActive`, `listingStatusFilterSuspended`, `listingStatusFilterArchived`, `listingStatusFilterDeleted`
- Error banners: `listingErrorCannotModerateOwn`, `listingErrorAlreadyInState`, `listingErrorNotFound`, `listingErrorNotAvailable`
- Modal copy: `listingModerateBadge`, `listingModerationHeader`, `listingRestoreHeader`, `tabUsers`, `tabListings`
- Anti-pattern: do NOT translate at the `code` level in `ListingModerationError` — map error code → translation key inside `CarDetailsScreen` (mirrors existing `MODERATION_ERROR_KEY_MAP` pattern at `AdminModerationScreen.tsx:28`)

---

### Backend — `../backend-services/carEx-services/src/moderation/listingRouter.js` (MODIFIED — add GET / route)

**Analog (primary):** `../backend-services/carEx-services/src/admin/router.js:93-206` — `GET /users/search` is the exact-shape precedent.

**Analog (in-file):** existing Phase 8 PATCH routes in the same file (lines 143-185 for `/suspend`, `/archive`) for middleware composition + Zod parse + error-handler-helper conventions.

**Existing in-file PATCH-route shape to mirror** (`listingRouter.js:143-160`):

```javascript
router.patch('/:carId/suspend', denySelfModerationListing, async (req, res) => {
  const parsed = schemas.suspendListingSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const result = await service.suspendListing({
      adminUid: req.admin.uid,
      adminEmail: req.admin.email,
      carId: req.params.carId,
      reasonCategory: parsed.data.reasonCategory,
      note: parsed.data.note,
    });
    return res.json({ ok: true, listing: result.listing, action: result.action });
  } catch (err) {
    return handleListingServiceError(err, res, 'suspend');
  }
});
```

**Existing `searchUsers` cursor + query construction to port** (`admin/router.js:93-206`):

```javascript
router.get('/users/search', verifyIdToken, requireAdmin, async (req, res) => {
  try {
    const { q: qRaw, role, state, cursor: cursorRaw } = req.query;
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25;

    // ---- validation ----
    if (qRaw !== undefined && typeof qRaw !== 'string') {
      return res.status(400).json({ error: 'invalid_q' });
    }
    // ... (q_too_long / invalid_role / invalid_state / invalid_cursor) ...

    const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
    if (cursorRaw && cursor === undefined) {
      return res.status(400).json({ error: 'invalid_cursor' });
    }

    // ---- query construction ----
    const filter = {};
    const andClauses = [];
    if (qRaw && qRaw.trim().length > 0) {
      const escaped = escapeRegex(qRaw.trim());
      filter.$or = [
        { email: { $regex: escaped, $options: 'i' } },
        { firebaseUid: { $regex: '^' + escaped } },
      ];
    }
    // ... state filter ...
    if (cursor) {
      andClauses.push({
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
        ],
      });
    }
    if (andClauses.length > 0) filter.$and = andClauses;

    const rows = await User
      .find(filter, PROJECTION)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;
    return res.status(200).json({ users, nextCursor });
  } catch (err) {
    console.error('[GET /api/admin/users/search] error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});
```

**KEEP from analogs:**
- `router.get('/', ...)` mount (no path beyond `/`) — the parent mount at `server.js:925` already provides `/api/admin/moderation/listings`
- `safeParse(req.query || {})` for Zod validation; on failure: `return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });`
- `try / catch` around service call; on failure: `console.error('[GET /api/admin/moderation/listings] error', err); return res.status(500).json({ error: 'internal_error' });`
- Service module returns `{ rows, nextCursor }` shape; route just forwards it
- Cursor pattern: `Buffer.from(JSON.stringify({...})).toString('base64')` encode + base64 → JSON.parse decode + `{ createdAt: { $lt: cursor.createdAt }, ... }` `$or` for the next-page predicate (`admin/router.js:170-177`)
- `escapeRegex(str)` helper for safe regex construction (`admin/router.js:122-128`)
- `.limit(limit + 1).lean()` + `hasMore = rows.length > limit` + `items = hasMore ? rows.slice(0, limit) : rows` paginate pattern
- Hard cap on `limit` parameter (admin/router uses `Math.min(Math.max(rawLimit, 1), 100)` with default 25)

**CHANGE for new route:**
- NO inline `verifyIdToken, requireAdmin` middlewares on the route — they're already on the `app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingRouter)` mount at `server.js:925`
- DO use `denySelfModerationListing`? — NO. Self-mod check is irrelevant for a list/read endpoint. Phase 10 omits it (only PATCH routes use it).
- Substitute `Car` model for `User`; substitute `searchListings` for the inline query
- CRITICAL: pass `.setOptions({ includeAllListingStatuses: true })` so the Phase 9 hide-hook does NOT filter out non-active rows (CONTEXT anti-pattern + Pitfall 8 reference)
- Restrict `q` search to title-component fields + listingId prefix only (Pitfall 10 — NO description / phoneNumber / telegramUsername in `$or`)
- Uniform sort `createdAt DESC, _id DESC` across all status filters (Pitfall 8 — defer `moderatedAt` sort to v1.2)
- Move query/cursor/service logic into `listingService.js`'s new `searchListings({ status, q, cursor, limit })` function (Phase 8's pattern of router-as-thin-wrapper + service-as-business-logic; admin/router.js does it inline because there's no separate admin/service.js)

---

### Backend — `../backend-services/carEx-services/src/moderation/listingService.js` (MODIFIED — add searchListings)

**Analog (in-file):** existing Phase 8 service functions like `suspendListing`, `restoreListing` for module shape + error-throwing conventions.

**Analog (cross-file):** `admin/router.js:93-206` for cursor/encode/decode/escapeRegex/filter-construction patterns (Phase 10 ports these helpers into listingService.js).

**KEEP from `listingService.js` (existing patterns to mirror):**
- `async function <name>({ destructured params }) { ... }` named exports via `module.exports.<name> = <name>` at file bottom
- File-top `require()` block for `mongoose`, `Car`, project modules
- `console.error('[<tag>] error', err)` on caught errors (matching `admin/router.js:203` pattern)
- Use `.lean()` for read-only queries (cursor results don't need Mongoose docs)
- Phase 9 D-01 invariant: `.setOptions({ includeAllListingStatuses: true })` on EVERY `Car.find` that needs to see non-active rows

**CHANGE / ADD:**
- New helper functions at module top (or top of new function): `encodeCursor(item)`, `decodeCursor(cursor)`, `escapeRegex(str)` — port from `admin/router.js:36-57`
- New `searchListings({ status, q, cursor, limit = 25 })` function returning `{ rows, nextCursor }` (RESEARCH lines 1147-1209)
- Result shape transformation (lines 1190-1203 in RESEARCH): map Car docs to `ListingSearchItem` shape (`_id`, `status`, `makeName`, `modelName`, `year`, `price`, `firstPhotoUrl`, `sellerId`, `createdAt`, `moderatedAt`, `moderationReason`, `listingId`)
- `firstPhotoUrl = Array.isArray(c.imageUrls) && c.imageUrls.length > 0 ? c.imageUrls[0] : null`
- Export via `module.exports.searchListings = searchListings;` (RESEARCH line 1211)

---

### Backend — `../backend-services/carEx-services/src/moderation/listingSchemas.js` (MODIFIED — add searchListingsQuerySchema)

**Analog:** Same file. `restoreListingSchema` at lines 55-57 is the closest in-file analog (also `.strict()`, also simple shape).

**Existing schema pattern to mirror** (`listingSchemas.js:55-57`):

```javascript
const restoreListingSchema = z.object({
  note: noteField,
}).strict();
```

**KEEP from analog:**
- `const <name> = z.object({ ... }).strict();` pattern — `.strict()` mandatory (CONTEXT D-09 + this file's lines 4-6 doc)
- Module-level `noteField` definition reused across schemas (line 31)
- Comment block above each schema explaining what it accepts + WHY (file-level convention from `listingSchemas.js` lines 33-71)
- Export via `module.exports = { ..., searchListingsQuerySchema };` at file bottom (mirror lines 111-119)

**CHANGE / ADD:**
- New schema `searchListingsQuerySchema` for the GET endpoint query string:

```javascript
const searchListingsQuerySchema = z.object({
  status: z.enum(['active', 'suspended', 'archived', 'deleted']).optional(),
  q: z.string().max(128).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
}).strict();
```

- Note: `z.coerce.number()` for `limit` because query-string values are strings; mirror `editListingSchema` line 95-99 coerce pattern (existing file convention for multipart-string-to-number coercion)

---

## Shared Patterns

### Pattern S1: Module-Object Service + Try/Catch/Console.error/Throw

**Source:** `src/services/moderation/ModerationService.ts:168-319` (existing 7 methods)

**Apply to:** All 5 new `ModerationService` methods (`adminEditListing`, `suspendListing`, `archiveListing`, `deleteListing`, `restoreListing`) AND the new `searchListings` read method.

**Canonical excerpt** (line 186-197):

```typescript
unsuspend: async (targetUid: string, body: UnsuspendBody = {}) => {
  try {
    const response = await apiClient.patch(
      `/api/admin/moderation/${targetUid}/unsuspend`,
      body,
    );
    return response.data;
  } catch (error) {
    console.error('Failed to unsuspend user', error);
    throw error;
  }
},
```

**Phase 10 deviation:** Replace `throw error` with `throw toListingModerationError(error)` for the 5 write methods. `searchListings` keeps the bare `throw error` (RESEARCH 916-921 — let raw error surface to EmptyState).

---

### Pattern S2: Modal + Pressable Overlay + Safe-Area Inset

**Source:** `QuickActionSheet.tsx:61-145` (bottom sheets) + `ModerationActionModal.tsx:136-156` (form modals) + `TypedConfirmationModal.tsx:55-115` (confirmation cards)

**Apply to:** All 3 new modal components (`ListingModerationBottomSheet`, `ListingModerationReasonModal`, `ListingRestoreModal`).

**Canonical excerpt** (QuickActionSheet.tsx:61-66):

```typescript
<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <Pressable style={styles.overlay} onPress={onClose}>
    <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + SIZES.spacingSm }]} onPress={() => {}}>
      <View style={styles.handle} />
      ...
```

Form-modal variant adds `KeyboardAvoidingView` wrapper (`ModerationActionModal.tsx:138-141`):

```typescript
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
```

---

### Pattern S3: Optimistic Update with Snapshot/Flip/Rollback

**Source:** `AdminModerationScreen.tsx:239-282` (user-domain handlers — same screen file)

**Apply to:** `CarDetailsScreen.handleListingActionSubmit` (the new admin action handler)

**Excerpt from RESEARCH lines 442-489** (adapted for Phase 10):

```typescript
const handleListingActionSubmit = async (action, body) => {
  const prevBadge = fetchedCar.moderationBadge ?? null;
  const prevStatus = fetchedCar.status ?? 'active';
  const nextStatus = action === 'restore' ? 'active' : action === 'delete' ? 'deleted' :
                     action === 'suspend' ? 'suspended' : 'archived';
  setFetchedCar((c) => ({
    ...c,
    status: nextStatus,
    moderationBadge: nextStatus === 'active' ? undefined : {
      status: nextStatus,
      reasonCategory: body.reasonCategory,
      moderatedAt: new Date().toISOString(),
    },
  }));
  setBottomSheetVisible(false);
  try {
    const result = await ModerationService[`${action}Listing`](carId, body);
    setFetchedCar((c) => ({ ...c, ...result.listing }));
  } catch (err) {
    setFetchedCar((c) => ({ ...c, status: prevStatus, moderationBadge: prevBadge ?? undefined }));
    if (err instanceof ListingModerationError) {
      // D-15 branching: inline banner vs Alert.alert
    }
  }
};
```

**Critical:** snapshot BOTH `status` AND `moderationBadge` (Pitfall 2 — single-field snapshot leaves a 200ms gap where the banner doesn't render).

---

### Pattern S4: AbortController + SubmitDriven Search (NOT Per-Keystroke Debounce)

**Source:** `AdminModerationScreen.tsx:86-200` (the entire existing user-search orchestration — comment at lines 86-91 documents the WHY)

**Apply to:** The new Listings tab inside `AdminModerationScreen`.

**Critical decoupling pattern** (line 89-91 + 196-200):

```typescript
const [query, setQuery] = useState('');               // draft (mutates per keystroke; never fires fetch)
const [submittedQuery, setSubmittedQuery] = useState(''); // last-submitted (drives fetch)

const handleSubmitSearch = useCallback(() => {
  setSubmittedQuery(query.trim());
}, [query]);
```

**Tab isolation:** Phase 10 adds a SEPARATE `listingsAbortRef = useRef<AbortController>(null)` (Pitfall 7). DO NOT reuse the existing `abortRef` — tab-switch + search overlap will abort the wrong tab's request.

---

### Pattern S5: `t as unknown as Record<string, string>` Translation Cast

**Source:** Project-wide. Examples: `QuickActionSheet.tsx:40`, `AdminModerationScreen.tsx:72`, `ModerationActionModal.tsx:72`, `TypedConfirmationModal.tsx:33`, `SeverityBadge.tsx:36`.

**Apply to:** Every new Phase 10 component that reads translation keys with dynamic computed keys (e.g., `T[mapErrorCodeToKey(code)]`).

**Canonical excerpt:**

```typescript
const { t } = useLanguage();
const T = t as unknown as Record<string, string>;
// then: T.listingActionSuspend, T[someComputedKey], etc.
```

---

### Pattern S6: Backend Cursor Pagination

**Source:** `../backend-services/carEx-services/src/admin/router.js:36-57` (encode/decode/escapeRegex) + `:170-200` (cursor predicate + limit+1 hasMore).

**Apply to:** `listingService.searchListings()` — the new function.

**Excerpt** (encode/decode + filter assembly):

```javascript
function encodeCursor(item) {
  if (!item) return null;
  return Buffer.from(
    JSON.stringify({ createdAt: item.createdAt.toISOString(), _id: item._id.toString() }),
    'utf8',
  ).toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    return { createdAt: new Date(parsed.createdAt), _id: parsed._id };
  } catch (_err) { return undefined; }
}

// Inside searchListings:
if (cursor) {
  andClauses.push({
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
    ],
  });
}
const rows = await Car.find(filter)
  .setOptions({ includeAllListingStatuses: true })   // Phase 10 Phase-9 D-01 bypass
  .sort({ createdAt: -1, _id: -1 })
  .limit(limit + 1)
  .lean();
const hasMore = rows.length > limit;
```

---

### Pattern S7: Sibling-Component + Sibling-Error-Class Discipline

**Source:** Phase 4 D-06/D-07 lineage. Both `ModerationError` and `ModerationService` are SIBLINGS of their AuthService counterparts (not extensions/forks).

**Apply to:** Phase 10's `ListingModerationError`, `ListingModerationBottomSheet`, `ListingModerationReasonModal`, `ListingRestoreModal` — all siblings of the user-domain Phase 4/5 equivalents.

**Rationale (from CONTEXT D-04 + RESEARCH §Don't Hand-Roll):** Embedding both user-domain (4-value `ReasonCategory`) and listing-domain (5-value `LISTING_REASON_OPTIONS`) enums in a single component bloats grep surface for Phase 11 LQUAL-03 security review and risks cross-domain bug introduction. Sibling shape keeps each component narrow and grep-able.

**Grep invariants to verify after Phase 10 lands:**

```bash
# Anti-pattern guards (all MUST return 0 after Phase 10):
grep -c 'suspendListing\|archiveListing\|deleteListing\|restoreListing\|adminEditListing' src/services/AuthService.ts
grep -c 'inactive_seller\|listing_not_available' src/services/moderation/errors.ts | head -1  # listing codes must NOT be in ModerationError union
grep -c "interceptors\.response\.use" src/services/http/client.ts  # MUST equal 2 (Pitfall 1: no new interceptor)
```

---

### Pattern S8: Test Stub Co-location

**Source:** Project-wide. Test files live in `__tests__/` subdirectories sibling to the code under test (e.g., `src/components/moderation/__tests__/`, `src/services/moderation/__tests__/`).

**Apply to:** All 10 Wave-0 test stubs. Naming convention: `<SourceFileName>.test.{ts|tsx}` (or `<Scenario>.test.{ts|tsx}` for screen integration tests with branching scope).

**Examples found:**
- Components: tests under `src/components/moderation/__tests__/`
- Services: tests under `src/services/moderation/__tests__/`
- Screens: tests under `src/screens/__tests__/` (if exists) — planner confirms during scaffolding

---

## No Analog Found

**None.** Every Phase 10 target has at least a role-match analog in the codebase. The only "thinner" coverage is for `ListingRestoreModal` (closest analog is `ModerationActionModal.tsx:184-189` which is a single branch inside a multi-action modal) — but the shape is well-defined enough to extract.

The original RESEARCH §Summary confirms: "Every reusable substrate is in place... Phase 10 is overwhelmingly a wiring + sibling-component-creation phase, NOT a build-from-scratch phase."

---

## Metadata

**Analog search scope:**
- Mobile: `src/services/moderation/`, `src/services/http/`, `src/components/moderation/`, `src/screens/`, `src/types/`, `src/utils/`, `src/constants/`
- Backend: `../backend-services/carEx-services/src/moderation/`, `../backend-services/carEx-services/src/admin/`

**Files read for excerpts (10):**
- `src/services/moderation/ModerationService.ts` (320 lines, full)
- `src/services/moderation/errors.ts` (12 lines, full)
- `src/services/http/client.ts` (183 lines, full)
- `src/components/moderation/QuickActionSheet.tsx` (211 lines, full)
- `src/components/moderation/ModerationActionModal.tsx` (lines 1-220, partial — header + form patterns extracted)
- `src/components/moderation/TypedConfirmationModal.tsx` (181 lines, full)
- `src/components/moderation/SeverityBadge.tsx` (65 lines, full)
- `src/utils/passwordPolicy.ts` (22 lines, full)
- `src/components/CarCard.tsx` (126 lines, full)
- `src/types/navigation.ts` (27 lines, full)
- `src/screens/CarDetailsScreen.tsx` (lines 1-130, targeted)
- `src/screens/SellCarScreen.tsx` (lines 1-150 + 420-510, targeted)
- `src/screens/AdminModerationScreen.tsx` (lines 1-200 + 580-709, targeted)
- `../backend-services/carEx-services/src/moderation/listingRouter.js` (lines 1-230, targeted)
- `../backend-services/carEx-services/src/moderation/listingSchemas.js` (full)
- `../backend-services/carEx-services/src/moderation/listingService.js` (lines 1-80, header)
- `../backend-services/carEx-services/src/admin/router.js` (lines 90-208, targeted)

**Pattern extraction date:** 2026-05-29
