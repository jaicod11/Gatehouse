const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem: 16 keeps rem-based utilities (p-4, text-base, ...) the same size on native as on web.
// NativeWind's default is 14.
module.exports = withNativeWind(config, { input: './src/global.css', inlineRem: 16 });
