import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Caption } from '@/components/ui';
import { cn } from '@/utils/cn';

/** Small footer with the app name and a link to the privacy policy. */
export function PageFooter({ className }: { className?: string }) {
  return (
    <View className={cn('flex-row items-center justify-center gap-2', className)}>
      <Caption>Gatehouse</Caption>
      <Caption aria-hidden>·</Caption>
      <Link href="/privacy" asChild>
        <Pressable role="link" hitSlop={8} className="rounded-sm hover:opacity-80">
          <Caption tone="secondary">Privacy</Caption>
        </Pressable>
      </Link>
    </View>
  );
}
