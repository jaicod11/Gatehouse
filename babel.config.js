// NativeWind v4 setup: https://www.nativewind.dev/docs/getting-started/installation
// babel-preset-expo adds the react-native-worklets plugin for Reanimated 4 automatically.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
