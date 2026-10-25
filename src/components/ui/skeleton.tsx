import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Corner radius in px. Use a large value for circles (avatars). */
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder block for content that is loading. Pulses gently unless reduced motion is on. */
export function Skeleton({ width = '100%', height = 14, radius = 8, style }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(
      withRepeat(withTiming(0.4, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      aria-hidden
      style={[
        { width, height, borderRadius: radius, backgroundColor: 'rgba(255, 255, 255, 0.07)' },
        pulse,
        style,
      ]}
    />
  );
}
