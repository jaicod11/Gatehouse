import { createContext, useContext, type RefObject } from 'react';
import type { View } from 'react-native';

/**
 * On Android, expo-blur can only blur what's inside a BlurTargetView. Screen wraps its background
 * in one and shares the ref here so every GlassCard on that screen can blur it.
 */
export const BlurTargetContext = createContext<RefObject<View | null> | undefined>(undefined);

export function useBlurTarget(): RefObject<View | null> | undefined {
  return useContext(BlurTargetContext);
}
