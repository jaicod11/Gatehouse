import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const STEP_MS = 70;
const MAX_STEPS = 8;

export type AppearProps = {
  /** Position among its siblings: each step starts a little later, up to a cap. */
  index?: number;
  children: ReactNode;
  /** Layout for the wrapper itself (flex, width). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Fades and slides its content in on mount, staggered by `index`. Reanimated skips the animation
 * when the OS asks for reduced motion.
 */
export function Appear({ index = 0, children, style }: AppearProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(420).delay(Math.min(index, MAX_STEPS) * STEP_MS)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
