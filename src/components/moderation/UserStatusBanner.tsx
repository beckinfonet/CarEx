/**
 * Phase 6 Plan 06-03 — UserStatusBanner
 *
 * Non-dismissable severity-aware global banner that reads from
 * `user.moderationStatus` (populated by Phase 4 MOB-03/MOB-04). Purely
 * presentational: no data fetching, no mutation. Mounts above the navigator in
 * App.tsx at zIndex 9998 (one below OfflineNotice at 9999).
 *
 * Delivers:
 *   - AFF-01: non-dismissable, severity-aware, tinted bg + 4px left-accent
 *   - AFF-02: reason-category chip + verbatim admin note (expand on tap)
 *   - AFF-03: mailto appeal CTA (blocked_with_review only) with URL-encoded
 *             subject + body (T-06-02 mitigation), Alert.alert fallback on
 *             Linking rejection
 *
 * Severity icon + palette map mirrors SeverityBadge.tsx verbatim so admin and
 * affected-user surfaces read identical colors (Phase 5 LEARNINGS:
 * "Severity palette as single source of truth").
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  LayoutAnimation,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, ShieldAlert, Ban } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';

// ModerationState literal union — mirrors SeverityBadge.tsx; do not widen.
type ModerationState =
  | 'active'
  | 'feature_limited'
  | 'blocked_with_review'
  | 'permanently_banned';

// State → palette-key map (copied verbatim from SeverityBadge.tsx:12-17).
const STATE_TO_PALETTE_KEY = {
  active: 'active',
  feature_limited: 'featureLimited',
  blocked_with_review: 'blockedReview',
  permanently_banned: 'permaBanned',
} as const;

// Severity icon picks (UI-SPEC §Color §Rationale for icon picks).
const SEVERITY_ICON = {
  feature_limited: AlertTriangle,
  blocked_with_review: ShieldAlert,
  permanently_banned: Ban,
} as const;

// Title translation-key map (keys landed by Plan 06-02).
const STATE_TO_TITLE_KEY = {
  feature_limited: 'bannerTitleFeatureLimited',
  blocked_with_review: 'bannerTitleBlockedWithReview',
  permanently_banned: 'bannerTitlePermanentlyBanned',
} as const;

function localizedReasonLabel(
  cat: string | null | undefined,
  t: any,
): string {
  switch (cat) {
    case 'spam':
      return t.reasonSpam;
    case 'policy_violation':
      return t.reasonPolicyViolation;
    case 'fraud':
      return t.reasonFraud;
    case 'other':
      return t.reasonOther;
    default:
      return t.reasonOther;
  }
}

interface UserStatusBannerProps {
  testID?: string;
}

export const UserStatusBanner: React.FC<UserStatusBannerProps> = ({
  testID = 'user-status-banner',
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);

  // Collapse on blur — UI-SPEC §Component 1 Interaction contract D-02.
  useFocusEffect(
    useCallback(() => {
      return () => setExpanded(false);
    }, []),
  );

  // Early returns: nothing to render when signed out or active.
  if (!user || !user.moderationStatus) {
    return null;
  }

  const state = user.moderationStatus.state as ModerationState | undefined;
  if (!state || state === 'active') {
    return null;
  }

  const paletteKey = STATE_TO_PALETTE_KEY[state];
  const palette = COLORS.moderation[paletteKey];
  const Icon = SEVERITY_ICON[state];
  const titleKey = STATE_TO_TITLE_KEY[state];
  // `t` now contains string[] fields (260528-hmt greeting variant pools); route the
  // index-signature cast via `unknown` so TS accepts the non-overlapping cast.
  const title: string = (t as unknown as Record<string, string>)[titleKey] ?? state;

  const reasonCategory = user.moderationStatus.reasonCategory ?? null;
  const reasonLabel = localizedReasonLabel(reasonCategory, t);
  const note: string | null | undefined = user.moderationStatus.note;
  const hasNote = typeof note === 'string' && note.length > 0;

  const onToggleNote = () => {
    // CRITICAL: configureNext MUST be called immediately before setState (no
    // async between them) — RESEARCH §Pitfall 2.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const handleAppeal = () => {
    const uid: string = user.localId ?? '';
    const setAt: string = user.moderationStatus?.setAt ?? '';
    const subject = `CarEx moderation appeal — ${uid}`;
    const body = [
      `User ID: ${uid}`,
      `Reason category: ${reasonLabel}`,
      `Suspended: ${setAt}`,
      '',
      t.appealPlaceholder,
    ].join('\n');
    // T-06-02 mitigation: EVERY user-supplied interpolation is URL-encoded
    // (subject + body call sites below). No raw string concat of user fields
    // into the URL.
    const url = `mailto:support@carexmarket.com?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    // Do NOT probe the URL first — that call returns false on some Android
    // devices even when the target app is installed (per established CarEx
    // convention — see CarDetailsScreen mailto/whatsapp handlers).
    Linking.openURL(url).catch(() => {
      Alert.alert(
        t.appealNoMailTitle,
        (t.appealNoMailBody ?? '').replace('{uid}', uid),
        [{ text: t.appealOk, style: 'default' }],
      );
    });
  };

  const accessibilityLabel = `${title}. ${reasonLabel}. ${note ?? ''}`.trim();

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        {
          backgroundColor: palette.bg,
          paddingTop: insets.top + SIZES.spacingMd,
        },
      ]}
    >
      {/* Absolute-positioned 4px left-accent bar (extends through insets.top
          region; deliberately not borderLeftWidth so the color reaches the top
          edge of the safe-area padding). */}
      <View
        style={[
          styles.accentBar,
          { backgroundColor: palette.border },
        ]}
      />

      {/* Line 1: icon + title + reason-category chip */}
      <View style={styles.line1}>
        <Icon
          size={16}
          color={palette.fg}
          testID={`user-status-banner-icon-${state}`}
        />
        <Text
          style={[
            TYPOGRAPHY.bodyStrong,
            styles.title,
            { color: palette.fg },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {reasonCategory && (
          <View style={styles.reasonChip}>
            <Text style={styles.reasonChipText}>{reasonLabel}</Text>
          </View>
        )}
      </View>

      {/* Line 2: verbatim admin note (hidden if empty/missing) */}
      {hasNote && (
        <Pressable
          testID="user-status-banner-note"
          onPress={onToggleNote}
          accessibilityRole="button"
          accessibilityLabel={expanded ? t.collapseNote : t.expandNote}
        >
          <Text
            style={[
              TYPOGRAPHY.body,
              styles.note,
            ]}
            numberOfLines={expanded ? undefined : 2}
          >
            {note}
          </Text>
        </Pressable>
      )}

      {/* Appeal CTA — blocked_with_review ONLY. Permanently_banned has no
          appeal path (UI-SPEC §Copywriting Contract + D-06). */}
      {state === 'blocked_with_review' && (
        <View style={styles.ctaRow}>
          <TouchableOpacity
            testID="user-status-banner-appeal"
            onPress={handleAppeal}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t.appealCta}
            style={styles.ctaButton}
          >
            <Text style={[TYPOGRAPHY.bodyStrong, styles.ctaLabel]}>
              {t.appealCta}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998, // one below OfflineNotice (9999) — UI-SPEC §App.tsx Integration
    paddingBottom: SIZES.spacingMd,
    paddingLeft: SIZES.spacingMd + 4, // 4px room for the left-accent bar
    paddingRight: SIZES.spacingMd,
  },
  accentBar: {
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
  reasonChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.spacingSm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusPill,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
  },
  reasonChipText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textTertiaryStrong,
  },
  note: {
    color: COLORS.textPrimary,
    marginTop: SIZES.spacingXs,
  },
  ctaRow: {
    marginTop: SIZES.spacingSm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  ctaButton: {
    backgroundColor: COLORS.accent,
    borderRadius: SIZES.radiusSm,
    paddingHorizontal: SIZES.spacingMd,
    paddingVertical: SIZES.spacingSm,
    minHeight: SIZES.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: '#FFFFFF',
  },
});
