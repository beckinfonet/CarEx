import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

export interface GreetingBlockProps {
  /** Localized morning/afternoon/evening string, e.g. "Доброе утро". */
  timeOfDay: string;
  /** Optional contextual subject for the kicker (e.g. "Becky · Москва"). When omitted, only the time-of-day is shown. */
  subject?: string;
  /** Localized headline, e.g. "Найдём ваше идеальное авто." */
  headline: string;
  /** Live count of listings currently displayed. */
  listingsCount: number;
  /** Localized noun "объявлений" / "listings". */
  listingsNoun: string;
  /** Optional element rendered at the right edge of the chip row (used for LangSwitchV2). */
  trailing?: React.ReactNode;
}

export const GreetingBlock: React.FC<GreetingBlockProps> = ({
  timeOfDay, subject, headline, listingsCount, listingsNoun, trailing,
}) => {
  const typo = useTypography();
  const kicker = subject && subject.trim() ? `${timeOfDay} · ${subject}` : timeOfDay;
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.kicker, { fontFamily: typo.display }]}>
        {kicker}
      </Text>
      <Text style={[styles.headline, { fontFamily: typo.display }]}>
        {headline}
      </Text>
      <View style={styles.chipRow}>
        <View style={styles.statusGroup}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[styles.statusCount, { fontFamily: typo.mono }]}
          >
            {listingsCount}
          </Text>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[styles.statusNoun, { fontFamily: typo.display }]}
          >
            {listingsNoun}
          </Text>
        </View>
        {trailing}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper:   { paddingTop: 16, paddingBottom: 6 },
  kicker:    {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.4,
    textTransform: 'uppercase', color: V2.textMuted, marginBottom: 12,
  },
  headline:  {
    fontSize: 30, fontWeight: '800', letterSpacing: -1.05,
    color: V2.text, lineHeight: 38, paddingTop: 2,
  },
  chipRow:   {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 12, gap: 8,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexShrink: 1,
  },
  statusCount: {
    color: V2.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.16,
  },
  statusNoun: {
    color: V2.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
});
