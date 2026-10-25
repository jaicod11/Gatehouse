import type { ReactNode } from 'react';
import { View } from 'react-native';

import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';

import type { IconComponent } from './button';
import { Body, Text } from './typography';

export type EmptyStateProps = {
  icon: IconComponent;
  title: string;
  message?: string;
  /** "error" tints the icon; use it for failed loads. */
  tone?: 'neutral' | 'error';
  /** A button, e.g. Retry or Clear search. */
  action?: ReactNode;
  className?: string;
};

/** Centered message for an empty list, no search results, or a failed load. */
export function EmptyState({
  icon: Icon,
  title,
  message,
  tone = 'neutral',
  action,
  className,
}: EmptyStateProps) {
  const isError = tone === 'error';
  return (
    <View role={isError ? 'alert' : undefined} className={cn('items-center px-4 py-12', className)}>
      <View
        className={cn(
          'size-12 items-center justify-center rounded-lg border',
          isError ? 'border-error/30 bg-error/10' : 'border-border bg-white/[0.04]',
        )}
      >
        <Icon size={22} color={isError ? colors.error : colors.text.secondary} strokeWidth={2} />
      </View>
      <Text weight="semibold" className="mt-4 text-center text-base leading-6">
        {title}
      </Text>
      {message ? (
        <Body size="sm" tone="secondary" className="mt-1 max-w-[360px] text-center">
          {message}
        </Body>
      ) : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}
