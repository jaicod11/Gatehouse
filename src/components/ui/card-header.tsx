import type { ReactNode } from 'react';
import { View } from 'react-native';

import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

import type { IconComponent } from './button';
import { Body, Text } from './typography';

export type CardHeaderProps = {
  icon: IconComponent;
  title: string;
  subtitle?: string;
  /** Rendered on the right, e.g. a badge. */
  accessory?: ReactNode;
  className?: string;
};

/** Icon tile, title and optional subtitle at the top of a card. */
export function CardHeader({ icon: Icon, title, subtitle, accessory, className }: CardHeaderProps) {
  return (
    <View className={cn('flex-row items-center gap-3.5', className)}>
      <View className="size-10 items-center justify-center rounded-md border border-border bg-white/[0.04]">
        <Icon size={18} color={colors.accent.cyan} strokeWidth={2} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text role="heading" aria-level={2} weight="semibold" className="text-base leading-6">
          {title}
        </Text>
        {subtitle ? (
          <Body size="sm" tone="secondary">
            {subtitle}
          </Body>
        ) : null}
      </View>
      {accessory}
    </View>
  );
}
