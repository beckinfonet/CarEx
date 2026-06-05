import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, User } from 'lucide-react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

// Match the hero card's width exactly. The HomeScreenV2 FlatList insets its
// content by 18px, but the hero card below renders at a 14px inset (HeroRotator
// goes full-bleed with marginHorizontal:-18, then HeroCard pads outer:14). So
// pull the strip out by (18 - 14) = 4px to land flush with the card's edges.
const CARD_EDGE_PULL = -4;

export interface MemberCountStripProps {
  /**
   * Pre-formatted total members, e.g. "2,418,367" (EN) or "2 418 367" (RU).
   * IMPORTANT: format the RU value with NON-BREAKING spaces (\u00A0) as the
   * thousands separator so the number can never break across lines.
   */
  countText: string;
  /** Localized noun, e.g. "users" / "пользователей". */
  noun: string;
  /** Localized caption under the count, e.g. "buying & selling" / "покупают и продают". */
  caption: string;
  /** Pre-formatted growth, e.g. "+18%". */
  growthText: string;
  /** Localized period label, e.g. "this year" / "за год". */
  periodLabel: string;
  /**
   * Optional avatar disc colors — deliberately abstract, flag/face-free.
   * Defaults to the brand palette. On very narrow screens (≤340pt) pass 4
   * colors instead of 5 to leave more room for the text column.
   */
  avatarColors?: readonly string[];
}

const DEFAULT_AVATARS = ['#4DA3FF', '#67E8B6', '#F2BD98', '#B79CFF', '#FF9DB0'] as const;
const AVATAR = 26;
const OVERLAP = 9;

/**
 * MemberCountStrip — total-member social-proof band for the V2 home screen.
 *
 * Sits between the GreetingBlock meta row and the HeroRotator (the `aboveHero`
 * slot in the prototype). A stack of abstract member avatars + the total count,
 * a short caption, and a quiet growth stat on the right.
 *
 * Data-driven like MarketStatsStrip: all numbers arrive pre-formatted as strings
 * so this component never does locale math.
 */
export const MemberCountStrip: React.FC<MemberCountStripProps> = ({
  countText, noun, caption, growthText, periodLabel, avatarColors = DEFAULT_AVATARS,
}) => {
  const typo = useTypography();
  return (
    <View
      style={styles.strip}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${countText} ${noun}, ${caption}. ${growthText} ${periodLabel}.`}
    >
      <AvatarStack colors={avatarColors} />

      <View style={styles.middle}>
        <Text numberOfLines={2} style={[styles.countLine, { fontFamily: typo.display }]}>
          <Text style={{ fontFamily: typo.mono }}>{countText}</Text>
          {` ${noun}`}
        </Text>
        <Text numberOfLines={2} style={[styles.caption, { fontFamily: typo.display }]}>
          {caption}
        </Text>
      </View>

      <View style={styles.growth}>
        <View style={styles.growthRow}>
          <TrendingUp size={13} color={V2.green} strokeWidth={2.3} />
          <Text allowFontScaling={false} style={[styles.growthValue, { fontFamily: typo.mono }]}>
            {growthText}
          </Text>
        </View>
        <Text allowFontScaling={false} style={[styles.period, { fontFamily: typo.display }]}>
          {periodLabel}
        </Text>
      </View>
    </View>
  );
};

const AvatarStack: React.FC<{ colors: readonly string[] }> = ({ colors }) => (
  <View style={styles.avatars}>
    {colors.map((c, i) => (
      <View
        key={i}
        style={[
          styles.avatar,
          { backgroundColor: c, marginLeft: i === 0 ? 0 : -OVERLAP, zIndex: colors.length - i },
        ]}
      >
        {/* Generic person silhouette so each disc reads as a member avatar.
            Decorative — the parent View owns the accessibility label. */}
        <User size={14} color="rgba(8,9,12,0.55)" strokeWidth={2.4} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: CARD_EDGE_PULL, // flush with the hero card's 14px edges
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: V2.surface,
    borderWidth: 1,
    borderColor: V2.border,
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: V2.surface, // ring blends into the strip background
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, minWidth: 0, alignItems: 'center' },
  countLine: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.14,
    color: V2.text,
    lineHeight: 18,
    textAlign: 'center',
  },
  caption: {
    fontSize: 11.5,
    fontWeight: '600',
    color: V2.textMuted,
    marginTop: 1,
    lineHeight: 15,
    textAlign: 'center',
  },
  growth: { alignItems: 'flex-end' },
  growthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  growthValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.14,
    color: V2.green,
  },
  period: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: V2.textMuted,
    marginTop: 1,
  },
});
