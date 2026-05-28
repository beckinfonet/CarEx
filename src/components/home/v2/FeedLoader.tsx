import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay } from 'react-native-reanimated';
import { V2 } from './theme';
import { useTypography } from '../../../hooks/useTypography';

interface DotProps { delay: number; }
const Dot: React.FC<DotProps> = ({ delay }) => {
  const opacity = useSharedValue(0.35);
  const scale   = useSharedValue(1);
  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(withTiming(1, { duration: 600 }), -1, true));
    scale.value   = withDelay(delay, withRepeat(withTiming(1.3, { duration: 600 }), -1, true));
  }, [delay, opacity, scale]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
};

export interface FeedLoaderProps {
  caption: string;
}

export const FeedLoader: React.FC<FeedLoaderProps> = ({ caption }) => {
  const typo = useTypography();
  return (
    <View style={styles.wrapper}>
      <View style={styles.dotRow}>
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
      </View>
      <Text style={[styles.caption, { fontFamily: typo.display }]}>{caption}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { paddingVertical: 18, alignItems: 'center', gap: 10 },
  dotRow:  { flexDirection: 'row', gap: 5 },
  dot:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: V2.textFaint },
  caption: {
    fontSize: 10.5, fontWeight: '700', letterSpacing: 1.26,
    textTransform: 'uppercase', color: V2.textFaint,
  },
});
