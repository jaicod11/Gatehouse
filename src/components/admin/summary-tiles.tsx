import { ShieldCheck, UserRound, Users } from 'lucide-react-native';
import { View } from 'react-native';

import { Appear, GlassCard, Skeleton, Text, type IconComponent } from '@/components/ui';
import { colors } from '@/constants/theme';
import type { RoleCounts } from '@/utils/profile-list';

const TILES: { key: keyof RoleCounts; label: string; icon: IconComponent }[] = [
  { key: 'total', label: 'Total users', icon: Users },
  { key: 'admins', label: 'Admins', icon: ShieldCheck },
  { key: 'users', label: 'Users', icon: UserRound },
];

/** Counts from the loaded profiles. Null while loading (skeletons) or after an error (dashes). */
export function SummaryTiles({
  counts,
  loading,
  startIndex = 0,
}: {
  counts: RoleCounts | null;
  loading: boolean;
  startIndex?: number;
}) {
  return (
    <View className="flex-row gap-3 md:gap-4">
      {TILES.map(({ key, label, icon: Icon }, index) => {
        const value = counts ? String(counts[key]) : '—';
        return (
          <Appear key={key} index={startIndex + index} style={{ flex: 1 }}>
            <GlassCard padding="sm">
              <View aria-label={loading ? `${label}: loading` : `${label}: ${value}`}>
                <Icon size={18} color={colors.text.secondary} strokeWidth={2} />
                <View className="mt-3 h-8 justify-center">
                  {loading ? (
                    <Skeleton width={36} height={24} />
                  ) : (
                    <Text weight="bold" className="text-2xl leading-8 tracking-[-0.5px]">
                      {value}
                    </Text>
                  )}
                </View>
                {/* Smaller on phones so "Total users" fits a third of a 360px screen. */}
                <Text
                  tone="secondary"
                  numberOfLines={1}
                  className="text-xs leading-4 md:text-sm md:leading-5"
                >
                  {label}
                </Text>
              </View>
            </GlassCard>
          </Appear>
        );
      })}
    </View>
  );
}
