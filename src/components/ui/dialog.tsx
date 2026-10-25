import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, shadows } from '@/constants/theme';

import { Button, type IconComponent } from './button';
import { Body, Heading } from './typography';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: IconComponent;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Themed confirmation dialog: React Native's Modal, so it works the same on web (focus trap,
 * Escape closes it) and native (Android back button closes it).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  icon: Icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center px-4">
        <Pressable
          accessibilityLabel="Close dialog"
          onPress={onCancel}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <View
          testID="confirm-dialog"
          role="dialog"
          aria-modal
          aria-label={title}
          className="w-full max-w-[420px] rounded-card border border-border-strong bg-surface-elevated p-6"
          style={styles.shadow}
        >
          {Icon ? (
            <View className="size-11 items-center justify-center rounded-lg border border-accent-violet/40 bg-accent-violet/15">
              <Icon size={20} color={colors.accent.cyan} strokeWidth={2} />
            </View>
          ) : null}
          <Heading level={3} className={Icon ? 'mt-4' : undefined}>
            {title}
          </Heading>
          <Body tone="secondary" className="mt-2">
            {message}
          </Body>
          <View className="mt-6 flex-row flex-wrap justify-end gap-3">
            <Button variant="secondary" label={cancelLabel} onPress={onCancel} />
            <Button label={confirmLabel} onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(3, 4, 8, 0.72)',
  },
  shadow: {
    boxShadow: shadows.card,
  },
});
