---
phase: 10-mobile-plumbing-admin-listing-ui
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - src/components/moderation/ListingModerationBottomSheet.tsx
  - src/components/moderation/ListingModerationReasonModal.tsx
  - src/components/moderation/ListingRestoreModal.tsx
  - src/components/moderation/TypedConfirmationModal.tsx
  - src/components/moderation/__tests__/ListingModerationBottomSheet.test.tsx
  - src/components/moderation/__tests__/ListingModerationReasonModal.test.tsx
  - src/components/moderation/__tests__/ListingRestoreModal.test.tsx
  - src/components/moderation/__tests__/TypedConfirmationModal.test.tsx
  - src/screens/AdminModerationScreen.tsx
  - src/screens/CarDetailsScreen.tsx
  - src/screens/SellCarScreen.tsx
  - src/screens/__tests__/AdminModerationScreen.tabs.test.tsx
  - src/screens/__tests__/CarDetailsScreen.admin.test.tsx
  - src/screens/__tests__/SellCarScreen.adminEdit.test.tsx
  - src/services/http/__tests__/clientListing409.test.ts
  - src/services/moderation/ModerationService.ts
  - src/services/moderation/__tests__/listingMethods.test.ts
  - src/services/moderation/errors.ts
  - src/services/moderation/__tests__/listingErrors.test.ts
  - src/utils/listingTitle.ts
  - src/utils/__tests__/listingTitle.test.ts
  - src/types/navigation.ts
  - __tests__/moderation.e2e.integration.test.tsx
findings:
  critical: 5
  warning: 8
  info: 5
  total: 18
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 10 wires up admin listing moderation across mobile UI (bottom sheet,
two modals, screen integrations) and a sibling service module. The architecture
(sibling components/types/errors per D-04, optimistic flip + rollback per D-16,
service-layer error wrapping per T-10-02) is sound and well-tested at the
unit level.

However the integration has shipped with several **BLOCKER**-class problems that
will surface immediately in production for admin and end-user-facing flows:

1. **`TypedConfirmationModal` is reused for listing delete with the wrong copy**
   — the modal renders user-profile delete wording, an email placeholder, and a
   hint string templated for an email, but the parent passes the listing title.
   Admins reading "The provider profile will be permanently deleted" while
   trying to delete a *car listing* is misleading and dangerous.
2. **No i18n keys exist for any of the new UI strings.** All `T.listingActionEdit`,
   `T.tabUsers`, `T.listingStatusFilterAll`, `T.listingReasonSpam`, etc. resolve
   to `undefined` and fall back to English literals — violating the explicit
   constraint in CLAUDE.md ("All moderator and affected-user strings are RU-first
   and must have EN parity").
3. **Two parallel status namespaces conflict in `CarDetailsScreen`** —
   moderation status (`fetchedCar.status` ∈ `active|suspended|archived|deleted`)
   and the pre-existing buyer status (`listingStatus` ∈ `active|booked|sold`)
   are read independently. Buyers can still click "Telegram", "WhatsApp", and
   "Book it" on a *moderation-suspended* listing because the buyer-CTA gating
   only reads `listingStatus`.
4. **Admin status banner / bottom-sheet moderationBadge tied to `fetchedCar`
   only** — when the screen is opened via `route.params.carData` (the
   existing happy path from listing rows that pre-populate the car), the
   moderation badge / banner never appears, defeating the moderation surface.
5. **Raw error codes shown to users in Alert and inline banners** — codes like
   `"already_in_state"`, `"listing_not_found"`, `"invalid_make"` are surfaced
   verbatim through `Alert.alert` and the inline error banner (with comments
   admitting "translation mapping can come later"). These are user-facing
   strings.

Lower-severity issues include: optimistic recovery flip leaves stale
moderation metadata, archive-button uses a text color as background,
`new Date().toISOString()` for "Since" pill is UTC-only (timezone surprises),
`useAuth() as any` defeats type safety, and `apiClient.get` deep-link failure
is silent (pre-existing pattern).

---

## Critical Issues

### CR-01: Listing Delete reuses TypedConfirmationModal with user-profile copy (misleading admin UX)

**File:** `src/screens/CarDetailsScreen.tsx:1162-1179`
**Issue:**
When admin selects Delete on a listing, the parent opens `TypedConfirmationModal`
with `action="delete_profile"` and `targetEmail={listingTitle}`. The modal
renders:

- Warning body (line 78 in `TypedConfirmationModal.tsx`):
  `T[BODY_KEY_FOR_ACTION['delete_profile']]` → `typedConfirmWarningBodyDelete`
  → RU: *"Профиль провайдера будет удалён навсегда. История заказов
  сохранится."* / EN: *"The provider profile will be permanently deleted.
  Order history is preserved."*
- Hint (line 58): `typedConfirmHint.replace('{email}', targetEmail)` →
  *"Type the user's email 2018 Toyota Camry to confirm"*.
- Placeholder (line 86): `typedConfirmInputPlaceholder` → *"email@example.com"*.

The admin sees user-profile-delete wording, an email-shaped hint, and an
email placeholder while typing a car title. Beyond confusing UX this is
operationally dangerous: an admin scanning the modal copy may believe they
are deleting the seller's *account*, not the listing.

**Fix:**
Either (a) add a new `'delete_listing'` action variant to
`TypedConfirmationModal` with listing-specific copy, or (b) generalize the
modal to take a `bodyKey`, `hintKey`, and `placeholderKey` (or pre-rendered
strings) as props. Recommend (b) since it scales to other listing-vs-user
typed-confirm contexts:

```tsx
// TypedConfirmationModal.tsx
export interface TypedConfirmationModalProps {
  // ...existing props
  /** Override default body key (action-mapped). Plan 10 listing delete passes 'typedConfirmListingDeleteBody'. */
  bodyKey?: string;
  /** Override hint key — pass 'typedConfirmListingHint' for listing-title flows. */
  hintKey?: string;
  /** Override placeholder. Listing flows pass 'typedConfirmListingPlaceholder' (e.g. "2018 Toyota Camry"). */
  placeholderKey?: string;
}

// Then in component:
const bodyText = T[bodyKey ?? BODY_KEY_FOR_ACTION[action]];
const hint = (T[hintKey ?? 'typedConfirmHint'] ?? '').replace('{email}', targetEmail);
const placeholder = T[placeholderKey ?? 'typedConfirmInputPlaceholder'];
```

Add the three RU/EN strings to `translations.ts` (e.g.
`typedConfirmListingDeleteBody`, `typedConfirmListingHint`,
`typedConfirmListingPlaceholder`).

---

### CR-02: No i18n keys exist for any Phase 10 UI strings — RU users see English literals everywhere

**File:** `src/constants/translations.ts` (NOT updated in this phase) — affects:
- `src/components/moderation/ListingModerationBottomSheet.tsx:131-186`
- `src/components/moderation/ListingModerationReasonModal.tsx:114, 129-156`
- `src/components/moderation/ListingRestoreModal.tsx:79-127`
- `src/screens/AdminModerationScreen.tsx:706-756, 800-808`
- `src/screens/CarDetailsScreen.tsx:686-694`

**Issue:**
`grep -n "listingAction\|listingReason\|listingRestoreHeader\|listingModerated\|tabUsers\|tabListings\|listingStatusFilter\|listingsEmpty\|listingsSearchPlaceholder" src/constants/translations.ts` returns **zero matches**.

Every new UI string is accessed via `T[key]` then fallback-defaulted to an English literal:

```tsx
{T.listingActionEdit ?? 'Edit'}             // ListingModerationBottomSheet:131
{T.listingActionSuspend ?? 'Suspend'}       // …:137
{T.tabUsers ?? 'Users'}                     // AdminModerationScreen:800
{T.listingStatusFilterAll ?? '...'}         // AdminModerationScreen:770
{T.listingRestoreHeader ?? 'Restore listing'} // ListingRestoreModal:80
{T.fieldNote ?? 'Note (optional)'}          // ListingRestoreModal:95
```

CLAUDE.md explicitly states: *"All moderator and affected-user strings are
RU-first and must have EN parity."* The default app language is RU, so the
end result is **a Russian-language app rendering English UI for the entire
listing moderation surface**.

**Fix:**
Add RU + EN parity entries to both language blocks in
`src/constants/translations.ts` for at minimum:

```
listingActionEdit, listingActionSuspend, listingActionArchive,
listingActionDelete, listingActionRestore,
listingReasonSpam, listingReasonPolicyViolation, listingReasonFraud,
listingReasonInactiveSeller, listingReasonOther,
listingModeratedSincePrefix, listingRestoreHeader,
fieldReason, fieldNote, fieldNotePlaceholder,
tabUsers, tabListings,
listingStatusFilterAll, listingStatusFilterActive,
listingStatusFilterSuspended, listingStatusFilterArchived,
listingStatusFilterDeleted,
listingsEmpty, listingsEmptyBody, listingsSearchPlaceholder,
modalConfirm  (verify exists — used by both reason + restore modals).
```

Removing the English-literal fallbacks in source after adding keys is also
recommended so future missing-key regressions surface as visibly broken
strings instead of silent EN reverts.

---

### CR-03: Buyer-CTA gating in CarDetailsScreen ignores moderation status

**File:** `src/screens/CarDetailsScreen.tsx:78-83, 783-820`
**Issue:**
The screen maintains two independent status reads:

- `listingStatus = (localListingStatus ?? car?.listingStatus ?? 'active')` —
  drives buyer CTAs (lines 704-820): `Book it`, contact buttons, sold/booked
  badges.
- `fetchedCar.status` ∈ `'active'|'suspended'|'archived'|'deleted'` — populated
  by the Phase 10 admin moderation flow and the `moderationBadge` payload
  from the status-aware backend GET (Phase 9 D-08).

These two namespaces never interact. After admin suspends/archives a listing,
`handleListingActionSubmit` flips `fetchedCar.status` to `'suspended'` but
leaves `listingStatus` untouched. Result:

- Buyer can still tap Telegram / WhatsApp CTAs on a suspended/archived
  listing (lines 887-909).
- Buyer can still hit "Book it" (lines 805-819) and reach the payment sheet,
  on a deleted listing.

Server-side enforcement on the backend (Phase 8) ultimately rejects, but the
**user-facing affordance is wrong** — the user pays through Stripe and then
gets a confused failure rather than seeing a disabled CTA up front.

Backend Phase 9 D-08 specifically returns moderationBadge so the mobile
client can hide buyer affordances; this milestone wires the admin side but
not the buyer side. Even if Phase 11 covers LBUY-01 buyer banner, the
*minimum* expected here is that `listingStatus` derives from a unified
status read (or that the buyer CTAs additionally disable when
`fetchedCar.status` is anything other than active).

**Fix:**
Add a derived `isModerated` flag and gate the buyer affordances:

```tsx
const moderationStatus = (fetchedCar?.status ?? 'active') as
  'active' | 'suspended' | 'archived' | 'deleted';
const isModerated = moderationStatus !== 'active';

// In JSX — disable + dim CTAs:
disabled={bookingLoading || listingStatus === 'booked' || isModerated}
// Same for Telegram / WhatsApp / Book it / Get services buttons.
```

Alternatively: collapse `listingStatus` and moderation `status` into a
single source-of-truth function that returns the *narrowest* permissible
state for the viewer.

---

### CR-04: Admin moderationBadge invisible when the screen receives carData via route params

**File:** `src/screens/CarDetailsScreen.tsx:78, 658, 1139`
**Issue:**
Three moderation-surface checks all guard on `fetchedCar`:

```tsx
{isAdmin && fetchedCar?.moderationBadge && ( ... admin-status-banner ... )}  // line 658
<ListingModerationBottomSheet
  moderationBadge={fetchedCar?.moderationBadge}                              // line 1139
  ...
/>
const listingTitle = fetchedCar ? buildListingTitle(fetchedCar) : ...;        // line 458
```

`fetchedCar` is only populated when the screen reaches the deep-link
fetch branch (line 125: `if (carId && !existingCar)`). When `carData` is
supplied via `route.params` (the path used everywhere except direct deep
linking — e.g. tapping a row in HomeScreen, MyListings, SellerListings, or
SearchResults), `fetchedCar` stays `null`. The car prop falls back to
`(route.params as any).carData`, and the moderation badge — if any was
present in that payload — never renders.

In practice this means: an admin navigating from any list surface will see
the moderate-badge icon (it's gated only on `isAdmin`) but tapping it opens
the bottom sheet with `moderationBadge={undefined}` — i.e. the **4-action
"active" sheet** is shown even for a suspended/archived listing.

Additionally, the optimistic-flip on success writes into `setFetchedCar(c => c ? {...} : c)` — when `fetchedCar` is null this is a no-op, so the
post-action visual update is also dropped.

**Fix:**
Derive moderation state from either source:

```tsx
const sourceCar = fetchedCar ?? car;
const moderationBadge = sourceCar?.moderationBadge;
const moderationStatus = sourceCar?.status ?? 'active';
```

Then drive the banner, sheet, and optimistic-flip rollback from
`moderationBadge` rather than `fetchedCar?.moderationBadge`. If the
optimistic flip needs writable state, hoist a single `moderationOverride`
useState alongside `localListingStatus` so both deep-linked AND carData-prefilled
flows update on success.

---

### CR-05: Raw backend error codes shown to admin via Alert.alert and inline banner

**File:**
- `src/screens/CarDetailsScreen.tsx:519-533, 691-703`
- `src/screens/AdminModerationScreen.tsx:519`
- `src/screens/SellCarScreen.tsx:517-525`

**Issue:**
Three call sites display backend error code strings *as the localized error
message* to admin users:

```tsx
// CarDetailsScreen.tsx — inside handleListingActionSubmit catch:
} else if (err.code === 'listing_not_found') {
  Alert.alert(t.error || 'Error', 'Listing not found');     // hardcoded EN literal
} else {
  Alert.alert(t.error || 'Error', err.code);                // raw code like "invalid_field"
}
// And the inline error banner renders `errorBanner` (which is set to err.code) verbatim:
<Text style={styles.adminErrorBannerText}>{errorBanner}</Text>  // line 694

// AdminModerationScreen.tsx — Recover failure:
const code = (err as { code?: string } | null)?.code;
Alert.alert(T.error ?? 'Error', code ?? T.errGeneric ?? 'Restore failed');

// SellCarScreen.tsx — explicitly comments the issue:
// "Surface the code verbatim — translation mapping can come later"
Alert.alert(t.error, error.code);
```

User sees, for example, an Alert titled "Error" with body
`"cannot_moderate_own_listing"` or `"already_in_state"` or `"invalid_make"`.
These are machine identifiers leaked through user-facing surfaces.

This is the same class of issue addressed in user-mod via
`MODERATION_ERROR_KEY_MAP` (imported by AdminModerationScreen) — but the
new listing-mod paths bypass that mechanism entirely. Phase 4 D-13
established the error-key-map pattern; Phase 10 ignored it.

**Fix:**
Create `LISTING_MODERATION_ERROR_KEY_MAP` mapping each `ListingModerationError`
code → a translation key, then add RU + EN entries to `translations.ts`:

```ts
// src/utils/listingModerationErrorKeyMap.ts
export const LISTING_MODERATION_ERROR_KEY_MAP = {
  listing_not_found: 'errListingNotFound',
  cannot_moderate_own_listing: 'errCannotModerateOwn',
  already_in_state: 'errAlreadyInState',
  not_moderated: 'errNotModerated',
  invalid_payload: 'errInvalidPayload',
  invalid_make: 'errInvalidMake',
  invalid_model: 'errInvalidModel',
  no_changes: 'errNoChanges',
  invalid_field: 'errInvalidField',
  listing_not_available: 'errListingNotAvailable',
} as const;

// Then at each call site:
const key = LISTING_MODERATION_ERROR_KEY_MAP[err.code as keyof typeof LISTING_MODERATION_ERROR_KEY_MAP];
Alert.alert(t.error, T[key ?? 'errGeneric']);
```

---

## Warnings

### WR-01: Optimistic Recover flip retains stale moderation metadata

**File:** `src/screens/AdminModerationScreen.tsx:510-512`
**Issue:**
```tsx
setListings((curr) =>
  curr.map((l) => (l._id === row._id ? { ...l, status: 'active' } : l)),
);
```

Spreading `...l` first then overriding `status` preserves `moderatedAt` and
`moderationReason` on the row. Visually, the row shows `Active` badge but
still carries "since 2026-05-20" / "duplicate" metadata in the data
structure. If any downstream component reads those fields the UI displays
inconsistent state. Also if the row remains in a 'deleted'-filtered view,
it stays visible until the next search refresh.

**Fix:**
```tsx
setListings((curr) =>
  curr.map((l) =>
    l._id === row._id
      ? { ...l, status: 'active', moderatedAt: null, moderationReason: null }
      : l,
  ),
);
```

Optionally also filter the row out if `listingsStatusFilter === 'deleted'`
since it no longer matches the filter (pull-to-refresh recovers, but the
immediate UX would be smoother).

---

### WR-02: Archive button uses text color as background → low contrast white-on-grey

**File:** `src/components/moderation/ListingModerationReasonModal.tsx:65-68`
**Issue:**
```tsx
const confirmBgForAction = (action: ListingReasonAction): string =>
  action === 'delete' ? COLORS.destructive :
  action === 'suspend' ? COLORS.warning :
  COLORS.textSecondary;   // ← archive falls here
```

`COLORS.textSecondary` is a *text* color (a neutral grey) being used as a
*button background*. The confirm text inside the button is white
(`#FFFFFF`, line 307). White-on-grey is low contrast and visually weak
compared to the strongly-colored Suspend (warning orange) and Delete
(destructive red) variants. The button reads visually inactive even when
it's the primary CTA.

**Fix:**
Use a proper button background token — e.g. `COLORS.accent` (consistent
with primary CTAs across the app), `COLORS.textPrimary`, or a dedicated
neutral-button background token. If none exists, add `COLORS.archiveAction`
(or reuse `COLORS.cardBackground` darkened) and document the choice.

```tsx
action === 'archive' ? COLORS.accent : // or a new neutral-action color
```

---

### WR-03: "Since" pill uses UTC date, can off-by-one for non-UTC viewers

**File:** `src/components/moderation/ListingModerationBottomSheet.tsx:86-94`
**Issue:**
```tsx
moderatedSinceLabel = `${T.listingModeratedSincePrefix ?? 'Since'} ${d
  .toISOString()
  .slice(0, 10)}`;
```

`Date.toISOString()` always emits UTC. A listing moderated at
`2026-05-29T01:00:00Z` shown to a viewer in PST (UTC-8) was moderated at
local time `2026-05-28 17:00`. The pill displays `Since 2026-05-29` — a
day later than the admin's actual local action time.

The plan comment justifies this as "year substring is the only contractual
match (Block C Test 4)" — the test only asserts substring "2026" appears
— but the *user-visible* date is still wrong by up to 24 hours.

**Fix:**
Use locale-aware formatting:

```tsx
moderatedSinceLabel = `${T.listingModeratedSincePrefix ?? 'Since'} ${
  d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
}`;
```

Or, if cross-platform locale formatting is fragile in React Native, manually
extract local YYYY-MM-DD:
```tsx
const yyyy = d.getFullYear();
const mm = String(d.getMonth() + 1).padStart(2, '0');
const dd = String(d.getDate()).padStart(2, '0');
moderatedSinceLabel = `${prefix} ${yyyy}-${mm}-${dd}`;
```

---

### WR-04: `useAuth() as any` defeats type safety in CarDetailsScreen

**File:** `src/screens/CarDetailsScreen.tsx:33`
**Issue:**
```tsx
const { user, isAdmin } = useAuth() as any;
```

`AuthContext` exports a typed value (Phase 4 plan). Casting to `any`
discards the type information and shadows future regressions — e.g. if
`isAdmin` is renamed or its shape changes, this file won't fail to compile.
The same pattern (`useAuth() as unknown as {...}`) used in
`AdminModerationScreen.tsx:132-136` is type-safe and documents the
specific shape consumed.

**Fix:**
```tsx
const auth = useAuth() as unknown as {
  user: { localId?: string; moderationStatus?: { state?: string; restrictedFeatures?: string[] } } | null;
  isAdmin: boolean;
};
const { user, isAdmin } = auth;
```

Or if AuthContextType already exposes `isAdmin`, drop the cast entirely.

---

### WR-05: `handleRecoverListing` rollback uses closure-captured `prev` and can clobber other state

**File:** `src/screens/AdminModerationScreen.tsx:505-521`
**Issue:**
```tsx
const handleRecoverListing = async (row, body) => {
  const prev = listings;                          // ← snapshot at call time
  setListings((curr) => curr.map(...));           // ← functional optimistic update
  setRecoverTarget(null);
  try {
    await ModerationService.restoreListing(row._id, body);
  } catch (err) {
    setListings(prev);                            // ← overwrites WHOLE list (functional rollback dropped)
    ...
  }
};
```

If `runListingsSearch` or `fetchNextListingsPage` resolves between the
optimistic flip and the catch (very plausible during a slow `restoreListing`
call when admin scrolls or refreshes), the `setListings(prev)` rollback
overwrites *those* updates too. Result: pagination data or refreshed rows
disappear on error.

**Fix:**
Either snapshot just the one row or use a functional rollback that targets
the specific row:

```tsx
const prevRow = listings.find(l => l._id === row._id);
setListings(curr => curr.map(l => l._id === row._id ? { ...l, status: 'active', moderatedAt: null, moderationReason: null } : l));
setRecoverTarget(null);
try {
  await ModerationService.restoreListing(row._id, body);
} catch (err) {
  setListings(curr => prevRow ? curr.map(l => l._id === row._id ? prevRow : l) : curr);
  ...
}
```

---

### WR-06: Silent deep-link fetch failure in CarDetailsScreen

**File:** `src/screens/CarDetailsScreen.tsx:133-158`
**Issue:**
```tsx
apiClient.get(`/api/cars/${carId}`)
  .then(res => { setFetchedCar({...}); })
  .catch(() => setFetchedCar(null))      // ← swallowed
  .finally(() => setCarLoading(false));
```

A 401/403/404/500 from the backend produces an indistinguishable
`fetchedCar = null` outcome. The screen falls through to the "Car not found"
message regardless of cause. Admins debugging in production can't tell
"car deleted" from "you're unauthenticated" from "backend down".

This is a pre-existing pattern but the Phase 10 changes (which now place
critical admin moderation flows downstream of this fetch) amplify the
issue. A failing fetch silently disables the entire admin moderation
surface (CR-04 above).

**Fix:**
Distinguish error types and surface a banner / Alert for non-404 failures:

```tsx
.catch((err) => {
  setFetchedCar(null);
  if (err?.response?.status === 404) return; // intentional "not found"
  if (axios.isCancel?.(err)) return;
  console.error('Failed to load car', err);
  Alert.alert(t.error || 'Error', T.errLoadCarBody);
})
```

---

### WR-07: Phase 10 admin status banner ignores `banner` payload structure on type-narrowed access

**File:** `src/screens/CarDetailsScreen.tsx:658-687`
**Issue:**
The banner gates on `banner?.severity`:
```tsx
fetchedCar.moderationBadge.banner?.severity === 'warning' && styles.adminBannerWarning,
```

But `moderationBadge` itself is typed loosely (`fetchedCar: any`). If the
backend returns a moderationBadge missing the `banner` sub-object (any of
the four shapes documented in errors.ts `ListingModerationError.banner`),
none of the conditional styles fire and the banner renders with default
neutral styling — including for `destructive` cases. The fallback
`adminStatusBanner` style has no color cue, so a critical "deleted" banner
visually reads identical to an informational one.

**Fix:**
Either (a) derive the severity from `moderationBadge.status` directly:
```tsx
const severity =
  fetchedCar.moderationBadge.banner?.severity ??
  (fetchedCar.moderationBadge.status === 'deleted' ? 'destructive' :
   fetchedCar.moderationBadge.status === 'archived' ? 'neutral' : 'warning');
```
Or (b) make the field required end-to-end and assert at the boundary that
the backend supplied it.

---

### WR-08: `_id` not consistently used across services; `ListingSearchItem._id` vs `car_abc` test fixtures

**File:** `src/services/moderation/ModerationService.ts:284-297` (ListingSearchItem) and `src/screens/__tests__/AdminModerationScreen.tabs.test.tsx:74-98` (fixture)
**Issue:**
`ListingSearchItem` declares `_id: string` as canonical. AdminModerationScreen
correctly uses `item._id` everywhere. But `CarDetailsScreen` uses both
`car._id` and `car.id` interchangeably (lines 78-83, 250, 292, 385, 439, etc.)
because the route param is `carId` (no underscore) while the API and admin
list emit `_id`.

In Phase 10 specifically: `navigation.navigate('CarDetails', { carId: item._id })`
from the listings tab passes `_id` as `carId`. The receiving screen reads
`route.params.carId` — fine — but downstream the admin sheet's
`moderationBadge={fetchedCar?.moderationBadge}` depends on `fetchedCar`
having been populated via the deep-link fetch, which IS the case here.

Lower-severity than CR-04 but worth noting: any future surface that
prefills route params with carData using `id` (not `_id`) will silently
mismatch when admin actions optimistically update `fetchedCar` keyed by
the wrong field. The id/`_id` ambiguity throughout the screen is a
maintainability landmine.

**Fix:**
Add `const carIdNormalized = car._id ?? car.id ?? carId;` near the top of
the screen and use it consistently. Long-term: type the route params'
`carData` and enforce the canonical `_id` shape.

---

## Info

### IN-01: ListingModerationBottomSheet `numberOfLines={1}` truncation can hide important info

**File:** `src/components/moderation/ListingModerationBottomSheet.tsx:122`
**Issue:**
The header text `<Text style={styles.headerTitle} numberOfLines={1}>{listingTitle}</Text>`
truncates the listing title to a single line. For titles like "2024 Ford
F-150 Lightning Platinum Extended" the admin sees just "2024 Ford F-150 Li…"
which then mismatches the typed-confirm sentinel target shown in
`TypedConfirmationModal` (which has its own `numberOfLines={1}` subtitle on
line 115 of `ListingModerationReasonModal.tsx`).

The typed-confirm matcher uses the full string from `buildListingTitle`
which IS the canonical match, but the admin reading the truncated header
may not know what to type.

**Fix:**
Allow up to 2 lines in the header, or remove the `numberOfLines` cap:

```tsx
<Text style={styles.headerTitle} numberOfLines={2}>{listingTitle}</Text>
```

---

### IN-02: `Pressable onPress={() => {}}` no-op suppression is fragile across RN gesture handler updates

**File:**
- `src/components/moderation/ListingModerationBottomSheet.tsx:113`
- `src/components/moderation/ListingModerationReasonModal.tsx:108`
- `src/components/moderation/ListingRestoreModal.tsx:74`
- `src/components/moderation/TypedConfirmationModal.tsx:72`

**Issue:**
The "tap-stop" technique relies on `onPress={() => {}}` to swallow the bubble
through the outer Pressable's `onPress={onClose}`. This is the documented
RN pattern but is brittle to future RN gesture-handler changes (and to
maintenance — a future refactor might remove the no-op handler thinking
it's dead code).

**Fix:**
Use the more explicit `onStartShouldSetResponder={() => true}` pattern, or
wrap the inner content in a `View pointerEvents="box-only"`-style construct,
and add a comment documenting *why* the no-op is needed (so future
maintainers don't strip it). At minimum keep the test (Block D 'inner sheet
wraps content with a no-op onPress' in `ListingModerationBottomSheet.test.tsx:227-239`)
in place — it currently locks this pattern via source-file grep, which is
a defensive measure already.

---

### IN-03: `mapListingStatusToSeverityState` inverse-intuition mapping needs runtime sanity test

**File:** `src/screens/AdminModerationScreen.tsx:106-119`
**Issue:**
The mapping intentionally swaps colors compared to the user-domain palette
(see the comment block lines 96-105). Notably:
- `archived` → `permanently_banned` (neutral grey, but `permanently_banned`
  in the user palette implies severity red).
- `deleted` → `blocked_with_review` (destructive red).

A reviewer scanning the code unguardedly would expect `archived → blocked_with_review` and `deleted → permanently_banned`. The comment block is helpful
but the runtime behavior is locked by no test. Test 6 in tabs.test.tsx
verifies that the title renders but not the badge color.

**Fix:**
Add a unit test asserting the four-way mapping:

```ts
test('mapListingStatusToSeverityState — inverse-intuition mapping', () => {
  // Internal export needed; or test via SeverityBadge state prop of rendered row.
  expect(mapListingStatusToSeverityState('active')).toBe('active');
  expect(mapListingStatusToSeverityState('suspended')).toBe('feature_limited');
  expect(mapListingStatusToSeverityState('archived')).toBe('permanently_banned');
  expect(mapListingStatusToSeverityState('deleted')).toBe('blocked_with_review');
});
```

This locks the mapping against accidental "fixing" by a well-intentioned
future maintainer.

---

### IN-04: Magic limit `25` for image picker selection — extract as constant

**File:**
- `src/screens/SellCarScreen.tsx:275, 785`
- `src/services/moderation/ModerationService.ts` (no limit; relies on screen)

**Issue:**
`launchImageLibrary({ selectionLimit: 25 - currentTotal })` and the UI cap
`displayImages.length < 25` use a magic number that must match the backend
multer config. Phase 10 admin-edit path also assembles `newFiles` without
re-validating the cap. If the backend changes its max upload count the
mobile cap silently diverges.

**Fix:**
Add `export const LISTING_MAX_IMAGES = 25;` to a shared constants file
(e.g. `src/constants/listingLimits.ts`), and import in both SellCarScreen
locations and the admin-edit submit. Backend should also re-export the
same constant or document the contract.

---

### IN-05: Several `as any` casts in CarDetailsScreen weaken safety in the admin-action surface

**File:** `src/screens/CarDetailsScreen.tsx:489, 510, 513, 517`
**Issue:**
The new `handleListingActionSubmit` casts liberally:
```tsx
setFetchedCar((c: any) => c ? ({ ... }) : c);
const result: any = await fn(carId, (body ?? {}) as any);
setFetchedCar((c: any) => c ? ({ ...c, ...result.listing }) : c);
setFetchedCar((c: any) => c ? ({ ...c, status: prevStatus, moderationBadge: prevBadge ?? undefined }) : c);
```

Each `as any` silently allows wrong-shaped payloads through. The `fn(carId,
body as any)` cast in particular bypasses the discriminated union between
`SuspendListingBody`, `ArchiveListingBody`, `DeleteListingBody`, and
`RestoreListingBody`. If `pendingDeletePayload.reasonCategory` were ever
populated with a user-domain value (e.g. `'misleading'`), TypeScript would
not catch it.

**Fix:**
Type `fetchedCar` as a discriminated union with optional `moderationBadge`,
type `result` as `ListingActionResponse`, and switch the dispatch to a
typed `Record<action, (body) => Promise<...>>` so each branch enforces the
correct body shape.

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
