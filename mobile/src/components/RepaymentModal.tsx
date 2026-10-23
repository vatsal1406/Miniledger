import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BorderRadius, Spacing } from '../constants/theme';
import { formatINR } from '../utils/format';

interface RepaymentModalProps {
  visible: boolean;
  loanId: string;
  friendName: string;
  remainingBalance: number;
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: number; notes?: string }) => Promise<void>;
}

export const RepaymentModal: React.FC<RepaymentModalProps> = ({
  visible,
  friendName,
  remainingBalance,
  isLoading,
  onClose,
  onSubmit,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleQuickPercent = (percent: number) => {
    const calculated = Math.round((remainingBalance * (percent / 100)) * 100) / 100;
    setAmountStr(calculated.toString());
    setError(null);
  };

  const handleSubmit = async () => {
    const num = parseFloat(amountStr);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a positive repayment amount');
      return;
    }

    if (num > remainingBalance + 0.001) {
      setError(`Amount cannot exceed remaining balance of ${formatINR(remainingBalance)}`);
      return;
    }

    setError(null);
    try {
      await onSubmit({ amount: num, notes: notes.trim() || undefined });
      setAmountStr('');
      setNotes('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record repayment');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Record Repayment</Text>
              <Text style={styles.subtitle}>From {friendName}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Balance info card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Current Outstanding Balance</Text>
            <Text style={styles.balanceValue}>{formatINR(remainingBalance)}</Text>
          </View>

          {/* Quick Percent Buttons */}
          <View style={styles.quickButtons}>
            <Pressable
              style={styles.quickBtn}
              onPress={() => handleQuickPercent(25)}>
              <Text style={styles.quickBtnText}>25%</Text>
            </Pressable>
            <Pressable
              style={styles.quickBtn}
              onPress={() => handleQuickPercent(50)}>
              <Text style={styles.quickBtnText}>50%</Text>
            </Pressable>
            <Pressable
              style={[styles.quickBtn, styles.fullBtn]}
              onPress={() => handleQuickPercent(100)}>
              <Text style={[styles.quickBtnText, styles.fullBtnText]}>Full Pay</Text>
            </Pressable>
          </View>

          {/* Amount input */}
          <Text style={styles.inputLabel}>Repayment Amount (INR) *</Text>
          <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
            <Text style={styles.rupeePrefix}>₹</Text>
            <TextInput
              style={styles.amountInput}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94A3B8"
              value={amountStr}
              onChangeText={(txt) => {
                setAmountStr(txt);
                setError(null);
              }}
              editable={!isLoading}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Optional notes */}
          <Text style={styles.inputLabel}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="e.g. Paid via GPay, Cash, Partial settlement"
            placeholderTextColor="#94A3B8"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            editable={!isLoading}
          />

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isLoading}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.submitBtn, isLoading && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>Save Repayment</Text>
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
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  dialog: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.one,
  },
  closeText: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.three,
    marginBottom: Spacing.three,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: Spacing.one + 4,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  fullBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  fullBtnText: {
    color: '#047857',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: Spacing.one,
    marginTop: Spacing.two,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  rupeePrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginRight: Spacing.one,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: Spacing.two + 2,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    padding: Spacing.two + 2,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  submitBtn: {
    flex: 2,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
