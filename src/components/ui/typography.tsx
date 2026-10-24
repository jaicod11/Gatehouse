import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '@/utils/cn';

export type TextTone =
  'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error';

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold';

const toneClass: Record<TextTone, string> = {
  primary: 'text-fg',
  secondary: 'text-fg-secondary',
  muted: 'text-fg-muted',
  accent: 'text-accent-cyan',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

const weightClass: Record<TextWeight, string> = {
  regular: 'font-sans',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export type TextProps = RNTextProps & {
  /** Layout and size classes. Set color and weight with `tone` and `weight`, not classes. */
  className?: string;
  tone?: TextTone;
  weight?: TextWeight;
};

/** Base text in Plus Jakarta Sans. Prefer Heading, Body or Caption. */
export function Text({ className, tone = 'primary', weight = 'regular', ...props }: TextProps) {
  return <RNText className={cn(weightClass[weight], toneClass[tone], className)} {...props} />;
}

const headingClass = {
  1: 'text-4xl leading-[44px] tracking-[-1px] md:text-5xl md:leading-[56px] md:tracking-[-1.5px]',
  2: 'text-2xl leading-8 tracking-[-0.5px] md:text-3xl md:leading-9',
  3: 'text-lg leading-7 tracking-[-0.25px]',
} as const;

export type HeadingProps = Omit<TextProps, 'weight'> & {
  /** Visual size and semantic heading level (renders <h1>-<h3> on web). */
  level?: 1 | 2 | 3;
};

export function Heading({ level = 1, className, ...props }: HeadingProps) {
  return (
    <Text
      role="heading"
      aria-level={level}
      weight={level === 3 ? 'semibold' : 'bold'}
      className={cn(headingClass[level], className)}
      {...props}
    />
  );
}

const bodyClass = {
  sm: 'text-sm leading-5',
  md: 'text-base leading-6',
  lg: 'text-lg leading-7',
} as const;

export type BodyProps = TextProps & {
  size?: keyof typeof bodyClass;
};

export function Body({ size = 'md', className, ...props }: BodyProps) {
  return <Text className={cn(bodyClass[size], className)} {...props} />;
}

export type CaptionProps = TextProps & {
  /** `overline`: small uppercase label for eyebrows and section titles. */
  variant?: 'default' | 'overline';
};

export function Caption({
  variant = 'default',
  tone = 'muted',
  weight,
  className,
  ...props
}: CaptionProps) {
  const overline = variant === 'overline';
  return (
    <Text
      tone={tone}
      weight={weight ?? (overline ? 'semibold' : 'medium')}
      className={cn(
        overline ? 'text-[11px] uppercase leading-4 tracking-[1.4px]' : 'text-xs leading-4',
        className,
      )}
      {...props}
    />
  );
}
