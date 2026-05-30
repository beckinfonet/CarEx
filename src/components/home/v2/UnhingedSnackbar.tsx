import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { V2 } from './theme';

export interface UnhingedSnackbarProps {
  visible: boolean;
  message: string;
  onHide: () => void;
}

/**
 * Quick 260530-bdq — auto-dismissing snackbar shown when the user enters the
 * UNHINGED tier (after consent has been accepted). Pure cross-platform RN
 * primitives, no ToastAndroid. Fades in (200ms), holds (2000ms), fades out
 * (200ms), then invokes `onHide()` so the parent can clear `visible`.
 *
 * When `visible` flips back to `false` we render nothing — keeps the layer
 * from intercepting touches above BottomBar between toasts.
 */
export const UnhingedSnackbar: React.FC<UnhingedSnackbarProps> = ({
  visible, message, onHide,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) {
      // Stop any in-flight sequence and reset for the next show. No animation
      // here — the early-return below unmounts the view.
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      opacity.setValue(0);
      return;
    }

    // Cancel a prior in-flight fade so a rapid re-show starts cleanly.
    if (animationRef.current) {
      animationRef.current.stop();
    }

    const seq = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    animationRef.current = seq;

    seq.start(({ finished }) => {
      if (finished) onHide();
    });

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, [visible, opacity, onHide]);

  if (!visible) return null;

  return (
    <Animated.View
      testID="unhinged-snackbar"
      pointerEvents="none"
      style={[styles.container, { opacity }]}
    >
      <Text testID="unhinged-snackbar-text" style={styles.text}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 96,
    left: 18,
    right: 18,
    padding: 12,
    borderRadius: V2.radius.small,
    backgroundColor: V2.surfaceHi,
    borderWidth: 1,
    borderColor: V2.borderHi,
  },
  text: {
    color: V2.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
