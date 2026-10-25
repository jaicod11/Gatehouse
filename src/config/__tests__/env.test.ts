/** Loads src/config/env.ts afresh with EXPO_PUBLIC_GOOGLE_HD_HINT set to `value` (undefined: unset). */
function googleHdHintWith(value: string | undefined): boolean | undefined {
  const saved = process.env.EXPO_PUBLIC_GOOGLE_HD_HINT;
  if (value === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_HD_HINT;
  else process.env.EXPO_PUBLIC_GOOGLE_HD_HINT = value;

  try {
    let hint: boolean | undefined;
    jest.isolateModules(() => {
      hint = jest.requireActual<typeof import('@/config/env')>('@/config/env').env.googleHdHint;
    });
    return hint;
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_HD_HINT;
    else process.env.EXPO_PUBLIC_GOOGLE_HD_HINT = saved;
  }
}

describe('env.googleHdHint', () => {
  it('is on when EXPO_PUBLIC_GOOGLE_HD_HINT is unset', () => {
    expect(googleHdHintWith(undefined)).toBe(true);
  });

  it('is off only for the exact string "false"', () => {
    expect(googleHdHintWith('false')).toBe(false);
  });

  it.each(['true', 'FALSE', 'False', '0', 'no', 'off', ''])('stays on for %j', (value) => {
    expect(googleHdHintWith(value)).toBe(true);
  });
});
