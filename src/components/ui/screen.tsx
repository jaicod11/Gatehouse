import { BlurTargetView } from 'expo-blur';
import { useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/utils/cn';

import { BlurTargetContext } from './blur-target';

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

export type ScreenProps = ViewProps & {
  /** Classes for the content container (padding, alignment, gap). */
  className?: string;
  /** Rendered full-bleed behind the content, under the safe areas, e.g. `<GradientBackground />`. */
  background?: ReactNode;
  /** Scroll the content instead of fixing it to the viewport. */
  scroll?: boolean;
  /** Which safe-area insets to pad. Defaults to all four. */
  edges?: readonly Edge[];
};

/** Full-screen dark page with safe-area padding and an optional backdrop. */
export function Screen({
  children,
  className,
  background,
  scroll = false,
  edges = ALL_EDGES,
  ...contentProps
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<View>(null);

  // Insets pad a wrapper rather than the content View, so they add to the content's own padding
  // classes instead of overriding them.
  const insetPadding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
  };

  // In a ScrollView the content must grow from its natural height: `flex-1` (zero basis) would cap
  // it at the viewport and leave the overflow unscrollable.
  const content = (
    <View className={cn(scroll ? 'grow' : 'flex-1', className)} {...contentProps}>
      {children}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      {background ? (
        <BlurTargetView ref={blurTargetRef} style={[StyleSheet.absoluteFill, styles.passThrough]}>
          {background}
        </BlurTargetView>
      ) : null}

      <BlurTargetContext value={background ? blurTargetRef : undefined}>
        {scroll ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={[styles.grow, insetPadding]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          <View className="flex-1" style={insetPadding}>
            {content}
          </View>
        )}
      </BlurTargetContext>
    </View>
  );
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
  grow: { flexGrow: 1 },
});
