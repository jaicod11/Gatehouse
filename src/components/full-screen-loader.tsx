import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LogoMark } from '@/components/logo-mark';
import { Body } from '@/components/ui';
import { colors, gradients } from '@/constants/theme';

/**
 * Full-screen branded loader shown while the session is checked. The backdrop matches
 * GradientBackground's base wash, so the hand-off to the next screen is seamless, and the content
 * fades in after a short delay so a fast check doesn't flash it.
 */
export function FullScreenLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 bg-background" role="progressbar" aria-busy aria-label={label}>
      <LinearGradient colors={gradients.backdrop} style={StyleSheet.absoluteFill} />
      <View className="flex-1 items-center justify-center">
        <Animated.View entering={FadeIn.delay(150).duration(400)}>
          <View className="items-center gap-6">
            <LogoMark size={56} />
            <View className="flex-row items-center gap-3">
              <ActivityIndicator size="small" color={colors.accent.cyan} />
              <Body size="sm" tone="secondary">
                {label}
              </Body>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
