import { CircleAlert, CircleCheck, Info, X } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadows } from '@/constants/theme';

import type { IconComponent } from './button';
import { Body, Text } from './typography';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastOptions = {
  tone?: ToastTone;
  title: string;
  message?: string;
};

type Toast = ToastOptions & { id: number };

type ToastContextValue = {
  show: (toast: ToastOptions) => void;
  dismiss: (id: number) => void;
};

const DURATION_MS = 4500;
const MAX_VISIBLE = 3;

const toneLook: Record<ToastTone, { icon: IconComponent; color: string }> = {
  success: { icon: CircleCheck, color: colors.success },
  error: { icon: CircleAlert, color: colors.error },
  info: { icon: Info, color: colors.accent.cyan },
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Shows short, auto-dismissing messages above every screen. Wrap the app in it once. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { ...options, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>.');
  return value;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.viewport, { paddingTop: insets.top + 12 }]}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </View>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const look = toneLook[toast.tone ?? 'info'];
  const Icon = look.icon;
  return (
    <Animated.View
      entering={FadeInUp.duration(260)}
      exiting={FadeOutUp.duration(200)}
      style={styles.card}
    >
      <View
        role={toast.tone === 'error' ? 'alert' : 'status'}
        aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
        className="flex-row items-start gap-3 rounded-lg border border-border-strong bg-surface-elevated p-3.5"
        style={styles.shadow}
      >
        <View className="pt-0.5">
          <Icon size={18} color={look.color} strokeWidth={2.25} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text weight="semibold" className="text-sm leading-5">
            {toast.title}
          </Text>
          {toast.message ? (
            <Body size="sm" tone="secondary">
              {toast.message}
            </Body>
          ) : null}
        </View>
        <Pressable
          role="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={8}
          onPress={onDismiss}
          className="-m-1 rounded-md p-1 hover:bg-white/10 active:bg-white/10"
        >
          <X size={16} color={colors.text.secondary} strokeWidth={2.25} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  },
  card: {
    width: '100%',
    maxWidth: 420,
  },
  shadow: {
    boxShadow: shadows.card,
  },
});
