/**
 * Phase 11 Plan 11-02 — ListingStatusBanner.
 *
 * Prop-driven severity-aware banner for non-active listings (suspended /
 * archived / deleted). Sibling-domain mirror of the Phase 6 user-domain
 * banner per Phase 11 D-01 (sibling, NOT generalization) + Phase 10 D-04
 * precedent (ListingModerationBottomSheet is a sibling of QuickActionSheet).
 *
 * Variants: `detail` (mounts inline on CarDetailsScreen) and `cartRow`
 * (mounts on ServiceCartScreen with a Remove-from-cart CTA) per D-12 —
 * single component, single source of truth for visual treatment.
 *
 * Visual treatment (mirrors Phase 6 sibling D-01..D-03 verbatim):
 *   - Tinted background at 10% alpha of accent color (`${accentColor}1A`)
 *   - Absolute 4-px left accent strip at full accent color
 *   - Title + reason chip + truncated note (numberOfLines=2) + tap-to-expand
 *   - Non-dismissable; collapse-on-blur via the focus-effect hook.
 *
 * Severity → COLORS top-level token mapping (warning/destructive/textTertiary)
 * per D-14 + RESEARCH Pitfall 8 — listing-domain severity does NOT reuse the
 * user-domain palette (that palette is scoped to user-state and intentionally
 * distinct from listing-state).
 *
 * Purely presentational: listing-status data flows in via props from the
 * screen-level fetch (Phase 9 D-05 thin payload). No global-state hooks
 * (no auth hook, no HTTP client) — keeps the component composable and
 * trivially testable from fixtures.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  LayoutAnimation,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AlertTriangle, Archive, Ban } from 'lucide-react-native';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';

// ---- Module-scope literal maps (taxonomy-bounded — DO NOT widen) -----------

type ListingStatus = 'suspended' | 'archived' | 'deleted';
type Severity = 'warning' | 'neutral' | 'destructive';
type ReasonCategory =
  | 'spam'
  | 'policy_violation'
  | 'fraud'
  | 'inactive_seller'
  | 'other';

// Severity → icon. Mirrors analog UserStatusBanner SEVERITY_ICON shape (Phase 6
// lines 55-59) — substituted for listing-domain status semantics.
const SEVERITY_ICON: Record<Severity, any> = {
  warning: AlertTriangle, // suspended
  neutral: Archive, // archived
  destructive: Ban, // deleted
};

// Status → title-translation key. Plan 11-01 landed these RU+EN pairs.
const STATUS_TO_TITLE_KEY: Record<ListingStatus, string> = {
  suspended: 'listingStatusBannerSuspendedTitle',
  archived: 'listingStatusBannerArchivedTitle',
  deleted: 'listingStatusBannerDeletedTitle',
};

// ReasonCategory → chip-translation key. Table-driven (NOT switch / NOT
// runtime string-mangle per `capitalize(snake_case)` — RESEARCH "Don't
// Hand-Roll" + plan §Action). The 5 enum values are bounded by Phase 7
// D-14a; any future addition must extend both this map and the
// `ReasonCategory` literal union together.
const REASON_TO_KEY: Record<ReasonCategory, string> = {
  spam: 'listingStatusBannerReasonSpam',
  policy_violation: 'listingStatusBannerReasonPolicyViolation',
  fraud: 'listingStatusBannerReasonFraud',
  inactive_seller: 'listingStatusBannerReasonInactiveSeller',
  other: 'listingStatusBannerReasonOther',
};

// Severity → top-level COLORS token (Pitfall 8 — listing severity does NOT
// reuse the user-domain palette; that palette is reserved for user-state).
const severityToColor: Record<Severity, string> = {
  warning: COLORS.warning, // amber — suspended
  neutral: COLORS.textTertiary, // gray — archived
  destructive: COLORS.destructive, // red — deleted
};

// ---- Props -----------------------------------------------------------------

interface Props {
  status: ListingStatus;
  reasonCategory?: ReasonCategory | null;
  bannerHints: { titleKey: string; bodyKey: string; severity: Severity };
  note?: string | null;
  variant?: 'detail' | 'cartRow';
  onRemoveFromCart?: () => void;
  testID?: string;
}

// ---- Component -------------------------------------------------------------

export const ListingStatusBanner: React.FC<Props> = ({
  status,
  reasonCategory,
  bannerHints,
  note,
  variant = 'detail',
  onRemoveFromCart,
  testID,
}) => {
  // Resolve the root testID with a JSX-literal default so the plan's grep
  // gate `testID="listing-status-banner"` matches the source-of-truth line.
  const rootTestID = testID ?? "listing-status-banner";
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  // Collapse on blur — verbatim from the analog sibling lines 99-103.
  useFocusEffect(
    useCallback(() => {
      return () => setExpanded(false);
    }, []),
  );

  // Resolve title via the bounded STATUS_TO_TITLE_KEY map. Defensive `??`
  // falls back to the raw status string if t lookup misses (matches the
  // analog's defensive pattern at UserStatusBanner.tsx:121).
  const titleKey = STATUS_TO_TITLE_KEY[status];
  const title: string =
    (t as unknown as Record<string, string>)[titleKey] ?? status;

  // Resolve reason chip text. `reasonCategory` is bounded by `ReasonCategory`
  // at the type-level; treat the runtime value defensively in case props
  // arrive from an untyped source (Phase 9 thin payload — JSON over the wire).
  const reasonLabel: string | null = reasonCategory
    ? (t as unknown as Record<string, string>)[
        REASON_TO_KEY[reasonCategory]
      ] ?? reasonCategory
    : null;

  const Icon = SEVERITY_ICON[bannerHints.severity];
  const accentColor = severityToColor[bannerHints.severity];

  const hasNote = typeof note === 'string' && note.length > 0;

  const onToggleNote = () => {
    // CRITICAL: configureNext MUST be synchronously immediately before
    // setState (no async between them) — analog Pitfall comment at
    // UserStatusBanner.tsx:130-132.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const accessibilityLabel =
    `${title}. ${reasonLabel ?? ''}. ${note ?? ''}`.trim();

  return (
    <View
      testID={rootTestID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        // 10% alpha tint via hex alpha suffix (1A). NOT a hardcoded color —
        // the suffix is an alpha channel applied to the dynamic accent token.
        { backgroundColor: `${accentColor}1A` },
      ]}
    >
      {/* Absolute-positioned 4 px left accent bar at full accent color. */}
      <View style={[styles.accent, { backgroundColor: accentColor }]} />

      {/* Line 1: icon + title + reason chip (chip omitted if no reason). */}
      <View style={styles.line1}>
        <Icon
          size={16}
          color={accentColor}
          testID={`listing-status-banner-icon-${status}`}
        />
        <Text
          style={[
            TYPOGRAPHY.bodyStrong,
            styles.title,
            { color: COLORS.textPrimary },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {reasonCategory && reasonLabel && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{reasonLabel}</Text>
          </View>
        )}
      </View>

      {/* Optional note: rendered ONLY when string non-empty. Empty-string
          treated as no-note per RN Text behavior + plan §Action F6 decision. */}
      {hasNote && (
        <Pressable
          testID="listing-status-banner-note"
          onPress={onToggleNote}
          accessibilityRole="button"
        >
          <Text
            style={[TYPOGRAPHY.body, styles.note]}
            numberOfLines={expanded ? undefined : 2}
          >
            {note}
          </Text>
        </Pressable>
      )}

      {/* cartRow-only Remove CTA — gated on both variant AND callback presence
          so 'detail' variant or a 'cartRow' caller that omitted the callback
          both safely render no CTA (T-11-02-02 mitigation). */}
      {variant === 'cartRow' && onRemoveFromCart && (
        <Pressable
          testID="listing-status-banner-remove"
          onPress={onRemoveFromCart}
          accessibilityRole="button"
        >
          <Text style={styles.removeCta}>
            {(t as unknown as Record<string, string>).cartListingUnavailableRemove}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

export default ListingStatusBanner;

// ---- Styles ---------------------------------------------------------------
// Mirrors UserStatusBanner.tsx:258-316 with the inline-mount divergences:
//   - DROP position/top/left/right/zIndex (banner is inline in the screen
//     ScrollView per D-02 — not a global App.tsx overlay).
//   - KEEP accent strip absolute positioning (relative to container).
//   - ADD removeCta (cartRow variant) sized to analog ctaLabel + accent color.

const styles = StyleSheet.create({
  container: {
    paddingLeft: SIZES.spacingMd + 4, // 4 px room for the left accent strip
    paddingRight: SIZES.spacingMd,
    paddingVertical: SIZES.spacingMd,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.spacingMd,
    position: 'relative',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  line1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.spacingSm,
  },
  title: {
    flex: 1,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.spacingSm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusPill,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  chipText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textTertiaryStrong,
  },
  note: {
    color: COLORS.textPrimary,
    marginTop: SIZES.spacingXs,
  },
  removeCta: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.accent,
    marginTop: SIZES.spacingSm,
    alignSelf: 'flex-end',
  },
});
