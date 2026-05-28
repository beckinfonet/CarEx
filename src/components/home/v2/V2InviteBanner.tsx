import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { V2 } from './theme';
import { useUIVersion } from '../../../context/UIVersionContext';
import { useTypography } from '../../../hooks/useTypography';

export interface V2InviteBannerProps {
  headline:   string;
  tryLabel:   string;
  notNowLabel: string;
}

export const V2InviteBanner: React.FC<V2InviteBannerProps> = ({ headline, tryLabel, notNowLabel }) => {
  const { version, setVersion, inviteDismissed, dismissInvite } = useUIVersion();
  const typo = useTypography();
  const [visible, setVisible] = useState(version === 'v1' && !inviteDismissed);

  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(1);

  useEffect(() => {
    setVisible(version === 'v1' && !inviteDismissed);
  }, [version, inviteDismissed]);

  const slideAndHide = () => {
    translateY.value = withTiming(-40, { duration: 200 });
    opacity.value    = withTiming(0,   { duration: 200 }, (done) => {
      if (done) runOnJS(setVisible)(false);
    });
  };

  const onTry = () => {
    setVersion('v2');
    dismissInvite();
    slideAndHide();
  };
  const onNotNow = () => {
    dismissInvite();
    slideAndHide();
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.wrapper, style]}>
      <View style={styles.row}>
        <Sparkles size={18} color={V2.blue} strokeWidth={2.2} />
        <Text style={[styles.headline, { fontFamily: typo.display }]} numberOfLines={2}>
          {headline}
        </Text>
        <TouchableOpacity onPress={onTry}><Text style={[styles.try, { fontFamily: typo.display }]}>{tryLabel}</Text></TouchableOpacity>
        <TouchableOpacity onPress={onNotNow}><Text style={[styles.notNow, { fontFamily: typo.display }]}>{notNowLabel}</Text></TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 12, padding: 12,
    borderRadius: 14,
    backgroundColor: V2.surface,
    borderWidth: 1, borderColor: 'rgba(77,163,255,0.32)',
  },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headline: { flex: 1, fontSize: 13, fontWeight: '700', color: V2.text },
  try:      { fontSize: 13, fontWeight: '800', color: V2.blue, marginLeft: 4 },
  notNow:   { fontSize: 13, fontWeight: '600', color: V2.textMuted, marginLeft: 8 },
});
