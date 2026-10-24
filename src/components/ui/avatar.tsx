import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { cn } from '@/utils/cn';
import { getInitials } from '@/utils/initials';

import { Text } from './typography';

const sizes = { sm: 32, md: 40, lg: 56, xl: 80 } as const;

const fallbackGradients = [
  [colors.accent.indigo, colors.accent.violet],
  [colors.accent.violet, colors.accent.cyan],
  [colors.accent.indigo, colors.accent.cyan],
] as const;

/** Picks a stable gradient per name so a person keeps the same colors everywhere. */
function gradientFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return fallbackGradients[Math.abs(hash) % fallbackGradients.length];
}

export type AvatarProps = {
  /** Photo URL. Falls back to initials when missing or when it fails to load. */
  uri?: string | null;
  /** Display name or email, used for initials and the accessibility label. */
  name?: string | null;
  size?: keyof typeof sizes;
  /** Subtle outline, for avatars on busy backgrounds. */
  ring?: boolean;
  className?: string;
};

export function Avatar({ uri, name, size = 'md', ring = false, className }: AvatarProps) {
  // Track the URL that failed, not a boolean, so a new `uri` gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = !!uri && uri !== failedUri;
  const initials = getInitials(name);
  const diameter = sizes[size];

  return (
    <View
      role="img"
      aria-label={name ?? 'User avatar'}
      className={cn(
        'items-center justify-center overflow-hidden rounded-full bg-surface-elevated',
        ring && 'border-2 border-white/15',
        className,
      )}
      style={{ width: diameter, height: diameter }}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          onError={() => setFailedUri(uri)}
        />
      ) : (
        <>
          <LinearGradient
            colors={gradientFor(name ?? '')}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.muted]}
          />
          {initials ? (
            <Text weight="semibold" selectable={false} style={{ fontSize: diameter * 0.38 }}>
              {initials}
            </Text>
          ) : (
            // Wrapped so web paints the SVG above the absolutely positioned gradient.
            <View>
              <User size={diameter * 0.5} color={colors.text.primary} strokeWidth={2} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { opacity: 0.85 },
});
