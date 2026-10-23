import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Spacing } from '../constants/theme';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'success' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  let confirmBg = '#0F172A';
  if (variant === 'danger') confirmBg = '#EF4444';
  if (variant === 'success') confirmBg = '#10B981';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.cancelBtn]}
              onPress={onCancel}
              disabled={isLoading}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.confirmBtn, { backgroundColor: confirmBg }]}
              onPress={onConfirm}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: Spacing.two,
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: Spacing.four,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  btn: {
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three + 2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  cancelText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    backgroundColor: '#0F172A',
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
