# Phase 11: Buyer-affected UX + Quality + Security Review — Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 13 (5 new component/test files, 5 modified, 2 generated docs, 1 generator script)
**Analogs found:** 13 / 13 (100% — all targets have a strong in-repo analog from Phases 6, 9, 10)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/moderation/ListingStatusBanner.tsx` (NEW) | component (presentational, severity-aware) | request-response (props in, JSX out) | `src/components/moderation/UserStatusBanner.tsx` | exact (sibling-domain mirror) |
| `src/components/moderation/__tests__/ListingStatusBanner.test.tsx` (NEW) | test (component, react-test-renderer) | request-response | `__tests__/components/moderation/UserStatusBanner.test.tsx` | exact |
| `src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` (NEW) | test (screen integration) | request-response | `src/screens/__tests__/CarDetailsScreen.admin.test.tsx` | exact (same screen, sibling-domain mount) |
| `src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` (NEW) | test (screen integration, focus-effect) | event-driven (focus → re-fetch) | `src/screens/__tests__/CarDetailsScreen.admin.test.tsx` + `UserStatusBanner.test.tsx` mock pattern | role-match (no prior ServiceCartScreen test exists) |
| `__tests__/lbuy03-no-auto-cancel.test.ts` (NEW) | test (source-grep audit) | file-I/O (fs.readFileSync + regex) | `__tests__/moderation-literals.test.ts` | exact (same fs+regex pattern) |
| `scripts/generate-coverage-manifest.sh` (NEW) | utility (shell generator) | batch (grep tree, emit markdown) | (no in-repo bash script analog; falls back to RESEARCH §Code Examples) | NO ANALOG — use RESEARCH §Coverage script |
| `.planning/phases/11-.../11-COVERAGE.md` (GENERATED) | doc artifact | batch output | (no prior coverage manifest in repo) | NO ANALOG — first of its kind |
| `.planning/phases/11-.../11-LIST-SECURITY.md` (NEW) | doc artifact (5-verdict review) | request-response | `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` | exact (clone + listing-domain substitution) |
| `src/screens/CarDetailsScreen.tsx` (MODIFIED) | screen (mount banner, gate CTAs, surface 409) | request-response | self (lines 655-705 existing admin banner; lines 887-911 existing CTA disable) | exact (additive layer above existing admin path) |
| `src/screens/ServiceCartScreen.tsx` (MODIFIED) | screen (focus re-fetch, inline banner, disable checkout) | event-driven (useFocusEffect) | `src/components/moderation/UserStatusBanner.tsx:99-103` (useFocusEffect pattern); self lines 136-152 (carCard render) | role-match (focus-effect pattern from UserStatusBanner) |
| `src/constants/translations.ts` (MODIFIED) | config (i18n keys) | request-response | existing `reasonSpam` / `bannerTitleFeatureLimited` Phase 6 keys at lines 432-435 + 541-543 | exact (same naming convention, distinct namespace) |
| `__tests__/translation-parity.test.ts` (MODIFIED) | test (extension — placeholder parity) | file-I/O | self existing 76 lines | exact (extend existing describe block) |
| `__tests__/moderation-literals.test.ts` (MODIFIED) | test (extension — SCAN_FILES list) | file-I/O | self existing 101 lines | exact (extend SCAN_FILES array) |

## Pattern Assignments

### `src/components/moderation/ListingStatusBanner.tsx` (component, presentational)

**Analog:** `src/components/moderation/UserStatusBanner.tsx` (316 lines, complete reference)

**Imports pattern** (lines 21-37 of analog):
```tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TouchableOpacity,
  LayoutAnimation, Linking, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ShieldAlert, Ban } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';        // OMIT — listing banner is prop-driven, no useAuth
import { useLanguage } from '../../context/LanguageContext';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
```

**Module-scope literal maps** (lines 39-66 of analog — copy the structure exactly, substitute listing values):
```tsx
// ModerationState literal union — mirrors SeverityBadge.tsx; do not widen.
type ModerationState = 'active' | 'feature_limited' | 'blocked_with_review' | 'permanently_banned';

const STATE_TO_PALETTE_KEY = { ... } as const;       // -> STATUS_TO_SEVERITY for listing
const SEVERITY_ICON = { ... } as const;              // copy directly, swap icons per listing severity
const STATE_TO_TITLE_KEY = { ... } as const;         // -> STATUS_TO_TITLE_KEY for listing
```

For listing domain (per CONTEXT D-13, RESEARCH Pitfall 6, RESEARCH Code Examples line 263-276):
```tsx
type ListingStatus = 'suspended' | 'archived' | 'deleted';
type Severity = 'warning' | 'neutral' | 'destructive';

const SEVERITY_ICON: Record<Severity, any> = {
  warning: AlertTriangle,   // suspended
  neutral: Archive,         // archived
  destructive: Ban,         // deleted
};

const STATUS_TO_TITLE_KEY: Record<ListingStatus, string> = {
  suspended: 'listingStatusBannerSuspendedTitle',
  archived:  'listingStatusBannerArchivedTitle',
  deleted:   'listingStatusBannerDeletedTitle',
};
```

**Severity → color resolution** (severity literal → COLORS.* token) — analog uses `COLORS.moderation[paletteKey]` (line 116). Listing-domain severity is NOT in `COLORS.moderation`; map directly to top-level tokens per RESEARCH Pitfall 8 + `src/constants/theme.ts:16-17`:

```tsx
const severityToColor: Record<Severity, string> = {
  warning:     COLORS.warning,         // #F59E0B
  neutral:     COLORS.textTertiary,    // #6B7280
  destructive: COLORS.destructive,     // #EF4444
};
```

**useFocusEffect collapse-on-blur** (lines 99-103 of analog — copy verbatim):
```tsx
useFocusEffect(
  useCallback(() => {
    return () => setExpanded(false);
  }, []),
);
```

**Render envelope — line 1 (icon + title + reason chip)** (lines 191-214 of analog):
```tsx
<View testID={testID} accessible accessibilityRole="alert" accessibilityLiveRegion="polite"
  accessibilityLabel={accessibilityLabel}
  style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + SIZES.spacingMd }]}>
  <View style={[styles.accentBar, { backgroundColor: palette.border }]} />
  <View style={styles.line1}>
    <Icon size={16} color={palette.fg} testID={`user-status-banner-icon-${state}`} />
    <Text style={[TYPOGRAPHY.bodyStrong, styles.title, { color: palette.fg }]} numberOfLines={1} ellipsizeMode="tail">
      {title}
    </Text>
    {reasonCategory && (
      <View style={styles.reasonChip}>
        <Text style={styles.reasonChipText}>{reasonLabel}</Text>
      </View>
    )}
  </View>
```

**Divergence for ListingStatusBanner:**
- Replace `palette.bg` / `palette.border` / `palette.fg` (from `COLORS.moderation[paletteKey]`) with `${accentColor}1A` (10% opacity tint via hex alpha) + `accentColor` (full) — per RESEARCH §Pattern 1 lines 316-330 + Pitfall 8 mapping.
- Replace `testID="user-status-banner"` → `testID="listing-status-banner"`; icon testID → `listing-status-banner-icon-${status}`.
- Container is NOT `position: 'absolute'` / `zIndex: 9998` (analog lines 259-268 — that's for the App.tsx-global mount). Listing banner is inline in the screen ScrollView per CONTEXT D-02.
- NO `useAuth()` — banner is purely prop-driven. Data flows in via `{ status, reasonCategory, bannerHints, note, variant, onRemoveFromCart }` props.
- NO Linking/Alert import (no appeal CTA on listing banner — that's a user-domain affordance).

**Tap-to-expand note** (lines 216-234 of analog):
```tsx
{hasNote && (
  <Pressable testID="user-status-banner-note" onPress={onToggleNote}
    accessibilityRole="button"
    accessibilityLabel={expanded ? t.collapseNote : t.expandNote}>
    <Text style={[TYPOGRAPHY.body, styles.note]}
      numberOfLines={expanded ? undefined : 2}>
      {note}
    </Text>
  </Pressable>
);
```

**LayoutAnimation toggle** (lines 128-133 of analog — critical: `configureNext` MUST be called synchronously before setState, per analog Pitfall comment):
```tsx
const onToggleNote = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setExpanded((prev) => !prev);
};
```

**Variant prop branch — cartRow-only Remove CTA** (NEW for Phase 11 D-12; no analog — closest is the user-banner Appeal CTA at lines 238-253):
```tsx
{variant === 'cartRow' && onRemoveFromCart && (
  <Pressable testID="listing-status-banner-remove" onPress={onRemoveFromCart}>
    <Text style={styles.removeCta}>{(t as any).cartListingUnavailableRemove}</Text>
  </Pressable>
)}
```

**StyleSheet** (lines 258-316 of analog — copy structure, drop `position: 'absolute'` + `zIndex` for inline mount):
- Keep: `accentBar` (4 px absolute left strip), `line1` (flex-row + spacingSm gap), `reasonChip`, `reasonChipText`, `note`.
- Drop: `container.position`/`top`/`left`/`right`/`zIndex`/`paddingBottom` global positioning.
- Add (cartRow variant): `removeCta` matching analog `ctaLabel` color + accent.

---

### `src/components/moderation/__tests__/ListingStatusBanner.test.tsx` (test, component)

**Analog:** `__tests__/components/moderation/UserStatusBanner.test.tsx` (200+ lines)

**Imports + harness setup** (lines 14-33 of analog):
```tsx
import React from 'react';
import TestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { Text, Pressable, TouchableOpacity, Linking, Alert } from 'react-native';
import { ListingStatusBanner } from '../../ListingStatusBanner';

const mockT = new Proxy(
  { /* concrete strings for substring-match tests */ } as any,
  { get: (target, key) => key in target ? (target as any)[key] : String(key) },
);
```

**Mock LanguageContext + safe-area + focus-effect** (lines 39-56 of analog — copy verbatim; **skip the `useAuth` mock** — banner is prop-driven):
```tsx
jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: mockT }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: any) => {
    const cleanup = cb();
    if (typeof cleanup === 'function') { /* simulated unmount */ }
  },
}));
```

**Render helper** (lines 68-74 of analog — adapt to take props):
```tsx
function render(props: Props): TestRenderer.ReactTestRenderer {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<ListingStatusBanner {...props} />); });
  return tree;
}
```

**Describe-block requirement-ID convention** (per CONTEXT D-10): every `describe()` covering an LBUY-* requirement begins with the ID:
```tsx
describe('LBUY-01: ListingStatusBanner renders severity-aware tone on suspended listing', () => { ... });
describe('LBUY-04: severity tone matrix — neutral=archived, warning=suspended, destructive=deleted', () => { ... });
```

**Per-status / per-variant test cases** (analog lines 116-197 are the template — sweep `feature_limited / blocked_with_review / permanently_banned`):
- For Phase 11: sweep `suspended / archived / deleted` × `detail / cartRow` variants × 5 reasonCategory values (`spam / policy_violation / fraud / inactive_seller / other`).
- Use RESEARCH §Test Dimensions Minimum Fixture Set F2-F6 as the parameterized matrix.

---

### `src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` (test, screen integration)

**Analog:** `src/screens/__tests__/CarDetailsScreen.admin.test.tsx` (Phase 10 — same screen, sibling banner)

**Mock setup pattern** (analog lines 26-100):
```tsx
jest.mock('../../services/moderation/ModerationService', () => ({ ModerationService: { ... } }));
let mockAuthState: { user: { localId: string } | null; isAdmin: boolean } = { user: { localId: 'buyer-1' }, isAdmin: false };
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuthState }));
const mockT = new Proxy({}, { get: (_t: unknown, k: string) => String(k) });
jest.mock('../../context/LanguageContext', () => ({ useLanguage: () => ({ t: mockT }) }));
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ setCar: jest.fn() }) }));
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({ initPaymentSheet: jest.fn(), presentPaymentSheet: jest.fn() }),
  StripeProvider: ({ children }: any) => children,
}));
jest.mock('../../hooks/useTypography', () => ({ useTypography: () => ({ display: 'System', mono: 'System' }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock('@likashefqet/react-native-image-zoom', () => ({ Zoomable: ({ children }: any) => children }));
jest.mock('../../components/OptimizedImage', () => ({ OptimizedImage: () => null }));
```

**Divergence from analog:**
- Default `mockAuthState` to **non-admin** (analog defaults to admin).
- Mock `apiClient.get('/api/cars/:id')` to resolve with thin-payload fixtures F2-F6 from RESEARCH §Test Dimensions.
- Assertions target `testID="listing-status-banner"` mount above hero + `testID="car-details-telegram-cta" / "car-details-whatsapp-cta"` disabled-state predicate.

**Describe ID convention**:
```tsx
describe('LBUY-01: CarDetailsScreen mounts ListingStatusBanner for non-admin viewer of suspended listing', () => { ... });
describe('LBUY-01: Telegram + WhatsApp + Book it + Get services CTAs disabled when listing non-active', () => { ... });
```

---

### `src/screens/__tests__/ServiceCartScreen.listingBanner.test.tsx` (test, screen integration with useFocusEffect)

**Analog (mock patterns):** `src/screens/__tests__/CarDetailsScreen.admin.test.tsx` (mock structure) + `__tests__/components/moderation/UserStatusBanner.test.tsx` lines 45-56 (focus-effect mock pattern)

**Critical: useFocusEffect mock must invoke the callback synchronously** so apiClient.get fires inside the act() boundary:
```tsx
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    useFocusEffect: (cb: any) => { const cleanup = cb(); /* may return cleanup */ },
  };
});
```

**Cart context mock** — provide `car`, `items`, `removeItem`, `clearCart`, `getProviderGroups`, `itemCount` shape mirroring `src/context/CartContext.tsx`:
```tsx
const mockCart = {
  car: { id: 'car_abc', makeName: 'Toyota', modelName: 'Corolla', year: 2022, ... },
  items: [{ provider: { ownerUid: 'b1', type: 'broker', companyName: 'X', ... }, service: { name: 'S', fee: 100, currency: '$', ... } }],
  removeItem: jest.fn(),
  clearCart: jest.fn(),
  getProviderGroups: () => [{ provider: {...}, services: [{...}], subtotal: 100, currency: '$' }],
  itemCount: 1,
};
jest.mock('../../context/CartContext', () => ({ useCart: () => mockCart }));
```

**apiClient.get mock** — different responses per test (active / suspended-thin / 404):
```tsx
jest.mock('../../services/http/client', () => ({
  apiClient: { get: jest.fn() },
}));
// In each test:
(apiClient.get as jest.Mock).mockResolvedValueOnce({
  data: { status: 'suspended', reasonCategory: 'spam', banner: { titleKey: '...', bodyKey: '...', severity: 'warning' } },
});
```

**Describe ID convention**:
```tsx
describe('LBUY-02: ServiceCartScreen re-fetches cart car on focus and flips banner-state on non-active', () => { ... });
describe('LBUY-02: cart is NOT auto-cleared when listing becomes non-active', () => { ... });
describe('LBUY-02: global checkout button disabled when carIsNonActive with subtitle hint', () => { ... });
```

---

### `__tests__/lbuy03-no-auto-cancel.test.ts` (test, source-grep audit)

**Analog:** `__tests__/moderation-literals.test.ts` (exact pattern — fs.readFileSync + regex audit)

**Imports** (analog lines 36-37):
```ts
import fs from 'fs';
import path from 'path';
```

**Scanner pattern** (analog lines 64-81 — adapt regex):
```ts
const SCAN_FILES = [
  'src/screens/MyOrdersScreen.tsx',
  'src/screens/ProviderOrdersScreen.tsx',
];

// LBUY-03 forbids auto-cancel/auto-refund logic touching listing status.
// Red lines: any call to .cancel(/refund( near a substring like 'listing_' or 'listing.status'.
// Adjust regex per actual screen content during planning.
const AUTO_CANCEL_REGEX = /\b(cancel|refund)\s*\(/g;

describe('LBUY-03: no auto-cancel logic in order screens when listing becomes non-active', () => {
  for (const relPath of SCAN_FILES) {
    test(`${relPath} contains no auto-cancel branch keyed on listing status`, () => {
      const absPath = path.resolve(__dirname, '..', relPath);
      expect(fs.existsSync(absPath)).toBe(true);
      const src = fs.readFileSync(absPath, 'utf8');
      const offenders: Array<{ line: number; snippet: string }> = [];
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/listing[_.]?status/i.test(lines[i]) && AUTO_CANCEL_REGEX.test(lines[i])) {
          offenders.push({ line: i + 1, snippet: lines[i].trim() });
        }
        AUTO_CANCEL_REGEX.lastIndex = 0;
      }
      expect(offenders).toEqual([]);
    });
  }
});
```

---

### `src/screens/CarDetailsScreen.tsx` (MODIFIED — mount banner, gate CTAs, surface 409)

**Self-analog #1 — Existing admin banner mount** (lines 655-705):
```tsx
<View style={styles.detailsContainer}>
  {/* Phase 10 admin status banner — KEEP UNCHANGED */}
  {isAdmin && fetchedCar?.moderationBadge && (
    <View testID="admin-status-banner" style={[...]}>
      <Text>{fetchedCar.moderationBadge.status}</Text>
      ...
    </View>
  )}
  {/* Phase 10 admin error banner — KEEP UNCHANGED */}
  {errorBanner && ( <View testID="admin-error-banner" ... /> )}
```

**Phase 11 INSERTION POINT:** above the existing admin banner block (so non-admin sees `ListingStatusBanner`, admin sees `admin-status-banner`; they are mutually exclusive by the `isAdmin` predicate):
```tsx
<View style={styles.detailsContainer}>
  {/* NEW Phase 11 — non-admin buyer-facing banner above hero (per CONTEXT D-02) */}
  {!isAdmin && fetchedCar?.status && fetchedCar.status !== 'active' && fetchedCar?.banner && (
    <ListingStatusBanner
      status={fetchedCar.status as 'suspended' | 'archived' | 'deleted'}
      reasonCategory={fetchedCar.reasonCategory}
      bannerHints={fetchedCar.banner}
      variant="detail"
    />
  )}
  {/* EXISTING admin banner — untouched */}
  {isAdmin && fetchedCar?.moderationBadge && (...)}
  ...
```

**Self-analog #2 — Existing isContactGated CTA-disable pattern** (lines 72-77 + 887-911 — verbatim template for new `isListingNonActive` derivation):
```tsx
// Existing predicate at lines 72-77
const isContactGated =
  state !== 'active' &&
  (restricted.includes('all_writes') || restricted.includes('contact_seller'));
```

**Phase 11 ADDITION:**
```tsx
const isListingNonActive =
  !isAdmin && !!fetchedCar?.status && fetchedCar.status !== 'active';
```

**Self-analog #3 — Existing CTA disable** (lines 887-911 — Telegram, WhatsApp):
```tsx
<TouchableOpacity
  style={[styles.contactButton, styles.telegramButton, isContactGated && { opacity: 0.4 }]}
  onPress={isContactGated ? () => setContactGateVisible(true) : handleTelegram}
  disabled={false}
  testID="car-details-telegram-cta"
  accessibilityState={{ disabled: isContactGated }}>
```

**Phase 11 EXTENSION** — combine predicates per CONTEXT D-04 (all four CTAs: Telegram, WhatsApp, Book it, Get services):
```tsx
<TouchableOpacity
  style={[styles.contactButton, styles.telegramButton, (isContactGated || isListingNonActive) && { opacity: 0.4 }]}
  onPress={
    isListingNonActive ? undefined
    : isContactGated ? () => setContactGateVisible(true)
    : handleTelegram
  }
  disabled={isListingNonActive}
  testID="car-details-telegram-cta"
  accessibilityState={{ disabled: isContactGated || isListingNonActive }}>
```

**Self-analog #4 — Existing Book-it 409 catch** (lines 432-434 — converts to banner-state setter per RESEARCH Edge Case 1):
```tsx
// EXISTING — generic Alert
} catch (err: any) {
  const msg = err?.response?.data?.message || err.message || t.error;
  Alert.alert(t.paymentFailed, msg);
} finally { ... }
```

**Phase 11 EXTENSION** — detect 409 listing_not_available + flip `fetchedCar` to thin-payload from 409 body (Phase 9 D-11):
```tsx
} catch (err: any) {
  // NEW Phase 11 — TOCTOU 409 flips banner state instead of generic Alert
  if (err?.response?.status === 409 && err.response.data?.error === 'listing_not_available') {
    const body = err.response.data;
    setFetchedCar((c: any) => c ? ({
      ...c,
      status: body.status,
      reasonCategory: body.reasonCategory,
      banner: body.banner,
    }) : c);
    return;
  }
  const msg = err?.response?.data?.message || err.message || t.error;
  Alert.alert(t.paymentFailed, msg);
} finally { ... }
```

---

### `src/screens/ServiceCartScreen.tsx` (MODIFIED — focus re-fetch + inline banner + disable checkout)

**Analog for useFocusEffect** — `src/components/moderation/UserStatusBanner.tsx:32 + 99-103` (verified production use of `@react-navigation/native` `useFocusEffect`):
```tsx
import { useFocusEffect } from '@react-navigation/native';

useFocusEffect(
  useCallback(() => { return () => setExpanded(false); }, []),
);
```

**Phase 11 ADDITION** (per RESEARCH §Pattern 4 + Pitfall 6 cancelled-flag pattern):
```tsx
import { useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../services/http/client';

const [carStatus, setCarStatus] = useState<{
  status?: string;
  reasonCategory?: string | null;
  banner?: { titleKey: string; bodyKey: string; severity: 'warning' | 'neutral' | 'destructive' };
} | null>(null);

useFocusEffect(
  useCallback(() => {
    if (!car?.id) return;
    let cancelled = false;
    apiClient.get(`/api/cars/${car.id}`)
      .then((res) => {
        if (cancelled) return;
        setCarStatus({
          status: res.data.status ?? 'active',
          reasonCategory: res.data.reasonCategory ?? null,
          banner: res.data.banner ?? null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          // Per RESEARCH Pitfall 1: carId truly missing → treat as destructive deleted in cart context
          setCarStatus({
            status: 'deleted',
            reasonCategory: null,
            banner: { titleKey: 'listingStatusBannerDeletedTitle',
                      bodyKey: 'listingStatusBannerDeletedBody',
                      severity: 'destructive' },
          });
        }
      });
    return () => { cancelled = true; };
  }, [car?.id]),
);

const carIsNonActive = !!(carStatus?.status && carStatus.status !== 'active');
```

**Self-analog — Existing carCard render** (lines 136-152 — INSERT banner inside carCard before the Image):
```tsx
{car ? (
  <View style={styles.carCard}>
    <Car size={20} color={COLORS.accent} />
    <View style={styles.carInfo}>
      <Text style={styles.carLabel}>{t.selectedVehicle}</Text>
      <Text style={styles.carName}>{car.year} {car.makeName} {car.modelName}</Text>
    </View>
    {car.imageUrl ? (<Image source={{ uri: car.imageUrl }} style={styles.carThumb} />) : null}
  </View>
) : (...)}
```

**Phase 11 INSERTION** — render `ListingStatusBanner variant="cartRow"` inside the existing carCard block when `carIsNonActive`:
```tsx
{car ? (
  <View style={styles.carCard}>
    <Car size={20} color={COLORS.accent} />
    <View style={styles.carInfo}>
      <Text style={styles.carLabel}>{t.selectedVehicle}</Text>
      <Text style={styles.carName}>{car.year} {car.makeName} {car.modelName}</Text>
      {carIsNonActive && carStatus?.banner && (
        <ListingStatusBanner
          status={carStatus.status as 'suspended' | 'archived' | 'deleted'}
          reasonCategory={carStatus.reasonCategory}
          bannerHints={carStatus.banner}
          variant="cartRow"
          onRemoveFromCart={() => { /* Phase 11: clears car slot only, not entire cart */ }}
        />
      )}
    </View>
    {car.imageUrl ? (<Image source={{ uri: car.imageUrl }} style={styles.carThumb} />) : null}
  </View>
) : (...)}
```

**Self-analog — Existing submit button** (lines 212-218):
```tsx
<TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
  {submitting ? (
    <ActivityIndicator size="small" color="#FFF" />
  ) : (
    <Text style={styles.submitText}>{t.submitOrder}</Text>
  )}
</TouchableOpacity>
```

**Phase 11 EXTENSION** — disabled-state derived from `submitting || carIsNonActive` + subtitle hint (per CONTEXT D-06, D-07):
```tsx
<TouchableOpacity
  style={[styles.submitBtn, (submitting || carIsNonActive) && { opacity: 0.4 }]}
  onPress={handleSubmit}
  disabled={submitting || carIsNonActive}>
  {submitting ? (
    <ActivityIndicator size="small" color="#FFF" />
  ) : (
    <Text style={styles.submitText}>{t.submitOrder}</Text>
  )}
</TouchableOpacity>
{carIsNonActive && (
  <Text style={styles.checkoutHint}>{t.cartListingUnavailableCheckoutHint}</Text>
)}
```

---

### `src/constants/translations.ts` (MODIFIED — new keys, RU + EN parity)

**Analog #1 — existing Phase 6 banner-title keys** (locate via grep `bannerTitleFeatureLimited` — lines 541-543 ish):
```ts
// RU
bannerTitleFeatureLimited: 'Доступ ограничен',
bannerTitleBlockedWithReview: 'Аккаунт заблокирован',
bannerTitlePermanentlyBanned: 'Аккаунт навсегда заблокирован',

// EN — mirror keys, English values
bannerTitleFeatureLimited: 'Limited access',
...
```

**Analog #2 — existing reason chip keys** (lines 432-435 ish):
```ts
reasonSpam: 'Спам',
reasonPolicyViolation: 'Нарушение правил',
reasonFraud: 'Мошенничество',
reasonOther: 'Другое',
```

**Phase 11 ADDITION** — use distinct `listingStatusBanner*` + `cartListingUnavailable*` namespaces (per CONTEXT D-13 + RESEARCH Pitfall 4 — DO NOT reuse user-domain `reasonSpam` etc., to avoid cross-domain coupling):

```ts
// RU — add BEFORE the closing `}` of TRANSLATIONS.RU
listingStatusBannerSuspendedTitle: 'Объявление приостановлено',
listingStatusBannerSuspendedBody: 'Это объявление временно недоступно.',
listingStatusBannerArchivedTitle: 'Объявление в архиве',
listingStatusBannerArchivedBody: 'Это объявление больше не активно.',
listingStatusBannerDeletedTitle: 'Объявление удалено',
listingStatusBannerDeletedBody: 'Это объявление больше не доступно.',
listingStatusBannerReasonSpam: 'Спам',
listingStatusBannerReasonPolicyViolation: 'Нарушение правил',
listingStatusBannerReasonFraud: 'Мошенничество',
listingStatusBannerReasonInactiveSeller: 'Неактивный продавец',
listingStatusBannerReasonOther: 'Другое',
cartListingUnavailableTitle: 'Автомобиль больше не доступен',
cartListingUnavailableBody: 'Удалите автомобиль из корзины, чтобы продолжить.',
cartListingUnavailableRemove: 'Удалить из корзины',
cartListingUnavailableCheckoutHint: 'Удалите недоступное объявление, чтобы оформить остальные услуги.',

// EN — same key set, English values (mandatory for QUAL-01 parity scanner)
listingStatusBannerSuspendedTitle: 'Listing suspended',
listingStatusBannerSuspendedBody: 'This listing is temporarily unavailable.',
listingStatusBannerArchivedTitle: 'Listing archived',
listingStatusBannerArchivedBody: 'This listing is no longer active.',
listingStatusBannerDeletedTitle: 'Listing removed',
listingStatusBannerDeletedBody: 'This listing is no longer available.',
listingStatusBannerReasonSpam: 'Spam',
listingStatusBannerReasonPolicyViolation: 'Policy violation',
listingStatusBannerReasonFraud: 'Fraud',
listingStatusBannerReasonInactiveSeller: 'Inactive seller',
listingStatusBannerReasonOther: 'Other',
cartListingUnavailableTitle: 'This vehicle is no longer available',
cartListingUnavailableBody: 'Remove the vehicle from your cart to continue.',
cartListingUnavailableRemove: 'Remove from cart',
cartListingUnavailableCheckoutHint: 'Remove the unavailable listing to check out remaining services.',
```

---

### `__tests__/translation-parity.test.ts` (MODIFIED — placeholder-token parity extension)

**Self-analog — existing describe block** (lines 33-76):
```ts
describe('QUAL-01: translation parity', () => {
  const ru = Object.keys((TRANSLATIONS as any).RU).sort();
  const en = Object.keys((TRANSLATIONS as any).EN).sort();

  test('RU and EN key sets are identical', () => { ... });
  test('every value is a non-empty string (or non-empty array of non-empty strings)', () => { ... });
  test('no TODO/FIXME/TRANSLATE placeholder values', () => { ... });
});
```

**Phase 11 ADDITION** — fourth test case inside the same describe block (per CONTEXT D-09 / RESEARCH §Code Examples lines 728-763 — copy verbatim):
```ts
test('placeholder tokens are identical across RU and EN for every key', () => {
  const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
  function extract(value: unknown): Set<string> {
    const set = new Set<string>();
    const visit = (v: unknown) => {
      if (typeof v === 'string') {
        let m; PLACEHOLDER.lastIndex = 0;
        while ((m = PLACEHOLDER.exec(v)) !== null) set.add(m[1]);
      } else if (Array.isArray(v)) v.forEach(visit);
    };
    visit(value);
    return set;
  }

  const ruObj = (TRANSLATIONS as any).RU;
  const enObj = (TRANSLATIONS as any).EN;
  const mismatches: Array<{ key: string; ru: string[]; en: string[] }> = [];
  for (const key of Object.keys(ruObj)) {
    const ruTokens = extract(ruObj[key]);
    const enTokens = extract(enObj[key]);
    if (
      ruTokens.size !== enTokens.size ||
      [...ruTokens].some((tok) => !enTokens.has(tok))
    ) {
      mismatches.push({ key, ru: [...ruTokens].sort(), en: [...enTokens].sort() });
    }
  }
  expect(mismatches).toEqual([]);
});
```

**Critical:** Do NOT create a new test file. Extend the existing describe block (file is 76 lines — pattern intact).

---

### `__tests__/moderation-literals.test.ts` (MODIFIED — extend SCAN_FILES)

**Self-analog — existing SCAN_FILES array** (lines 42-46):
```ts
const SCAN_FILES = [
  'src/components/moderation/UserStatusBanner.tsx',
  'src/components/moderation/FeatureGateOverlay.tsx',
  'src/components/moderation/GatedScreenWrapper.tsx',
];
```

**Phase 11 ADDITION** — append the new banner file ONLY (per RESEARCH Pitfall 12: do NOT add `CarDetailsScreen.tsx` or `ServiceCartScreen.tsx`):
```ts
const SCAN_FILES = [
  'src/components/moderation/UserStatusBanner.tsx',
  'src/components/moderation/FeatureGateOverlay.tsx',
  'src/components/moderation/GatedScreenWrapper.tsx',
  'src/components/moderation/ListingStatusBanner.tsx',  // Phase 11 — NEW
];
```

Inline comment justification per analog convention (lines 24-28 — analog explains why CarDetailsScreen is NOT in SCAN_FILES; Phase 11 should re-affirm this).

---

### `scripts/generate-coverage-manifest.sh` (NEW — no in-repo bash analog)

**No prior in-repo bash script analog.** Use RESEARCH §Code Examples lines 787-837 verbatim as the template:
- Bash with `set -euo pipefail`
- Traverses `TEST_DIRS=("__tests__" "src/components/moderation/__tests__" "src/screens/__tests__" "src/services/moderation/__tests__" "../backend-services/carEx-services/__tests__")`
- Grep regex: `describe\(['\"]L(BUY|QUAL|MOB|UI|ADM|DATA|ENF|SEC)-[0-9]+:`
- Emits markdown table to stdout — operator redirects to `.planning/phases/11-.../11-COVERAGE.md`
- Trailing coverage-check block lists any LIST-* IDs in REQUIREMENTS.md with zero hits

**Permissions:** `chmod +x scripts/generate-coverage-manifest.sh` after creation.

**Per RESEARCH Pitfall 10 + Assumption A5:** script must walk the cross-repo backend test tree at `../backend-services/carEx-services/__tests__` to capture LADM / LDATA / LSEC / LENF requirements completed in Phases 7-9.

---

### `.planning/phases/11-.../11-LIST-SECURITY.md` (NEW — clone Phase 6)

**Analog:** `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` (254 lines, APPROVED)

**Frontmatter pattern** (analog lines 1-8):
```markdown
---
phase: 11-buyer-affected-ux-quality-security-review
artifact: security-review
status: APPROVED   # or BLOCKED if any FAIL
reviewed_by: self
reviewed_at: YYYY-MM-DD
roadmap_criterion: "Phase 11 Success #5 — 5 verdicts PASS"
---
```

**Five-section structure** (analog uses `(a) verifyIdToken … (b) callerUid … (c) … (d) … (e)`):
- **(a) Authentication** — verifyIdToken on every admin listing route (Phase 7 LSEC-01)
- **(b) Authorization** — no callerUid body-trust on new listing surface (Phase 7 LSEC-02)
- **(c) Audit append-only** — ListingModerationAction six pre-hooks (Phase 7 LDATA-03; see Assumption A7 for verification)
- **(d) TOCTOU** — confirm-booking re-verifies inside transaction (Phase 9 D-12..D-15 refund-first-throw-second)
- **(e) Deferred-verification + no new hardcoded secrets** — cross-repo grep for `AIza/sk_live/pk_live/mongodb`

**Per-section structure** (analog lines 24-71 establish the pattern):
1. **Verification** — bash commands the reviewer runs
2. **Evidence** — file:line citations from grep output
3. **Verdict** — `✅ PASS` or `❌ FAIL`

**Substitute targets** (where analog refers to user-domain, swap to listing-domain):
| Analog references (user-domain) | Phase 11 substitutes (listing-domain) |
|---|---|
| `src/moderation/router.js` | `src/moderation/listingRouter.js` |
| `ModerationAction` model | `ListingModerationAction` model |
| `denySelfModeration` middleware | `denySelfListingModeration` (or equivalent) |
| `src/services/moderation/ModerationService.ts` (mobile) | `src/services/moderation/ListingModerationService.ts` |
| `06-CONTEXT D-QUAL-03` references | Phase 11 D-11 references |

**Use RESEARCH §Code Examples lines 845-950 as the section template skeleton.**

---

## Shared Patterns

### Cross-screen: Severity → COLORS resolution (deterministic, NO new palette entries)

**Source:** `src/constants/theme.ts:16-17` (`COLORS.warning`, `COLORS.destructive`) + `src/constants/theme.ts:7` (`COLORS.textTertiary`)

**Apply to:** `ListingStatusBanner.tsx` (component-internal) — single map at module scope.

```tsx
const severityToColor: Record<'warning' | 'neutral' | 'destructive', string> = {
  warning:     COLORS.warning,         // #F59E0B amber  — suspended
  neutral:     COLORS.textTertiary,    // #6B7280 gray   — archived
  destructive: COLORS.destructive,     // #EF4444 red    — deleted
};
```

Mirrors Phase 10 admin-banner color decision (CONTEXT D-14). DO NOT add `COLORS.moderation.listing.*` sub-palette (RESEARCH Pitfall 8).

### Cross-screen: testID convention for banner mount

**Source:** `UserStatusBanner.tsx:91-196` (uses `user-status-banner` + `user-status-banner-icon-${state}` + `user-status-banner-note`).

**Apply to:** `ListingStatusBanner.tsx` — use `listing-status-banner` + `listing-status-banner-icon-${status}` + `listing-status-banner-note` + `listing-status-banner-remove` (cartRow-only). Used by both `CarDetailsScreen.listingBanner.test.tsx` and `ServiceCartScreen.listingBanner.test.tsx`.

### Cross-screen: CTA disable predicate pattern (opacity + disabled + accessibilityState)

**Source:** `CarDetailsScreen.tsx:887-911` (existing Phase 6 `isContactGated` disabled-state pattern).

**Apply to:** All four CarDetailsScreen buyer CTAs (Telegram :887, WhatsApp :898, Book it :807, Get services :787) — combine `isContactGated || isListingNonActive` per CONTEXT D-04. Same triple of `style opacity` + `disabled` + `accessibilityState`.

### Cross-test: requirement-ID `describe()` convention (LQUAL-02 coverage manifest enablement)

**Source:** Phase 10 + Phase 6 test files use ad-hoc descriptions; Phase 11 introduces this convention per CONTEXT D-10.

**Apply to:** All Phase 11 new tests (`ListingStatusBanner.test.tsx`, `CarDetailsScreen.listingBanner.test.tsx`, `ServiceCartScreen.listingBanner.test.tsx`, `lbuy03-no-auto-cancel.test.ts`) — each `describe()` begins with `LBUY-NN:` or `LQUAL-NN:`. Format:
```tsx
describe('LBUY-01: ListingStatusBanner renders severity-aware tone on suspended listing', () => { ... });
```

The coverage-manifest generator script (`scripts/generate-coverage-manifest.sh`) greps this pattern to emit `11-COVERAGE.md`.

### Cross-test: react-test-renderer harness + Proxy mock-t pattern

**Source:** `__tests__/components/moderation/UserStatusBanner.test.tsx:14-74` + `src/screens/__tests__/CarDetailsScreen.admin.test.tsx:18-100`.

**Apply to:** All Phase 11 component + screen tests. Reuse:
- `react-test-renderer` + `act` (not `@testing-library/react-native`)
- Stable Proxy `mockT` so `useCallback` deps don't rotate (analog comments call out the Plan 05-10 lesson)
- Jest mocks for `useLanguage`, `useAuth`, `useCart`, `useNavigation`, `useSafeAreaInsets`, `useStripe`, `useTypography`, `react-native-safe-area-context`, `lucide-react-native` (icons render as null)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/generate-coverage-manifest.sh` | utility (shell generator) | batch | No prior bash script in repo; use RESEARCH §Code Examples lines 787-837 as the template (well-specified there) |
| `.planning/phases/11-.../11-COVERAGE.md` | doc artifact (generated) | batch output | First per-requirement coverage manifest in the repo; format defined by the generator script |

Note: even these "no analog" items have a specification source (RESEARCH §Code Examples), so the planner has concrete guidance.

## Metadata

**Analog search scope:**
- `src/components/moderation/` (all 8 components + tests)
- `src/screens/` (CarDetailsScreen.tsx, ServiceCartScreen.tsx)
- `src/screens/__tests__/` (5 existing screen tests)
- `__tests__/` (translation-parity, moderation-literals, components/moderation/*)
- `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` (verdict template)

**Files scanned:** 13 (full reads on UserStatusBanner.tsx, UserStatusBanner.test.tsx, translation-parity.test.ts, moderation-literals.test.ts, CarDetailsScreen.admin.test.tsx, ServiceCartScreen.tsx, theme.ts grep); targeted reads on CarDetailsScreen.tsx (3 ranges: 1-230, 380-510, 650-920) and 06-SECURITY.md (lines 1-100).

**Pattern extraction date:** 2026-05-29

**Key insight:** Phase 11 is overwhelmingly a sibling-domain mirror exercise — every new file has an exact analog from Phase 6 (UserStatusBanner family), Phase 9 (thin payload contract), or Phase 10 (CarDetailsScreen admin mount). The planner should copy structure verbatim and substitute listing-domain identifiers. No speculative abstraction (single shared `<StatusBanner>` primitive) per CONTEXT D-01.
