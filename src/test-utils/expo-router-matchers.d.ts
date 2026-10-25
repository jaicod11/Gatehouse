// expo-router/testing-library registers this Jest matcher at runtime, but SDK 57 doesn't ship its
// type. Remove once expo-router provides it.
declare global {
  namespace jest {
    interface Matchers<R> {
      /** Asserts the current route's pathname, e.g. `expect(screen).toHavePathname('/login')`. */
      toHavePathname(pathname: string): R;
    }
  }
}

export {};
