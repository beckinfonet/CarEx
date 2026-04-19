/**
 * Phase 6 Plan 06-04 — FeatureGateOverlay
 *
 * Centered card over a full-screen dim layer, rendered as a SIBLING of gated
 * screen content by GatedScreenWrapper (Plan 06-05). Purely presentational:
 * reads user.moderationStatus.state from AuthContext and renders a capability-
 * aware message + optional restore-profile CTA (only on feature_limited — the
 * banner owns the appeal CTA for blocked_with_review / permanently_banned per
 * D-06).
 *
 * Delivers AFF-04 overlay contract:
 *   - null render when state === 'active' OR user missing
 *   - dim layer at 70% opacity of COLORS.background (theme-derived)
 *   - card with 4px left-accent matching severity palette (echoes banner +
 *     HistoryCard left-accent pattern across moderation surfaces)
 *   - severity icon + title + body (copy lookup via
 *     t[`gate${CapPart}${SevPart}{Title|Body}`] — capability-key driven, D-05)
 *   - CTA rendered only on feature_limited severity
 *
 * Severity palette + icon maps copied verbatim from SeverityBadge.tsx /
 * UserStatusBanner.tsx — single source of truth for moderation colors.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  AlertTriangle,
  ShieldAlert,
  Ban,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';

// Capability key — frontend alias set. apply_as_provider is resolved to its
// backend-key pair (request_broker_role / request_logistics_role) inside
// GatedScreenWrapper; the overlay only needs the logical label for copy
// lookup.
export type CapabilityKey =
  | 'create_listing'
  | 'create_order'
  | 'apply_as_provider'
  | 'contact_seller';

type ModerationState =
  | 'active'
  | 'feature_limited'
  | 'blocked_with_review'
  | 'permanently_banned';

// State → palette-key map (copied verbatim from SeverityBadge.tsx:12-17 for
// cross-surface consistency with banner + history card).
const STATE_TO_PALETTE_KEY = {
  active: 'active',
  feature_limited: 'featureLimited',
  blocked_with_review: 'blockedReview',
  permanently_banned: 'permaBanned',
} as const;

// Severity icon picks (UI-SPEC §Color §Rationale for icon picks) — same map
// used by UserStatusBanner.tsx. Excludes 'active' since overlay returns null
// in that case.
const SEVERITY_ICON: Record<
  Exclude<keyof typeof STATE_TO_PALETTE_KEY, 'active'>,
  LucideIcon
> = {
  feature_limited: AlertTriangle,
  blocked_with_review: ShieldAlert,
  permanently_banned: Ban,
};

// Capability PascalCase key parts for copy lookup (plan §interfaces).
const CAPABILITY_TO_KEY_PART: Record<CapabilityKey, string> = {
  create_listing: 'CreateListing',
  create_order: 'CreateOrder',
  apply_as_provider: 'ApplyProvider',
  contact_seller: 'ContactSeller',
};

// Severity PascalCase key parts. Note the mismatch between state name
// (blocked_with_review, permanently_banned) and translation key part
// (Blocked, Banned) — captured here so assembly is locked at one place.
const SEVERITY_TO_KEY_PART = {
  feature_limited: 'FeatureLimited',
  blocked_with_review: 'Blocked',
  permanently_banned: 'Banned',
} as const;

interface Props {
  capability: CapabilityKey;
  testID?: string;
}

export const FeatureGateOverlay: React.FC<Props> = ({
  capability,
  // testID prop reserved for future use (dim layer + card + CTA have their
  // own fixed testIDs per UI-SPEC §testID Manifest).
  testID: _testID = 'feature-gate-overlay',
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Early-return guards — render nothing when:
  //   - user not signed in / not hydrated
  //   - moderationStatus not populated
  //   - state === 'active' (AFF-04 null-render contract)
  if (!user || !user.moderationStatus) {
    return null;
  }
  const state = user.moderationStatus.state as ModerationState | undefined;
  if (!state || state === 'active') {
    return null;
  }

  const paletteKey = STATE_TO_PALETTE_KEY[state];
  const palette = COLORS.moderation[paletteKey];
  const Icon = SEVERITY_ICON[state as keyof typeof SEVERITY_ICON];

  // Copy lookup — capability + severity assembly into translation key.
  // D-05: capability-key driven copy — all 4 capabilities × 3 severities
  // share the same lookup shape, no per-capability branching in source.
  const capPart = CAPABILITY_TO_KEY_PART[capability];
  const sevPart =
    SEVERITY_TO_KEY_PART[state as keyof typeof SEVERITY_TO_KEY_PART];
  const titleKey = `gate${capPart}${sevPart}Title`;
  const bodyKey = `gate${capPart}${sevPart}Body`;
  const title: string = (t as Record<string, string>)[titleKey] ?? '';
  const body: string = (t as Record<string, string>)[bodyKey] ?? '';

  // CTA visibility — only on feature_limited. blocked_with_review and
  // permanently_banned cede the action affordance to UserStatusBanner's
  // appeal CTA (D-06 complementary split — overlay says "what next", banner
  // says "how to contact support").
  const showCta = state === 'feature_limited';

  return (
    <View
      testID="feature-gate-overlay-dim"
      style={styles.dim}
      accessible={false}
      // box-none lets taps pass through the dim region itself. The gated
      // content underneath is made non-interactive by GatedScreenWrapper
      // setting pointerEvents="none" on its sibling subtree (T-06-03
      // mitigation). This component must NOT set pointerEvents="none" on
      // itself — that would disable the Restore CTA.
      pointerEvents="box-none"
    >
      <View style={styles.centerWrap}>
        <View
          testID="feature-gate-overlay-card"
          style={[styles.card, { borderLeftColor: palette.border }]}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${body}`}
          accessibilityViewIsModal={true}
        >
          <Icon size={40} color={palette.fg} />
          <Text
            style={[TYPOGRAPHY.labelStrong, styles.title]}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text style={[TYPOGRAPHY.body, styles.body]}>{body}</Text>
          {showCta ? (
            <TouchableOpacity
              testID="feature-gate-overlay-cta"
              style={styles.cta}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t.restoreProfile}
              onPress={() => {
                // Destination navigation left to a future integration plan.
                // The CTA is informational-only for Phase 6; Plan 06-05
                // wires the overlay into screens via GatedScreenWrapper
                // without threading navigation through this component.
              }}
            >
              <Text style={[TYPOGRAPHY.bodyStrong, styles.ctaLabel]}>
                {t.restoreProfile}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 17, 21, 0.7)',
    zIndex: 10,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZES.spacingLg,
  },
  card: {
    maxWidth: 340,
    width: '100%',
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.spacingLg,
    gap: SIZES.spacingSm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: SIZES.spacingSm,
  },
  body: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.spacingXs,
    maxWidth: 280,
  },
  cta: {
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
  ctaLabel: {
    color: COLORS.accent,
  },
});
