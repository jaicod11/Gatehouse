import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { Body, Text } from '@/components/ui';
import { colors } from '@/constants/theme';

export type AccessCheck = {
  title: string;
  detail: string;
};

/** Vertical list of passed checks, joined by a thin line. */
export function AccessChecklist({ checks }: { checks: AccessCheck[] }) {
  return (
    <View>
      {checks.map(({ title, detail }, index) => {
        const last = index === checks.length - 1;
        return (
          <View key={title} className="flex-row gap-3.5">
            <View className="items-center">
              <View className="size-7 items-center justify-center rounded-full border border-success/35 bg-success/15">
                <Check size={14} color={colors.success} strokeWidth={3} />
              </View>
              {last ? null : <View className="w-px flex-1 bg-success/20" />}
            </View>
            <View className={last ? 'flex-1 pt-0.5' : 'flex-1 pb-5 pt-0.5'}>
              <Text weight="semibold" className="text-sm leading-5">
                {title}
              </Text>
              <Body size="sm" tone="secondary" className="mt-0.5">
                {detail}
              </Body>
            </View>
          </View>
        );
      })}
    </View>
  );
}
