import { CircleAlert, CircleCheck, TriangleAlert, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

import type { IconComponent } from './button';
import { Body } from './typography';

export type AlertTone = 'error' | 'warning' | 'success';

const toneStyles: Record<AlertTone, { box: string; icon: IconComponent; iconColor: string }> = {
  error: { box: 'border-error/35 bg-error/10', icon: CircleAlert, iconColor: colors.error },
  warning: {
    box: 'border-warning/35 bg-warning/10',
    icon: TriangleAlert,
    iconColor: colors.warning,
  },
  success: { box: 'border-success/35 bg-success/10', icon: CircleCheck, iconColor: colors.success },
};

export type AlertProps = {
  message: string;
  tone?: AlertTone;
  /** Shows a close button that calls this. */
  onDismiss?: () => void;
  /** Classes for the outer box (margins). */
  className?: string;
};

/**
 * Inline message that fades and slides in. Render it conditionally (and give it a `key` per
 * message) so it animates in and out. Screen readers announce it when it appears.
 */
export function Alert({ message, tone = 'error', onDismiss, className }: AlertProps) {
  const look = toneStyles[tone];
  const Icon = look.icon;

  return (
    <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOutUp.duration(180)}>
      <View
        role="alert"
        aria-live="assertive"
        className={cn('flex-row items-start gap-3 rounded-lg border p-3.5', look.box, className)}
      >
        <View className="pt-0.5">
          <Icon size={18} color={look.iconColor} strokeWidth={2.25} />
        </View>
        <Body size="sm" className="flex-1">
          {message}
        </Body>
        {onDismiss ? (
          <Pressable
            role="button"
            accessibilityLabel="Dismiss"
            hitSlop={8}
            onPress={onDismiss}
            className="-m-1 rounded-md p-1 hover:bg-white/10 active:bg-white/10"
          >
            <X size={16} color={colors.text.secondary} strokeWidth={2.25} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
