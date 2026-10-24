import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useId, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { colors, gradients } from '@/constants/theme';

type Orb = {
  color: string;
  /** Peak opacity at the orb's center. */
  opacity: number;
  /** Diameter as a fraction of the container's longer side. */
  size: number;
  /** Center position as a fraction of the container's width / height. */
  x: number;
  y: number;
  /** Duration of one drift sweep. Each orb uses a different one so they never sync up. */
  duration: number;
};

const ORBS: readonly Orb[] = [
  { color: colors.accent.indigo, opacity: 0.55, size: 0.9, x: 0.15, y: 0.05, duration: 19_000 },
  { color: colors.accent.violet, opacity: 0.4, size: 0.75, x: 0.95, y: 0.45, duration: 23_000 },
  { color: colors.accent.cyan, opacity: 0.22, size: 0.7, x: 0.3, y: 1, duration: 27_000 },
];

/** Opacity falloff from center to edge. Roughly Gaussian, so the orbs have no visible rim. */
const FALLOFF = [
  [0, 1],
  [0.2, 0.75],
  [0.45, 0.38],
  [0.7, 0.12],
  [1, 0],
] as const;

/** How far an orb drifts from its anchor, as a fraction of the container's longer side. */
const DRIFT = 0.07;

const easeInOut = Easing.inOut(Easing.sin);

type Size = { width: number; height: number };

/**
 * Full-bleed dark backdrop with large, soft color orbs drifting slowly behind the content. Fills
 * its parent, ignores touches, and holds still when the OS asks for reduced motion.
 */
export function GradientBackground() {
  const [size, setSize] = useState<Size | null>(null);
  const reduceMotion = useReducedMotion();

  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }));
  };

  return (
    <View style={styles.fill} onLayout={handleLayout}>
      <LinearGradient colors={gradients.backdrop} style={StyleSheet.absoluteFill} />
      {size ? (
        <Animated.View entering={FadeIn.duration(1200)} style={StyleSheet.absoluteFill}>
          {ORBS.map((orb, index) => (
            <DriftingOrb key={index} orb={orb} container={size} animate={!reduceMotion} />
          ))}
        </Animated.View>
      ) : null}
      {/* Darken the lower half slightly so content there keeps its contrast. */}
      <LinearGradient
        colors={['transparent', 'rgba(7, 8, 13, 0.55)']}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function DriftingOrb({ orb, container, animate }: { orb: Orb; container: Size; animate: boolean }) {
  // useId output can include characters that aren't valid in an SVG url(#id) reference.
  const gradientId = `orb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    x.set(withRepeat(withTiming(1, { duration: orb.duration, easing: easeInOut }), -1, true));
    // A different period on each axis traces a slow, non-repeating looking path.
    y.set(
      withRepeat(withTiming(1, { duration: orb.duration * 1.37, easing: easeInOut }), -1, true),
    );
    return () => {
      cancelAnimation(x);
      cancelAnimation(y);
    };
  }, [animate, orb.duration, x, y]);

  const longSide = Math.max(container.width, container.height);
  const diameter = longSide * orb.size;
  const drift = longSide * DRIFT;

  const driftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(x.get(), [0, 1], [-drift, drift]) },
      { translateY: interpolate(y.get(), [0, 1], [drift * 0.7, -drift * 0.7]) },
      { scale: interpolate(x.get(), [0, 1], [1, 1.1]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: diameter,
          height: diameter,
          left: orb.x * container.width - diameter / 2,
          top: orb.y * container.height - diameter / 2,
        },
        driftStyle,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradientId} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            {FALLOFF.map(([offset, strength]) => (
              <Stop
                key={offset}
                offset={offset}
                stopColor={orb.color}
                stopOpacity={orb.opacity * strength}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  orb: {
    position: 'absolute',
  },
});
