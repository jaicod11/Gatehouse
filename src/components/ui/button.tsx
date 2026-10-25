import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentType } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, gradients, radius, shadows } from '@/constants/theme';
import { cn } from '@/utils/cn';

import { Text, type TextTone } from './typography';

/** Any icon that takes color and size props, e.g. a lucide-react-native icon. */
export type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const sizeStyles: Record<ButtonSize, { box: string; label: string; icon: number; radius: number }> =
  {
    sm: { box: 'h-9 gap-1.5 px-3.5', label: 'text-sm', icon: 16, radius: radius.md },
    md: { box: 'h-12 gap-2 px-5', label: 'text-[15px]', icon: 18, radius: radius.control },
    lg: { box: 'h-14 gap-2.5 px-6', label: 'text-base', icon: 20, radius: radius.control },
  };

// `interactive` holds the hover/press feedback, left off while the button is disabled or loading.
const variantStyles: Record<
  ButtonVariant,
  { box: string; interactive: string; tone: TextTone; color: string }
> = {
  primary: {
    box: '',
    interactive: 'hover:opacity-90',
    tone: 'primary',
    color: colors.text.primary,
  },
  secondary: {
    box: 'border border-border-strong bg-white/[0.06]',
    interactive: 'hover:bg-white/10 active:bg-white/[0.12]',
    tone: 'primary',
    color: colors.text.primary,
  },
  ghost: {
    box: '',
    interactive: 'hover:bg-white/5 active:bg-white/10',
    tone: 'secondary',
    color: colors.text.secondary,
  },
};

const isWeb = Platform.OS === 'web';

const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner in place of the icon and blocks presses. */
  loading?: boolean;
  leftIcon?: IconComponent;
  /** Stretch to the parent's width. */
  fullWidth?: boolean;
  /** Classes for the outer box (margins, alignment). */
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon: LeftIcon,
  fullWidth = false,
  className,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const inactive = disabled || loading;
  const sizing = sizeStyles[size];
  const look = variantStyles[variant];

  const handlePressIn = (event: GestureResponderEvent) => {
    scale.set(withSpring(0.97, PRESS_SPRING));
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    scale.set(withSpring(1, PRESS_SPRING));
    onPressOut?.(event);
  };

  return (
    // A row wrapper sizes the button to its content inside a column parent while still honoring
    // the parent's alignItems, rather than forcing an alignSelf.
    <View
      className={cn('flex-row', fullWidth && 'self-stretch', disabled && 'opacity-40', className)}
    >
      {/* The radius lives in style (not a class) so the glow and the clipped surface share it. */}
      <Animated.View
        style={[
          { borderRadius: sizing.radius },
          fullWidth ? styles.fill : null,
          variant === 'primary' && !disabled ? styles.glow : null,
          scaleStyle,
        ]}
      >
        <Pressable
          role="button"
          aria-disabled={inactive}
          aria-busy={loading}
          accessibilityState={{ disabled: inactive, busy: loading }}
          accessibilityLabel={label}
          disabled={inactive}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className={cn(
            'flex-row items-center justify-center overflow-hidden',
            sizing.box,
            look.box,
            !inactive && look.interactive,
            // Web only: cursors don't exist on native.
            isWeb &&
              (disabled ? 'cursor-not-allowed' : loading ? 'cursor-progress' : 'cursor-pointer'),
          )}
          style={{ borderRadius: sizing.radius }}
          {...rest}
        >
          {variant === 'primary' ? (
            <>
              <LinearGradient
                colors={gradients.accent}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[StyleSheet.absoluteFill, styles.decor]}
              />
              {/* Soft top light gives the gradient some depth. */}
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0)']}
                locations={[0, 0.6]}
                style={[StyleSheet.absoluteFill, styles.decor]}
              />
            </>
          ) : null}

          {loading ? (
            <ActivityIndicator size="small" color={look.color} />
          ) : LeftIcon ? (
            // The View keeps the SVG above the absolutely positioned gradients on web, where
            // positioned layers paint over unpositioned siblings regardless of order.
            <View>
              <LeftIcon size={sizing.icon} color={look.color} strokeWidth={2.25} />
            </View>
          ) : null}
          <Text
            tone={look.tone}
            weight="semibold"
            selectable={false}
            numberOfLines={1}
            className={sizing.label}
          >
            {label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  glow: {
    boxShadow: shadows.glow,
  },
  decor: {
    pointerEvents: 'none',
  },
});
