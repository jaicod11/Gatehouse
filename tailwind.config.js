// Design tokens live in src/constants/theme.ts so app code can read the same values; this file maps
// them onto Tailwind's theme. Restart Metro with `npx expo start -c` after changing either file.
const { colors, fonts, radius } = require('./src/constants/theme');

const fallbackFonts = ['system-ui', 'sans-serif'];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app is dark-only and uses no `dark:` variants. 'class' (rather than the default 'media')
  // avoids a NativeWind web dev error when global.css is injected after its runtime loads:
  // "Cannot manually set color scheme, as dark mode is type 'media'".
  darkMode: 'class',
  // Each Plus Jakarta Sans weight is its own font family, so `font-medium`, `font-semibold` and
  // `font-bold` select a family (see fontFamily below) instead of setting fontWeight. Pairing a
  // custom family with fontWeight makes browsers synthesize faux bold and matches unreliably on
  // native.
  corePlugins: { fontWeight: false },
  theme: {
    extend: {
      colors: {
        background: colors.background,
        surface: { DEFAULT: colors.surface, elevated: colors.surfaceElevated },
        border: { DEFAULT: colors.border, strong: colors.borderStrong },
        fg: {
          DEFAULT: colors.text.primary,
          secondary: colors.text.secondary,
          muted: colors.text.muted,
        },
        accent: { DEFAULT: colors.accent.violet, ...colors.accent },
        success: colors.success,
        error: colors.error,
        warning: colors.warning,
      },
      borderColor: { DEFAULT: colors.border },
      fontFamily: {
        sans: [fonts.regular, ...fallbackFonts],
        normal: [fonts.regular, ...fallbackFonts],
        medium: [fonts.medium, ...fallbackFonts],
        semibold: [fonts.semibold, ...fallbackFonts],
        bold: [fonts.bold, ...fallbackFonts],
      },
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([name, value]) => [name, `${value}px`]),
      ),
    },
  },
  plugins: [],
};
