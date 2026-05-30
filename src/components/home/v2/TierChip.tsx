import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet, Vibration } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Sparkles, Flame } from 'lucide-react-native';
import { V2 } from './theme';
import type { PersonalityTier } from '../../../context/PersonalityContext';

export interface TierChipProps {
  tier: PersonalityTier;
  /** Localized tier name for the chip face (e.g. "Спокойно" / "Wholesome"). CSS uppercases at render time. */
  label: string;
  onCycle: () => void;
  onOpenPicker: () => void;
  /** Localized "Personality: <tier>" string for VoiceOver/TalkBack. */
  a11yLabel: string;
  /** Localized "Double tap to switch, long press to pick" hint. */
  a11yHint: string;
}

export const TierChip: React.FC<TierChipProps> = ({
  tier, label, onCycle, onOpenPicker, a11yLabel, a11yHint,
}) => {
  const handlePress = () => {
    Vibration.vibrate(10);
    onCycle();
  };
  const handleLongPress = () => {
    Vibration.vibrate(15);
    onOpenPicker();
  };

  const Icon = tier === 'sarcastic' ? Sparkles : tier === 'unhinged' ? Flame : null;
  const iconColor = tier === 'unhinged' ? '#ffd8a3' : '#ffba66';

  const inner = (
    <View style={styles.inner}>
      {Icon ? <Icon size={11} color={iconColor} strokeWidth={2.4} /> : <Text style={styles.dot}>○</Text>}
      <Text
        numberOfLines={1}
        allowFontScaling={false}
        style={[
          styles.label,
          tier === 'wholesome' && { color: V2.textMuted },
          tier === 'sarcastic' && { color: iconColor },
          tier === 'unhinged'  && { color: iconColor },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  const gradientColors =
    tier === 'sarcastic'
      ? ['rgba(255,170,77,0.18)', 'rgba(255,77,160,0.16)']
      : tier === 'unhinged'
      ? ['rgba(255,170,77,0.32)', 'rgba(255,77,160,0.28)']
      : null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={a11yHint}
    >
      <View
        style={[
          styles.pill,
          tier === 'wholesome' && styles.pillWholesome,
          tier === 'sarcastic' && styles.pillSarcastic,
          tier === 'unhinged'  && styles.pillUnhinged,
        ]}
      >
        {gradientColors ? (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : null}
        {inner}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderWidth: 1,
    alignSelf: 'flex-end',
    overflow: 'hidden',
  },
  pillWholesome: { backgroundColor: V2.surface, borderColor: V2.border },
  pillSarcastic: { borderColor: 'rgba(255,170,77,0.45)' },
  pillUnhinged:  { borderColor: 'rgba(255,170,77,0.7)' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { color: V2.textMuted, fontSize: 11, fontWeight: '800' },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
});
