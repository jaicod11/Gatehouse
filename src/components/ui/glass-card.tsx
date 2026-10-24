import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { glass, shadows } from '@/constants/theme';
import { cn } from '@/utils/cn';

import { useBlurTarget } from './blur-target';

const paddingClass = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-6 md:p-10',
} as const;

export type GlassCardProps = ViewProps & {
  /** Classes for the outer box (width, margins, flex). */
  className?: string;
  padding?: keyof typeof paddingClass;
  /** Native blur strength, 1-100. */
  intensity?: number;
};

/**
 * Frosted-glass surface. Native platforms blur with expo-blur (Android 12+ blurs the Screen
 * background through its BlurTargetView). Web uses CSS backdrop-filter, because expo-blur's web
 * fallback caps the blur at 20px and adds a neutral grey tint that clashes with the palette.
 *
 * Web caveat: an ancestor with opacity < 1, a filter or a mask confines the backdrop-filter to that
 * ancestor, so don't fade a GlassCard's parents.
 */
export function GlassCard({
  children,
  className,
  padding = 'md',
  intensity = 40,
  style,
  ...rest
}: GlassCardProps) {
  const blurTarget = useBlurTarget();

  return (
    <View className={cn('rounded-card', className)} style={[styles.shadow, style]} {...rest}>
      <View
        className="overflow-hidden rounded-card border border-border"
        style={Platform.OS === 'web' ? webBackdrop : undefined}
      >
        {Platform.OS !== 'web' ? (
          <BlurView
            tint="dark"
            intensity={intensity}
            blurTarget={blurTarget}
            blurMethod={blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
        <LinearGradient colors={glass.sheen} style={[StyleSheet.absoluteFill, styles.decor]} />
        {/* A 1px highlight along the top edge catches the "light". */}
        <LinearGradient
          colors={['transparent', glass.highlight, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.highlight, styles.decor]}
        />
        <View className={paddingClass[padding]}>{children}</View>
      </View>
    </View>
  );
}

// backdropFilter isn't in React Native's style types, but react-native-web passes it to CSS.
const webBackdrop = {
  backdropFilter: `blur(${glass.webBlur}px) saturate(160%)`,
} as ViewStyle;

const styles = StyleSheet.create({
  shadow: {
    boxShadow: shadows.card,
  },
  tint: {
    backgroundColor: glass.tint,
    pointerEvents: 'none',
  },
  decor: {
    pointerEvents: 'none',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
  },
});
