/**
 * Gatehouse design tokens: the single source of truth for color, type, radius and shadow.
 *
 * tailwind.config.js builds the Tailwind theme from this file, so each token is both a class
 * (`bg-surface`, `text-fg-muted`, `rounded-card`) and a plain value for places classes can't reach
 * (gradients, SVG fills, Reanimated styles, BlurView).
 *
 * Node also evaluates this file when Tailwind loads its config, so keep it plain data with no
 * imports.
 */

export const colors = {
  /** Near-black with a blue tint. Tailwind: `bg-background`. */
  background: '#07080D',
  /** Tailwind: `bg-surface`. */
  surface: '#0F1117',
  /** Tailwind: `bg-surface-elevated`. */
  surfaceElevated: '#161925',
  /** Tailwind: `border-border` (also the default for a bare `border`). */
  border: 'rgba(255, 255, 255, 0.08)',
  /** Tailwind: `border-border-strong`. */
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  /** Tailwind: `text-fg`, `text-fg-secondary`, `text-fg-muted`. */
  text: {
    primary: '#F5F7FA',
    secondary: '#9AA3B2',
    /** 3.3:1 on `background`: decorative or large text only, not essential copy. */
    muted: '#5C6475',
  },
  /** Tailwind: `bg-accent` (violet), `text-accent-cyan`, ... */
  accent: {
    indigo: '#6366F1',
    violet: '#8B5CF6',
    cyan: '#22D3EE',
  },
  success: '#22C55E',
  error: '#F43F5E',
  warning: '#F59E0B',
} as const;

export const gradients = {
  /** Brand gradient: primary buttons, logo mark, highlights. */
  accent: [colors.accent.indigo, colors.accent.violet, colors.accent.cyan],
  /** Base wash behind the animated orbs. */
  backdrop: ['#0B0D18', colors.background],
} as const;

/** The translucent layers GlassCard stacks over its blur. */
export const glass = {
  tint: 'rgba(15, 17, 23, 0.55)',
  sheen: ['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.01)'],
  highlight: 'rgba(255, 255, 255, 0.18)',
  /** Web backdrop-filter radius in px. Native uses BlurView intensity instead. */
  webBlur: 24,
} as const;

/**
 * Plus Jakarta Sans, one family name per weight. These are the keys passed to useFonts in the root
 * layout. Tailwind: `font-sans` (regular), `font-medium`, `font-semibold`, `font-bold`.
 */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

/** Corner radii in px. Tailwind: `rounded-lg`, `rounded-card`, ... */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
  /** Buttons and inputs. */
  control: 16,
  /** Cards and sheets. */
  card: 24,
} as const;

/** CSS box-shadow strings, applied through the `boxShadow` style prop (web and native). */
export const shadows = {
  card: '0px 24px 64px -16px rgba(0, 0, 0, 0.65)',
  glow: '0px 10px 32px -10px rgba(139, 92, 246, 0.7)',
} as const;
