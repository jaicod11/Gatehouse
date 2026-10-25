import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { radius } from '@/constants/theme';
import { cn } from '@/utils/cn';

import { GoogleLogo } from './google-logo';

/**
 * Google's light button theme from the sign-in branding guidelines. These are Google's values, not
 * app tokens: the full-colour G may only sit on a white, dark or neutral fill. White gives the
 * strongest call to action on the dark glass card; hover and press use Google's neutral fill.
 */
const GOOGLE_LIGHT = { stroke: '#747775', text: '#1F1F1F' } as const;

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

export type GoogleSignInButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  /** Shows a spinner and "Signing in…" and blocks presses. */
  loading?: boolean;
  /** Classes for the outer box (margins). */
  className?: string;
};

/** Full-width "Continue with Google" button following Google's branding rules. */
export function GoogleSignInButton({
  loading = false,
  disabled = false,
  className,
  onPressIn,
  onPressOut,
  ...rest
}: GoogleSignInButtonProps) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const inactive = disabled || loading;
  const label = loading ? 'Signing in…' : 'Continue with Google';

  const handlePressIn = (event: GestureResponderEvent) => {
    scale.set(withSpring(0.98, PRESS_SPRING));
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    scale.set(withSpring(1, PRESS_SPRING));
    onPressOut?.(event);
  };

  return (
    <View className={cn('flex-row self-stretch', disabled && 'opacity-50', className)}>
      <Animated.View style={[{ flex: 1, borderRadius: radius.control }, scaleStyle]}>
        <Pressable
          role="button"
          aria-disabled={inactive}
          aria-busy={loading}
          accessibilityLabel={label}
          disabled={inactive}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className="h-14 flex-row items-center justify-center gap-3 border bg-white px-4 hover:bg-[#F2F2F2] active:bg-[#F2F2F2]"
          style={{ borderRadius: radius.control, borderColor: GOOGLE_LIGHT.stroke }}
          {...rest}
        >
          {loading ? (
            <ActivityIndicator size="small" color={GOOGLE_LIGHT.text} />
          ) : (
            <GoogleLogo size={20} />
          )}
          <Text
            selectable={false}
            numberOfLines={1}
            className="font-semibold text-base"
            style={{ color: GOOGLE_LIGHT.text }}
          >
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
