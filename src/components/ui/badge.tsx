import { View } from 'react-native';

import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

import type { IconComponent } from './button';
import { Text, type TextTone } from './typography';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error';

const toneStyles: Record<
  BadgeTone,
  { box: string; dot: string; text: TextTone; iconColor: string }
> = {
  neutral: {
    box: 'border-border-strong bg-white/[0.06]',
    dot: 'bg-fg-secondary',
    text: 'secondary',
    iconColor: colors.text.secondary,
  },
  accent: {
    box: 'border-accent-violet/40 bg-accent-violet/15',
    dot: 'bg-accent-cyan',
    text: 'primary',
    iconColor: colors.accent.cyan,
  },
  success: {
    box: 'border-success/30 bg-success/10',
    dot: 'bg-success',
    text: 'success',
    iconColor: colors.success,
  },
  warning: {
    box: 'border-warning/30 bg-warning/10',
    dot: 'bg-warning',
    text: 'warning',
    iconColor: colors.warning,
  },
  error: {
    box: 'border-error/30 bg-error/10',
    dot: 'bg-error',
    text: 'error',
    iconColor: colors.error,
  },
};

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  /** Leading status dot. Ignored when `icon` is set. */
  dot?: boolean;
  icon?: IconComponent;
  className?: string;
};

/** Small pill for roles, statuses and counts. */
export function Badge({ label, tone = 'neutral', dot = false, icon: Icon, className }: BadgeProps) {
  const look = toneStyles[tone];
  return (
    <View
      className={cn(
        'h-6 flex-row items-center gap-1.5 self-start rounded-full border px-2.5',
        look.box,
        className,
      )}
    >
      {Icon ? (
        <Icon size={12} color={look.iconColor} strokeWidth={2.5} />
      ) : dot ? (
        <View className={cn('size-1.5 rounded-full', look.dot)} />
      ) : null}
      <Text tone={look.text} weight="semibold" className="text-xs leading-4">
        {label}
      </Text>
    </View>
  );
}
