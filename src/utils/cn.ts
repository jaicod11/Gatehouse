type ClassValue = string | false | null | undefined;

/**
 * Joins class names and skips falsy values. It doesn't resolve conflicting utilities, so UI
 * primitives expose variant props (tone, size, ...) rather than relying on className overrides.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
