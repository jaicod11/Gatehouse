import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

import { Body, Text, type IconComponent } from '@/components/ui';
import { colors } from '@/constants/theme';

export type DetailItem = {
  icon: IconComponent;
  label: string;
  /** Text, or a node such as a badge. */
  value: ReactNode;
};

/** Label / value rows separated by hairlines, e.g. the account and session details. */
export function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <View>
      {items.map(({ icon: Icon, label, value }, index) => (
        <Fragment key={label}>
          {index > 0 ? <View className="h-px bg-border" /> : null}
          <View className="min-h-[52px] flex-row items-center gap-3 py-3">
            <Icon size={16} color={colors.text.muted} strokeWidth={2} />
            <Body size="sm" tone="secondary" className="shrink-0">
              {label}
            </Body>
            {/* Text takes the full width and aligns right, so a long email wraps instead of
                running over the label. */}
            <View className="min-w-0 flex-1">
              {typeof value === 'string' ? (
                <Text weight="medium" className="text-right text-sm leading-5">
                  {value}
                </Text>
              ) : (
                <View className="items-end">{value}</View>
              )}
            </View>
          </View>
        </Fragment>
      ))}
    </View>
  );
}
