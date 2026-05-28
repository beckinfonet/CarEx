import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../constants/theme';
import { useLanguage } from '../../context/LanguageContext';

export type ModerationState =
  | 'active'
  | 'feature_limited'
  | 'blocked_with_review'
  | 'permanently_banned';

const STATE_TO_PALETTE_KEY: Record<ModerationState, keyof typeof COLORS.moderation> = {
  active: 'active',
  feature_limited: 'featureLimited',
  blocked_with_review: 'blockedReview',
  permanently_banned: 'permaBanned',
};

const STATE_TO_LABEL_KEY: Record<
  ModerationState,
  'stateFilterActive' | 'stateFilterFeatureLimited' | 'stateFilterBlocked' | 'stateFilterBanned'
> = {
  active: 'stateFilterActive',
  feature_limited: 'stateFilterFeatureLimited',
  blocked_with_review: 'stateFilterBlocked',
  permanently_banned: 'stateFilterBanned',
};

export const SeverityBadge: React.FC<{ state: ModerationState }> = ({ state }) => {
  const { t } = useLanguage();
  const paletteKey = STATE_TO_PALETTE_KEY[state];
  const palette = COLORS.moderation[paletteKey];
  const labelKey = STATE_TO_LABEL_KEY[state];
  // `t` now contains string[] fields (260528-hmt greeting variant pools); route the
  // index-signature cast via `unknown` so TS accepts the non-overlapping cast.
  const label = (t as unknown as Record<string, string>)[labelKey] ?? state;

  return (
    <View
      style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    height: SIZES.badgeHeight,
    paddingHorizontal: SIZES.spacingSm,
    borderRadius: SIZES.radiusPill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    ...TYPOGRAPHY.bodyStrong,
    lineHeight: SIZES.badgeHeight,
  },
});
