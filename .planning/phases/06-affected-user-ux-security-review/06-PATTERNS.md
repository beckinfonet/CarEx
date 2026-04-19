# Phase 6: Affected-User UX + Security Review — Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 14 (3 NEW components, 1 NEW jest test, 1 NEW scripts file, 1 NEW SECURITY doc, 6 MODIFIED, 2 NEW cross-repo backend artifacts)
**Analogs found:** 12 / 14 (2 cross-repo files have no in-repo analog — noted)

Half A (AFF-01..04) is purely presentational; zero new HTTP surface. Every component wires to existing context/theme/translations modules. Half B (QUAL-01..03) adds one jest file + one optional shell script + one cross-repo k6 harness + one markdown SECURITY review.

## File Classification

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `src/components/moderation/UserStatusBanner.tsx` | NEW | presentational component (non-dismissable global banner) | event-driven (tap toggles expand; tap CTA → mailto) + read-only context | `src/components/OfflineNotice.tsx` (whole file) + `src/screens/AdminUserDetailScreen.tsx:344-366` (historyCard left-accent + reasonChip) | exact (mount pattern) + role-match (visual) |
| `src/components/moderation/FeatureGateOverlay.tsx` | NEW | presentational component (centered card inside full-screen dim layer) | read-only context (no events; card is message-only) | `src/components/moderation/EmptyState.tsx:19-38` (icon + title + body + optional action) | role-match (visual rhythm copied; NOT reused as inner card per UI-SPEC §Component 2) |
| `src/components/moderation/GatedScreenWrapper.tsx` | NEW | presentational wrapper (predicate → children vs dim+overlay) | read-only context | `src/components/OfflineNotice.tsx:10-25` (context read + early-return render-or-null) | partial (no wrapper exists; combines OfflineNotice's predicate shape with new sibling-overlay layout) |
| `App.tsx` | MODIFIED | entry (mount banner above OfflineNotice, add Android LayoutAnimation enable) | none | self (lines 76-127, `OfflineNotice` at :86) | self-reference |
| `src/screens/SellCarScreen.tsx` | MODIFIED | screen (wrap root SafeAreaView children in `<GatedScreenWrapper capability="create_listing">`) | none (wrapping only) | self (line 496 `<SafeAreaView>` + lines 498-504 `<View style={styles.header}>`) | self-reference |
| `src/screens/ServiceCartScreen.tsx` | MODIFIED | screen (wrap root SafeAreaView children in `<GatedScreenWrapper capability="create_order">`) | none | self (top-level SafeAreaView + ScrollView) | self-reference |
| `src/screens/ServiceApplicationScreen.tsx` | MODIFIED | screen (wrap with `<GatedScreenWrapper capability="apply_as_provider">` — FRONTEND ALIAS) | none | self (line 32-80) | self-reference |
| `src/screens/CarDetailsScreen.tsx` | MODIFIED | screen (inline conditional render on TWO CTAs at lines 683-691 — per RESEARCH §Open Question 3; NOT a new shared `GatedButtonGate` component) | none | self (lines 683-691 Telegram + WhatsApp TouchableOpacity) | self-reference |
| `src/constants/translations.ts` | MODIFIED | constants (add 32 RU keys + 32 EN keys per UI-SPEC §Copywriting) | none | self — existing structure at lines 1-30 (RU) and line 533 (EN start) + existing Phase 5 additions at lines 1055-1064 (EN) | self-reference |
| `__tests__/translation-parity.test.ts` | NEW | test (static set-equality) | none | `__tests__/moderation.e2e.integration.test.tsx` (jest harness + mocks pattern) + `src/components/moderation/__tests__/EmptyState.test.tsx:7-48` (minimal TestRenderer shape — closer on simplicity) | partial (no set-equality test exists yet — PROPOSED pattern from RESEARCH §Code Examples) |
| `scripts/audit-moderation-literals.sh` | NEW (optional) | script (grep scanner, exit 0/1) | none | `build-ios-release.sh:1-38` (bash header + `set -e` + variable patterns) | partial (no grep/audit script exists — shape copied from release scripts only) |
| `backend-services/carEx-services/scripts/load-test/admin-search.k6.js` | NEW (cross-repo) | backend load-test harness | streaming (k6 VU loop) | **NO in-repo analog** — cross-repo file lives in sister backend repo | none (see RESEARCH §Code Examples for full k6 skeleton) |
| `backend-services/carEx-services/scripts/seed-moderation-load.js` | NEW (cross-repo) | backend seed script | batch insert | **NO in-repo analog** — sister to Phase 5 backend 05-0a/0b patterns | none (see RESEARCH §Code Examples for full seed skeleton) |
| `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` | NEW | doc (6-criterion verification artifact) | none | **NO existing SECURITY.md in-repo** — closest relatives are phase SUMMARY/VERIFICATION files (informal precedent only) | none (structure defined in RESEARCH §Code Examples + CONTEXT D-QUAL-03) |

---

## Pattern Assignments

### `src/components/moderation/UserStatusBanner.tsx` (NEW — presentational, global banner)

**Primary analog:** `src/components/OfflineNotice.tsx` (whole file, 46 lines) — this is the canonical non-dismissable banner pattern established Phase-pre-1.
**Visual analog:** `src/screens/AdminUserDetailScreen.tsx:344-366, 510-537` (historyCard + reasonChip — left-accent + tinted bg).

**Imports pattern — copy verbatim from OfflineNotice.tsx:1-6 and extend:**
```typescript
// From: src/components/OfflineNotice.tsx:1-6
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useNetwork } from '../hooks/useNetwork';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';
```

Phase 6 additions (per RESEARCH §Code Examples banner skeleton and UI-SPEC §Component 1):
```typescript
// Additional imports NOT present in OfflineNotice:
import { useState, useCallback } from 'react';
import { Pressable, TouchableOpacity, LayoutAnimation, Linking, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AlertTriangle, ShieldAlert, Ban } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
```

**Mount/early-return pattern (copy from OfflineNotice.tsx:10-17):**
```typescript
export const OfflineNotice = () => {
  const isConnected = useNetwork();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  if (isConnected) {
    return null;
  }
  // ...render banner
```
Adapt for Phase 6:
- Replace `useNetwork()` with `const { user } = useAuth();`
- Replace `if (isConnected) return null;` with `if (!state || state === 'active') return null;`

**Absolute-positioned container pattern (copy from OfflineNotice.tsx:20, 27-37):**
```typescript
<View style={[styles.container, { paddingTop: insets.top, height: 44 + insets.top }]}>
// styles.container:
container: {
  backgroundColor: '#b52424',
  width: width,                     // from Dimensions.get('window')
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'absolute',
  top: 0,
  zIndex: 9999,
},
```
Adapt for Phase 6 per UI-SPEC §Component 1:
- `zIndex: 9998` (OfflineNotice stays on top at 9999)
- `backgroundColor: palette.bg` instead of hardcoded `#b52424` — read from `COLORS.moderation[paletteKey].bg`
- Drop fixed `height`; replace with padding-driven auto-height
- `paddingTop: insets.top + SIZES.spacingMd`, `paddingBottom: SIZES.spacingMd`, `paddingLeft: SIZES.spacingMd + 4` (4 px for accent bar), `paddingRight: SIZES.spacingMd`

**Left-accent bar + tinted bg pattern — copy from AdminUserDetailScreen.tsx:344 + :510-519:**
```typescript
// Component usage:
<View style={[styles.historyCard, { borderLeftColor: palette.border }]}>

// Style definition (AdminUserDetailScreen.tsx:510-519):
historyCard: {
  backgroundColor: COLORS.cardBackground,
  marginHorizontal: SIZES.spacingMd,
  padding: SIZES.spacingMd,
  borderRadius: SIZES.radiusMd,
  borderLeftWidth: 4,
  borderWidth: 1,
  borderColor: COLORS.border,
  gap: SIZES.spacingXs,
},
```

Banner variation (per UI-SPEC §Component 1): no border-radius (full-bleed top banner), no horizontal margin, accent bar implemented as an absolute-positioned 4-px-wide `<View>` at `{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: palette.border }` rather than a `borderLeftWidth` (so it cleanly extends into the insets.top region).

**Reason-chip pattern — copy from AdminUserDetailScreen.tsx:357-362 + :529-537:**
```typescript
// Usage (AdminUserDetailScreen.tsx:357-362):
{item.reasonCategory && (
  <View style={styles.reasonChip}>
    <Text style={styles.reasonChipText}>
      {T[`reason${capitalize(item.reasonCategory)}`] ?? item.reasonCategory}
    </Text>
  </View>
)}

// Styles (AdminUserDetailScreen.tsx:529-537):
reasonChip: {
  alignSelf: 'flex-start',
  paddingHorizontal: SIZES.spacingSm,
  paddingVertical: 2,
  borderRadius: SIZES.radiusPill,
  backgroundColor: 'rgba(156, 163, 175, 0.15)',
  marginTop: SIZES.spacingXs,
},
reasonChipText: { ...TYPOGRAPHY.body, color: COLORS.textTertiaryStrong },
```
Reuse the chip style directly; the banner's line 1 renders severity icon + title + this chip.

**Severity-palette lookup pattern — copy from SeverityBadge.tsx:12-34:**
```typescript
// src/components/moderation/SeverityBadge.tsx:12-17
const STATE_TO_PALETTE_KEY: Record<ModerationState, keyof typeof COLORS.moderation> = {
  active: 'active',
  feature_limited: 'featureLimited',
  blocked_with_review: 'blockedReview',
  permanently_banned: 'permaBanned',
};

// Usage (:31-32):
const paletteKey = STATE_TO_PALETTE_KEY[state];
const palette = COLORS.moderation[paletteKey];
```
This is the exact lookup the banner MUST use so admin and affected-user surfaces read identical colors (Phase 5 LEARNINGS lesson: "Severity palette as single source of truth").

**Mailto + catch-fallback pattern — copy from CarDetailsScreen.tsx:220-231:**
```typescript
// src/screens/CarDetailsScreen.tsx:220-231
// Avoid canOpenURL - it returns false on some Android devices even when WhatsApp is installed,
// causing wrong fallback to tel: (phone dialer). Try opening WhatsApp directly instead.
Linking.openURL(whatsappDeepLink).catch(() => {
  // Fallback to wa.me - works in browser and opens WhatsApp when installed
  Linking.openURL(whatsappWebUrl).catch((err) => {
    console.error('Failed to open WhatsApp', err);
    Alert.alert(
      'WhatsApp',
      'Could not open WhatsApp. Please ensure it is installed or try again later.'
    );
  });
});
```
Phase 6 adaptation (per UI-SPEC §Appeal CTA behavior):
```typescript
const url = `mailto:support@carexmarket.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
Linking.openURL(url).catch(() => {
  Alert.alert(
    t.appealNoMailTitle,
    t.appealNoMailBody.replace('{uid}', user.localId),
    [{ text: t.appealOk, style: 'default' }]
  );
});
```
- **Single-level catch** (no second-level URL attempt — mailto has no analogue to wa.me fallback)
- **No `canOpenURL` call** — grep-verified zero callers repo-wide; never use

**LayoutAnimation expand pattern — copy from RESEARCH §Code Examples:**
```typescript
const toggleExpand = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setExpanded(prev => !prev);
};
```
- `configureNext` MUST be called immediately before `setExpanded` (Pitfall 2 — no async between them)
- Android enable line lives in App.tsx (see App.tsx patch below), not inside the component

**Focus-aware collapse — from RESEARCH §Pattern 3 (VERIFIED against reactnavigation.org):**
```typescript
useFocusEffect(
  useCallback(() => {
    return () => setExpanded(false); // cleanup fires on blur + unmount
  }, [])
);
```
- Per Pitfall 3: native-stack blur fires AFTER next screen inits; "stays expanded for a flash on nav" is acceptable

**Icon mapping table — pick from UI-SPEC §Color:**
```typescript
const SEVERITY_ICON = {
  feature_limited: AlertTriangle,     // already imported in ModerationActionModal.tsx:7
  blocked_with_review: ShieldAlert,
  permanently_banned: Ban,
} as const;
```

**Reason-category localization helper — copy pattern from AdminUserDetailScreen.tsx:360:**
The admin-screen helper uses `T[`reason${capitalize(cat)}`]`. RESEARCH §Code Examples uses an explicit switch. Either works; the explicit switch is preferable for the banner because it's type-narrower:
```typescript
function localizedReasonLabel(cat: string | null | undefined, t: any): string {
  switch (cat) {
    case 'spam':              return t.reasonSpam;
    case 'policy_violation':  return t.reasonPolicyViolation;
    case 'fraud':             return t.reasonFraud;
    case 'other':
    default:                  return t.reasonOther;
  }
}
```
Existing `reasonSpam / reasonPolicyViolation / reasonFraud / reasonOther` keys already live in `translations.ts` (Phase 5) — no new translation work for reason labels.

**testID manifest (per UI-SPEC §testID Manifest):**
- Banner root: `user-status-banner`
- Note expand area: `user-status-banner-note`
- Appeal CTA: `user-status-banner-appeal`
- Severity icon: `user-status-banner-icon-{severity}` (3 testIDs)

**CRITICAL pitfall to guard against (RESEARCH §Pitfall 11):** use `user.moderationStatus.setAt` (confirmed at `ModerationService.ts:118`), NOT `user.moderationStatus.updatedAt` (CONTEXT D-07 has a stale reference). The mailto body's `Suspended:` line reads `setAt`.

---

### `src/components/moderation/FeatureGateOverlay.tsx` (NEW — presentational, centered card over dim layer)

**Primary analog:** `src/components/moderation/EmptyState.tsx` (whole file, 77 lines) — for the icon + title + body + optional action visual rhythm. **Do NOT reuse as the inner card** (UI-SPEC §Component 2 explicit rejection — `EmptyState` uses `flex: 1` for empty-list stretching; the overlay needs a centered fixed-width card).

**Imports pattern — copy from EmptyState.tsx:1-4 and extend:**
```typescript
// src/components/moderation/EmptyState.tsx:1-4
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
```
Phase 6 additions:
```typescript
import { AlertTriangle, ShieldAlert, Ban } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
```

**Card visual rhythm — copy from EmptyState.tsx:19-38:**
```typescript
// src/components/moderation/EmptyState.tsx:19-38
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, body, action }) => {
  return (
    <View style={styles.container}>
      <Icon size={40} color={COLORS.textTertiary} />
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
```
Phase 6 deltas:
- Icon size stays at 40px (EmptyState.tsx:22)
- Icon color becomes `palette.fg` (severity-colored), not `COLORS.textTertiary`
- Replace `{ icon, title, body, action }` props with `{ capability }`; look up title/body internally via `t[`gate${CapabilityCapitalized}${SeverityCapitalized}Title`]` + `...Body` (per UI-SPEC §Copywriting key convention)
- Wrap the card in a dim layer (see dim-layer pattern below)

**Action-button style — copy from EmptyState.tsx:61-75:**
```typescript
// src/components/moderation/EmptyState.tsx:61-75
actionButton: {
  marginTop: SIZES.spacingLg,
  minHeight: SIZES.minTapTarget,
  paddingHorizontal: SIZES.spacingLg,
  paddingVertical: SIZES.spacingSm,
  borderRadius: SIZES.radiusMd,
  borderWidth: 1,
  borderColor: COLORS.accent,
  alignItems: 'center',
  justifyContent: 'center',
},
actionLabel: {
  ...TYPOGRAPHY.bodyStrong,
  color: COLORS.accent,
},
```
Reuse verbatim for the "Restore profile" CTA rendered only on `feature_limited` severity (per UI-SPEC §Component 2 card content #4). For `blocked_with_review` / `permanently_banned`, the overlay has NO CTA (banner owns the appeal CTA — D-06).

**Dim-layer pattern — copy from ModerationActionModal.tsx:422:**
```typescript
// src/components/moderation/ModerationActionModal.tsx:422
overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
```
Phase 6 variation (per UI-SPEC §Color):
- `backgroundColor: 'rgba(15, 17, 21, 0.7)'` — theme-derived from `COLORS.background` = `#0F1115`
- `justifyContent: 'center'` instead of `'flex-end'` (centered card, not bottom sheet)
- Use `StyleSheet.absoluteFill` for the dim layer (covers the full gated region including parent padding)

**Card surround (left-accent echo — same family as banner + HistoryCard):**
Card style per UI-SPEC §Component 2:
```typescript
card: {
  maxWidth: 340,
  width: '100%',
  backgroundColor: COLORS.cardBackground,     // echo ModerationActionModal.tsx:424
  borderRadius: SIZES.radiusMd,
  padding: SIZES.spacingLg,
  gap: SIZES.spacingSm,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderLeftWidth: 4,                         // echo historyCard (AdminUserDetailScreen.tsx:515)
  borderLeftColor: palette.border,            // severity-aware
  // Shadow (convention from existing modals):
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 8,
},
```

**testID manifest:**
- Dim layer: `feature-gate-overlay-dim`
- Card: `feature-gate-overlay-card`
- CTA (when present): `feature-gate-overlay-cta`

---

### `src/components/moderation/GatedScreenWrapper.tsx` (NEW — wrapper with predicate + sibling overlay)

**Primary analog:** `src/components/OfflineNotice.tsx:10-25` (context read + early-return shape). No exact wrapper analog exists; combines OfflineNotice's predicate pattern with a new children-vs-overlay structure.

**Imports:**
```typescript
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { FeatureGateOverlay } from './FeatureGateOverlay';
```

**Core pattern (from RESEARCH §Code Examples GatedScreenWrapper + Pitfall 6 sentinel fix — full source):**
```typescript
export type CapabilityKey = 'create_listing' | 'create_order' | 'apply_as_provider' | 'contact_seller';

// Frontend alias: apply_as_provider resolves to EITHER backend key (RESEARCH §Capability Contract Verification Path 1).
const CAPABILITY_ALIASES: Record<CapabilityKey, string[]> = {
  create_listing:    ['create_listing'],
  create_order:      ['create_order'],
  contact_seller:    ['contact_seller'],
  apply_as_provider: ['request_broker_role', 'request_logistics_role'],
};

interface Props {
  capability: CapabilityKey;
  children: React.ReactNode;
}

export const GatedScreenWrapper: React.FC<Props> = ({ capability, children }) => {
  const { user } = useAuth();
  const state = user?.moderationStatus?.state ?? 'active';
  const restricted: string[] = user?.moderationStatus?.restrictedFeatures ?? [];

  const backendKeys = CAPABILITY_ALIASES[capability];
  const sentinelGated = restricted.includes('all_writes');       // Pitfall 6 — blocked_with_review + permanently_banned
  const keyGated = backendKeys.some(k => restricted.includes(k)); // feature_limited — specific capabilities
  const isGated = state !== 'active' && (sentinelGated || keyGated);

  if (!isGated) return <>{children}</>;

  return (
    <View style={{ flex: 1 }} testID={`gated-screen-wrapper-${capability}`}>
      <View style={{ flex: 1 }} pointerEvents="none">{children}</View>
      <FeatureGateOverlay capability={capability} />
    </View>
  );
};
```

**CRITICAL correction over UI-SPEC:** UI-SPEC §Component 3's implementation sketch uses only `restricted.includes(capability)` — MISSING the `'all_writes'` sentinel path. RESEARCH §Pitfall 6 documents the bug. Planner MUST use the combined predicate above.

**Alias predicate (UI-SPEC vs Backend contract mismatch):** `apply_as_provider` is a frontend-only logical capability. Backend `STATUS_POLICY.feature_limited.capabilities.blocked` has 7 real keys (`create_listing`, `create_order`, `contact_seller`, `request_seller_role`, `request_broker_role`, `request_logistics_role`, `update_profile`); `apply_as_provider` is NOT among them. Alias resolves to `request_broker_role ∪ request_logistics_role` (RESEARCH §Capability Contract Verification).

---

### `App.tsx` (MODIFIED — mount banner + Android LayoutAnimation enable)

**Analog:** self (line 86). Single-site diff.

**Mount-point pattern (existing at App.tsx:85-86):**
```typescript
<NavigationContainer linking={linking}>
  <OfflineNotice />
```
**Phase 6 diff (per UI-SPEC §App.tsx Integration):**
```typescript
<NavigationContainer linking={linking}>
  <UserStatusBanner />   {/* NEW — mount BEFORE OfflineNotice; zIndex 9998 vs 9999 so OfflineNotice stays on top */}
  <OfflineNotice />
```

**Android LayoutAnimation enable (module top-level, before `function App()`):**
```typescript
// Add near the top of App.tsx (after imports):
import { Platform, UIManager } from 'react-native';
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
```
Per RESEARCH §Pitfall 1: on new architecture this is a silent no-op; on old arch (current CarEx baseline) it's required. Safe to keep unconditionally.

Provider-stack dependency check (already verified in UI-SPEC §App.tsx Integration):
- `AuthProvider` wraps `NavigationContainer` (App.tsx:80 wraps :85) ✓
- `LanguageProvider` wraps `NavigationContainer` (App.tsx:84 wraps :85) ✓
- `SafeAreaProvider` wraps everything (App.tsx:79) ✓
- `useFocusEffect` available because banner mounts INSIDE `NavigationContainer` ✓

No provider order changes.

---

### `src/screens/SellCarScreen.tsx` (MODIFIED — wrap root children)

**Analog:** self (line 496-504).

**Existing top-level shape:**
```typescript
// src/screens/SellCarScreen.tsx:496-504
return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{isEditMode ? t.editListing : t.sellHeader}</Text>
      <View style={{ width: 40 }} />
    </View>
    // ... rest of screen
```

**Phase 6 diff:** insert `<GatedScreenWrapper capability="create_listing">` as the first child of `<SafeAreaView>`, wrapping all existing JSX up to the closing `</SafeAreaView>`:
```typescript
return (
  <SafeAreaView style={styles.container}>
    <GatedScreenWrapper capability="create_listing">
      <View style={styles.header}>
        {/* ...existing body unchanged... */}
      </View>
      {/* ...rest of screen unchanged... */}
    </GatedScreenWrapper>
  </SafeAreaView>
);
```
- 1 import + 2 JSX lines (open + close tags) — minimal diff per UI-SPEC §Component 3 rationale
- Leave the existing `<SafeAreaView>` OUTSIDE the wrapper so safe-area insets apply identically whether gated or not

Watch out for RESEARCH §Open Question 1: `pointerEvents="none"` on a `<View>` that contains a `<ScrollView>` needs a manual UAT check on Android — the scroll-gesture system may bypass the pointerEvents cascade.

---

### `src/screens/ServiceCartScreen.tsx` (MODIFIED — wrap root)

**Analog:** self (lines 25-60 for component, top-level `<SafeAreaView>` wraps the screen).

**Diff pattern identical to SellCarScreen.tsx:** `<GatedScreenWrapper capability="create_order">{...existing body...}</GatedScreenWrapper>` inside the top-level `<SafeAreaView>`.

Translation-key coverage: `gateCreateOrderFeatureLimitedTitle` + `Body`, `gateCreateOrderBlockedTitle` + `Body`, `gateCreateOrderBannedTitle` + `Body` (per UI-SPEC §Copywriting Contract matrix).

---

### `src/screens/ServiceApplicationScreen.tsx` (MODIFIED — wrap root; FRONTEND ALIAS capability)

**Analog:** self (lines 32-80). This screen dispatches based on `route.params.type` which is `'broker' | 'logistics'` — the frontend-alias approach keeps a single capability key while the wrapper's predicate covers both backend keys (`request_broker_role` ∪ `request_logistics_role`).

**Diff pattern:** `<GatedScreenWrapper capability="apply_as_provider">{...existing body...}</GatedScreenWrapper>` inside the top-level `<SafeAreaView>`.

**Do NOT** branch on `route.params.type` when choosing the capability — the alias predicate in `GatedScreenWrapper` is sufficient. Per UI-SPEC §Copywriting Contract, the translation keys are `gateApplyProvider{FeatureLimited|Blocked|Banned}{Title,Body}` — single copy set, not per-role.

Translation-key coverage: 6 keys (3 severities × 2 fields) × 2 languages = 12 entries.

---

### `src/screens/CarDetailsScreen.tsx` (MODIFIED — inline conditional on TWO CTAs at lines 683-691)

**Analog:** self (lines 683-691 — the Telegram + WhatsApp TouchableOpacity pair inside `styles.contactButtonsRow`).

**Decision (RESEARCH §Open Question 3):** inline conditional render, NOT a new `GatedButtonGate` component. Rationale: single use site; premature componentization. Extract only if a second surface (e.g., "Book now" on ServiceDetails) needs the same treatment.

**Existing JSX to modify (lines 681-692):**
```typescript
// src/screens/CarDetailsScreen.tsx:681-692
<View style={styles.contactButtonsRow}>
  {car.telegramUsername && (
    <TouchableOpacity style={[styles.contactButton, styles.telegramButton]} onPress={handleTelegram}>
      <Send size={20} color="#FFF" />
      <Text style={[styles.contactButtonText, { color: '#FFF' }]}>Telegram</Text>
    </TouchableOpacity>
  )}
  <TouchableOpacity style={[styles.contactButton, styles.whatsappButton, car.telegramUsername ? { flex: 1, marginLeft: 2 } : { width: '100%' }]} onPress={handleCallSeller}>
    <MessageCircle size={20} color="#FFF" />
    <Text style={[styles.contactButtonText, { color: '#FFF' }]}>{t.whatsapp}</Text>
  </TouchableOpacity>
</View>
```

**Phase 6 adaptation (per UI-SPEC §Component 4 — targeted CTA replacement):**
1. Compute `const isContactGated = state !== 'active' && (restricted.includes('all_writes') || restricted.includes('contact_seller'));` inline using `useAuth()` (or extract into a tiny local helper).
2. When `isContactGated`, replace each `TouchableOpacity`'s onPress with a modal opener (`setContactGateVisible(true)`) and apply a DIM-DISABLED visual: `style={[existing, { opacity: 0.4 }]}`, `pointerEvents="none"` equivalent (React Native's TouchableOpacity accepts `disabled` — use that instead of pointerEvents on the button element itself).
3. Render a separate `<Modal animationType="fade">` that shows the `FeatureGateOverlay capability="contact_seller"` centered inside it. See ModerationActionModal.tsx:134 for the RN `<Modal>` pattern:
```typescript
// src/components/moderation/ModerationActionModal.tsx:134-141
<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + SIZES.spacingSm }]} onPress={() => {}}>
        {/* ...sheet body... */}
```
Phase 6 variant: `animationType="fade"`, no KeyboardAvoidingView (overlay has no text input), no bottom-sheet shape (centered card).

Alternative payment-warning Modal at CarDetailsScreen.tsx:701-706 is a closer shape fit — fade animation, centered card, dismiss on outside tap:
```typescript
// src/screens/CarDetailsScreen.tsx:701-706
<Modal
  visible={paymentWarningVisible}
  transparent
  animationType="fade"
  statusBarTranslucent
  onRequestClose={() => setPaymentWarningVisible(false)}>
```
Copy this Modal shape; substitute `FeatureGateOverlay` as the card body.

Translation-key coverage: `gateContactSeller{FeatureLimited|Blocked|Banned}{Title,Body}` — 6 keys × 2 languages.

---

### `src/constants/translations.ts` (MODIFIED — add 32 new keys × 2 languages = 64 entries)

**Analog:** self. Existing structure:
- RU section starts at line 2 (`RU: {`) — 1-530 range approximate
- EN section starts at line 533 (`EN: {`) — 534-1064 range
- Closes at line 1064

**Pattern — parallel object literals with identical keys:** every key added to `RU` MUST appear in `EN`. QUAL-01 (translation-parity.test.ts) enforces this mechanically.

**Phase 5 precedent for how to add a moderation block:** see lines 1055-1063 (Phase 5's "Capability preview" sub-block). Insert Phase 6 keys at the same structural level.

**32 new keys per UI-SPEC §Copywriting Contract (REVISED count after Clipboard Decision):**
```
# Banner severity
bannerTitle_feature_limited
bannerTitle_blocked_with_review
bannerTitle_permanently_banned
appealCta

# Gate overlay copy — 4 capabilities × 3 severities × 2 fields = 24 keys
gateCreateListingFeatureLimitedTitle / Body
gateCreateListingBlockedTitle / Body
gateCreateListingBannedTitle / Body
gateCreateOrderFeatureLimitedTitle / Body
gateCreateOrderBlockedTitle / Body
gateCreateOrderBannedTitle / Body
gateApplyProviderFeatureLimitedTitle / Body
gateApplyProviderBlockedTitle / Body
gateApplyProviderBannedTitle / Body
gateContactSellerFeatureLimitedTitle / Body
gateContactSellerBlockedTitle / Body
gateContactSellerBannedTitle / Body

# Alert + expand/collapse + restore CTA + placeholder
appealNoMailTitle
appealNoMailBody             # contains "{uid}" token replaced at render time
appealOk
expandNote
collapseNote
restoreProfile
appealPlaceholder            # "[Your message here]" / "[Напишите ваше сообщение здесь]"
```
Exact RU + EN strings are locked in UI-SPEC §Copywriting Contract and §Clipboard Decision table. Implementer copies verbatim.

Reason-category labels (`reasonSpam` / `reasonPolicyViolation` / `reasonFraud` / `reasonOther`) already exist from Phase 5 — DO NOT re-add.

---

### `__tests__/translation-parity.test.ts` (NEW — jest set-equality)

**Primary analog:** no existing set-equality test in repo. Closest shape analogs:
- `__tests__/moderation.e2e.integration.test.tsx` (whole-file jest harness with mocks; too heavy for this)
- `src/components/moderation/__tests__/EmptyState.test.tsx:1-48` (minimal test file shape)

**Imports pattern — copy from EmptyState.test.tsx:1-5:**
```typescript
// src/components/moderation/__tests__/EmptyState.test.tsx:1-5 (adapt)
import React from 'react';
// ...
```
Static test needs no React; just:
```typescript
import { TRANSLATIONS } from '../src/constants/translations';
```

**Core pattern — PROPOSED from RESEARCH §Code Examples (no in-repo analog to copy):**
```typescript
describe('QUAL-01: translation parity', () => {
  const ru = Object.keys(TRANSLATIONS.RU).sort();
  const en = Object.keys(TRANSLATIONS.EN).sort();

  test('RU and EN key sets are identical', () => {
    const onlyInRu = ru.filter(k => !en.includes(k));
    const onlyInEn = en.filter(k => !ru.includes(k));
    expect({ onlyInRu, onlyInEn }).toEqual({ onlyInRu: [], onlyInEn: [] });
  });

  test('every value is a non-empty string', () => {
    for (const lang of ['RU', 'EN'] as const) {
      for (const [key, val] of Object.entries(TRANSLATIONS[lang])) {
        expect(typeof val).toBe('string');
        expect((val as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('no TODO/FIXME/TRANSLATE placeholders', () => {
    for (const lang of ['RU', 'EN'] as const) {
      for (const [key, val] of Object.entries(TRANSLATIONS[lang])) {
        expect(val).not.toMatch(/^(TODO|FIXME|TRANSLATE)[:\s]/i);
      }
    }
  });
});
```

**Describe-naming convention — copy from `__tests__/moderation.e2e.integration.test.tsx:17-24` (ROADMAP criterion tagging):**
```typescript
// __tests__/moderation.e2e.integration.test.tsx lines 17-24 establish the "ROADMAP Criterion" grep sentinel.
// For this test use literal "QUAL-01" in the describe name (already shown above) — grep-stable tag for verification.
```

**Pitfall 8 (RESEARCH):** do NOT assert `expect(ru.length).toEqual(487)` — the pre-Phase-6 baseline is actually 459, not 455 as UI-SPEC claims. Use set-equality (`expect(ru).toEqual(en)`) which is robust to any key count.

---

### `scripts/audit-moderation-literals.sh` (NEW — optional literal scanner)

**Primary analog:** no grep/audit script exists in `scripts/` (the only existing script is `generate-icons.js`). Closest shape is `build-ios-release.sh:1-38` (bash header + `set -e` pattern).

**Imports / header pattern — copy from build-ios-release.sh:1-10:**
```bash
#!/bin/bash

# CarEx — [Purpose description]
# [Detailed comment]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```
Phase 6 variant (from RESEARCH §Code Examples literal scanner):
```bash
#!/usr/bin/env bash
# File: scripts/audit-moderation-literals.sh (NEW)
# Purpose: scan new moderation files for user-facing Text literals not wrapped in t.*
# Exit 0 if clean; exit 1 with offending lines if any found.

set -euo pipefail
```
Full script body from RESEARCH §Code Examples "Literal-string scanner" — copy verbatim. Files to scan:
```
src/components/moderation/UserStatusBanner.tsx
src/components/moderation/FeatureGateOverlay.tsx
src/components/moderation/GatedScreenWrapper.tsx
```

**Alternative (Claude's Discretion — RESEARCH §QUAL-01 discretion):** implement as a jest test file instead (`__tests__/moderation-literals.test.ts`) that reads the three files via `fs.readFileSync` and regex-scans. Planner picks bash vs jest based on which harness is preferred; RESEARCH recommends jest-based for CI-watch-mode friendliness.

---

### `backend-services/carEx-services/scripts/load-test/admin-search.k6.js` (NEW — CROSS-REPO)

**Analog:** **NO in-repo analog.** This file lives in the sister backend repository. Plan must have `autonomous: false` frontmatter per CONTEXT D-QUAL-02 + Phase 5 D-16 precedent.

**Full source — copy verbatim from RESEARCH §Code Examples "k6 load-test harness":** skeleton with `setup()` for one-time Firebase idToken mint + `thresholds: { http_req_duration: ['p(95)<200'] }` + Bearer header injection. Planner must not re-derive; RESEARCH has grep-verified the pattern.

**CRITICAL pitfalls (RESEARCH §Pitfall 9 + §Pitfall 10):**
- Mint idToken ONCE in `setup()`; NOT per-iteration (rate-limits Firebase; invalidates P95)
- `explain('executionStats')` not default `queryPlanner` for index verification

**Execution prerequisite:** backend Phase 5 plans `05-0a` + `05-0b` must land first (cross-repo blocker tracked in STATE.md). Planning writes the harness; execution waits.

---

### `backend-services/carEx-services/scripts/seed-moderation-load.js` (NEW — CROSS-REPO)

**Analog:** **NO in-repo analog.** Sister to Phase 5 backend 05-0a/0b. Full source — copy verbatim from RESEARCH §Code Examples "Seed script for 10k synthetic users". Uses `mongoose.insertMany({ ordered: false })` in batches of 1000 across 10k total users, cycling across the 4 severity states.

Accompanying inline `verify-indexes.sh` — copy verbatim from RESEARCH §Code Examples "Mongo explain() verification".

---

### `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` (NEW — artifact doc)

**Analog:** **NO existing SECURITY.md in repo** (grep confirmed 0 hits under `.planning/phases/**/SECURITY.md` or `*security-review.md`). Closest structural relatives: Phase-level `VERIFICATION.md` / `VALIDATION.md` files (e.g., `05-VERIFICATION.md`) — informal precedent only.

**Structure — copy from RESEARCH §Code Examples "Security review artifact template"** — 6 sections, each with:
- **Verification:** grep command or test-suite pointer
- **Evidence:** captured CLI output or file references
- **Verdict:** ✅ PASS / ❌ FAIL

**Section mapping (RESEARCH §Open Question 2 resolution):** ROADMAP §Phase 6 Success #6 actually lists 5 sub-criteria (a)-(e). Create 5 sections matching those exactly, plus a 6th "Additional hardening notes" section for incidental findings. Do NOT invent a 6th criterion.

The 5 locked sections (verbatim from ROADMAP §Phase 6 Success #6):
1. `verifyIdToken` on every admin route
2. No `callerUid` body param trusted for authorization
3. `suspend` + `confirm-booking` mutations are transactional
4. `ModerationAction` collection rejects updates and deletes at application layer
5. No new hardcoded secrets introduced

---

## Shared Patterns (cross-cutting)

### Severity palette (single source of truth)

**Source:** `src/constants/theme.ts:19-25`
```typescript
// src/constants/theme.ts:19-25
moderation: {
  active: { bg: 'rgba(34, 197, 94, 0.15)', fg: '#4ADE80', border: '#4ADE80' },
  featureLimited: { bg: 'rgba(245, 158, 11, 0.15)', fg: '#FBBF24', border: '#FBBF24' },
  blockedReview: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#F87171', border: '#F87171' },
  permaBanned: { bg: 'rgba(156, 163, 175, 0.15)', fg: '#9CA3AF', border: '#6B7280' },
},
```
**Apply to:** `UserStatusBanner.tsx`, `FeatureGateOverlay.tsx`, and the CarDetails `FeatureGateOverlay` modal body.
**Do NOT** define new severity colors in Phase 6. Zero new hex values added to `theme.ts`. Both `bg` (tinted 15%) + `fg` (text/icon) + `border` (accent bar) are already provided.

### State → palette key mapping (used by every moderation surface)

**Source:** `src/components/moderation/SeverityBadge.tsx:12-17`
```typescript
const STATE_TO_PALETTE_KEY: Record<ModerationState, keyof typeof COLORS.moderation> = {
  active: 'active',
  feature_limited: 'featureLimited',
  blocked_with_review: 'blockedReview',
  permanently_banned: 'permaBanned',
};
```
**Apply to:** `UserStatusBanner.tsx`, `FeatureGateOverlay.tsx` — copy this exact object (or import from a shared util if extraction is obvious; planner decides). Do not rename the palette keys.

### Linking.openURL with catch-fallback (NO canOpenURL)

**Source:** `src/screens/CarDetailsScreen.tsx:220-231`
**Apply to:** `UserStatusBanner.tsx` appeal CTA handler.
**Rule:** never call `Linking.canOpenURL` — grep-verified 0 callers repo-wide. Rationale at CarDetailsScreen.tsx:220-221 comment ("returns false on some Android devices even when the target app is installed"). Phase 6 mailto appeal MUST follow this convention.

### Context consumption pattern

**Source:** every screen/component in the moderation family
```typescript
const { user } = useAuth();
const { t } = useLanguage();
const insets = useSafeAreaInsets();
```
**Apply to:** `UserStatusBanner.tsx` (all three), `FeatureGateOverlay.tsx` (user + t), `GatedScreenWrapper.tsx` (user only).
Refer to `OfflineNotice.tsx:11-13` for the 3-hook pattern; `SeverityBadge.tsx:29-30` for the t-only pattern.

### testID kebab-case convention

**Source:** established across Phase 5 components (`SeverityBadge`, `ModerationActionModal`, `QuickActionSheet`) + UI-SPEC §testID Manifest.
**Convention:** `{component-kebab-name}-{purpose-kebab-name}` — e.g., `user-status-banner-note`, `feature-gate-overlay-card`, `gated-screen-wrapper-{capability}`.

### Accessibility pattern (alert live-region)

**Source:** `src/components/moderation/SeverityBadge.tsx:39-41` + UI-SPEC §Accessibility Summary
```typescript
// SeverityBadge.tsx:38-44
<View
  style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}
  accessible
  accessibilityRole="text"
  accessibilityLabel={label}
>
```
**Apply to:** Banner root uses `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`; overlay card uses `accessibilityRole="alert"` + `accessibilityViewIsModal={true}` (iOS). See UI-SPEC §Accessibility Summary for the full label format.

---

## No Analog Found

Files with no close match in the codebase (planner uses RESEARCH.md patterns directly):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `backend-services/carEx-services/scripts/load-test/admin-search.k6.js` | backend k6 harness | streaming load | Cross-repo; no k6 script exists in-repo. Use RESEARCH §Code Examples verbatim. |
| `backend-services/carEx-services/scripts/seed-moderation-load.js` | backend seed script | batch insert | Cross-repo; RESEARCH provides full skeleton. |
| `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` | doc (artifact) | none | No SECURITY.md exists in-repo; use RESEARCH §Code Examples "Security review artifact template" + RESEARCH §Open Question 2 for the 5-section structure. |
| `__tests__/translation-parity.test.ts` | test (static set-equality) | none | Partial analog only (`EmptyState.test.tsx` shape). PROPOSED pattern from RESEARCH §Code Examples is the source of truth. |
| `scripts/audit-moderation-literals.sh` | script (grep scanner) | none | No scanner scripts in `scripts/` (only `generate-icons.js`). RESEARCH §Code Examples provides the full script. |

---

## Metadata

**Analog search scope:**
- `/Users/beckmaldinVL/development/mobileApps/carEx/src/components/**` — all 27 component files
- `/Users/beckmaldinVL/development/mobileApps/carEx/src/screens/**` — targeted reads on 4 gated screens + AdminUserDetailScreen + CarDetailsScreen
- `/Users/beckmaldinVL/development/mobileApps/carEx/App.tsx` (full)
- `/Users/beckmaldinVL/development/mobileApps/carEx/src/constants/{theme,translations}.ts`
- `/Users/beckmaldinVL/development/mobileApps/carEx/src/services/moderation/ModerationService.ts:108-122` (moderationStatus type shape)
- `/Users/beckmaldinVL/development/mobileApps/carEx/__tests__/**` — moderation.e2e + AppStateRefresh + App.test
- `/Users/beckmaldinVL/development/mobileApps/carEx/scripts/**` — only `generate-icons.js` (no test/audit scripts)
- `/Users/beckmaldinVL/development/mobileApps/carEx/jest.config.js` (preset confirmed)
- `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/**/*SECURITY*` (grep — zero hits; confirmed no prior SECURITY.md)

**Files with line-number-precise pattern excerpts:**
- `OfflineNotice.tsx:1-46` (whole file)
- `EmptyState.tsx:1-77` (whole file)
- `AdminUserDetailScreen.tsx:344-366, 510-537` (historyCard + reasonChip)
- `SeverityBadge.tsx:12-34, 38-44` (palette lookup + accessibility)
- `ModerationActionModal.tsx:134-141, 422-424` (Modal shape + overlay style)
- `CarDetailsScreen.tsx:220-231, 681-692, 701-706` (Linking catch-fallback + two CTAs + Modal fade)
- `SellCarScreen.tsx:496-504` (top-level SafeAreaView + header)
- `ServiceApplicationScreen.tsx:1-80` (broker/logistics dispatch + top-level)
- `ServiceCartScreen.tsx:1-60` (imports + top-level SafeAreaView)
- `App.tsx:76-127` (provider stack + NavigationContainer mount)
- `theme.ts:1-67` (whole file — palette + sizes + typography)
- `ModerationService.ts:108-122` (moderationStatus type with `setAt` field)
- `translations.ts:1-30, 533, 1055-1064` (RU start, EN start, Phase 5 tail)
- `EmptyState.test.tsx:1-48` (minimal test file shape)
- `build-ios-release.sh:1-38` (bash header pattern)

**Pattern extraction date:** 2026-04-19

---

## PATTERN MAPPING COMPLETE

**Phase:** 6 — Affected-User UX + Security Review
**Files classified:** 14
**Analogs found:** 12 / 14

### Coverage
- Files with exact/self analog: 8 (App.tsx, 4 screen modifications, translations.ts, plus UserStatusBanner mount pattern = OfflineNotice exact)
- Files with role-match analog: 4 (UserStatusBanner visual, FeatureGateOverlay, GatedScreenWrapper, translation-parity test, audit script)
- Files with no analog: 2 (cross-repo k6 + seed; SECURITY.md is a doc)

### Key Patterns Identified
1. **OfflineNotice is the canonical non-dismissable banner precedent** — UserStatusBanner copies its mount shape, context-read pattern, absolute-position/zIndex structure, and early-return-on-inactive-state idiom verbatim (differs only in zIndex 9998 vs 9999 and severity-driven colors).
2. **AdminUserDetailScreen's historyCard defines the cross-surface visual language** — left-accent + tinted bg + reason-chip is the established pattern Phase 5 paid for; Phase 6 Banner + FeatureGateOverlay echo it so admin and affected-user surfaces read as one visual system (CONTEXT D-01 specifics lock).
3. **Severity palette is the single source of truth in theme.ts** — Phase 6 adds ZERO new hex values; all visual severity differentiation routes through `COLORS.moderation.{active,featureLimited,blockedReview,permaBanned}.{bg,fg,border}` (Phase 5 05-LEARNINGS §Patterns).
4. **EmptyState provides the icon+title+body+CTA rhythm but is NOT reused as the overlay inner card** — `flex: 1` in EmptyState contradicts the centered-fixed-width overlay layout. FeatureGateOverlay is written from scratch with the same visual rhythm (40 px icon, labelStrong title, body at maxWidth 280).
5. **`Linking.openURL(url).catch(fallback)` without `canOpenURL` is locked project-wide convention** — grep-verified 0 canOpenURL callers; Banner mailto appeal MUST follow this pattern.
6. **The `apply_as_provider` frontend-alias + `all_writes` sentinel are two BUGS in UI-SPEC's GatedScreenWrapper sketch** — RESEARCH §Capability Contract Verification and §Pitfall 6 document both; PATTERNS.md's GatedScreenWrapper section corrects them at line-level precision for the planner to copy verbatim.

### File Created
`/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/06-affected-user-ux-security-review/06-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference analog patterns in 06-PLAN files with exact line numbers for every concrete excerpt.
