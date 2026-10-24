import { LinearGradient } from 'expo-linear-gradient';
import { Castle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, gradients, shadows } from '@/constants/theme';

/** Gatehouse app mark: the brand gradient in a rounded square with a castle glyph. */
export function LogoMark({ size = 48 }: { size?: number }) {
  const corner = Math.round(size * 0.3);
  return (
    <View
      role="img"
      aria-label="Gatehouse"
      style={{ width: size, height: size, borderRadius: corner, boxShadow: shadows.glow }}
    >
      <View
        className="flex-1 items-center justify-center overflow-hidden"
        style={{ borderRadius: corner }}
      >
        <LinearGradient
          colors={gradients.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Wrapped so web paints the SVG above the absolutely positioned gradient. */}
        <View>
          <Castle size={size * 0.5} color={colors.text.primary} strokeWidth={2.25} />
        </View>
      </View>
    </View>
  );
}
