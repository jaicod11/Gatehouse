// Runs before each test file (setupFilesAfterEnv in package.json).

// Jest doesn't load .env. Tests fake the Supabase client, so these only keep src/config/env.ts from
// warning about missing variables. The allowed domain is left alone: tests read env.allowedDomain.
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://test-project.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-publishable-key';

// Reanimated's Jest mock, which expo-router/testing-library installs, imports react-native-worklets,
// and its native module doesn't exist under Jest. Worklets ships a mock for this.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Use Reanimated's mock everywhere, not only in router tests. It leaves useReducedMotion
// unimplemented ("ADD ME IF NEEDED"), and GradientBackground calls it.
const mockReanimated = require('react-native-reanimated/mock');
mockReanimated.useReducedMotion = () => false;
jest.mock('react-native-reanimated', () => mockReanimated);
