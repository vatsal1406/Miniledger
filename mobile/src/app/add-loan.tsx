import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DatePickerInput } from '../components/DatePickerInput';
import { BorderRadius, Spacing } from '../constants/theme';
import { useLoanMutations } from '../hooks/useLoansQuery';
import { api } from '../services/api';
import { formatINR } from '../utils/format';

export default function AddLoanScreen() {
  const router = useRouter();
  const { createLoanMutation, uploadReceiptMutation } = useLoanMutations();

  const [friendName, setFriendName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dueDate, setDueDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // Default to 2 weeks from now
    return d;
  });
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const pickReceipt = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const filename = asset.fileName || asset.uri.split('/').pop() || 'receipt.jpg';
        const mimeType = asset.mimeType || 'image/jpeg';
        setReceipt({
          uri: asset.uri,
          name: filename,
          type: mimeType,
        });
      }
    } catch (err: any) {
      console.warn('Image picker error:', err);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!friendName || !friendName.trim()) {
      newErrors['friendName'] = "Friend's name is required";
    }

    const num = parseFloat(amountStr);
    if (!amountStr || isNaN(num) || num <= 0) {
      newErrors['amount'] = 'Enter a valid positive loan amount in INR';
    }

    if (!dueDate || isNaN(dueDate.getTime())) {
      newErrors['dueDate'] = 'A valid due date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      let stagedReceiptData: {
        url: string;
        publicId: string;
        originalFilename: string;
        mimeType: string;
        sizeBytes: number;
      } | null = null;

      if (receipt) {
        // Safe staged upload: upload receipt image to storage before creating the loan
        const stageRes = await api.stageReceipt(receipt.uri, receipt.type, receipt.name);
        if (!stageRes.success || !stageRes.data) {
          throw new Error(stageRes.error || 'Failed to upload receipt image. Please try another image.');
        }
        stagedReceiptData = stageRes.data;
      }

      // Create loan and associate receipt atomically in the database
      await createLoanMutation.mutateAsync({
        friendName: friendName.trim(),
        amount: parseFloat(amountStr),
        dueDate: dueDate.toISOString(),
        notes: notes.trim() || undefined,
        receipt: stagedReceiptData,
      });

      // Reset form & navigate to loans
      setFriendName('');
      setAmountStr('');
      setNotes('');
      setReceipt(null);
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 14);
      setDueDate(defaultDue);
      router.replace('/loans' as any);
    } catch (err: any) {
      setServerError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick amount suggestions
  const setQuickAmount = (val: number) => {
    setAmountStr(val.toString());
    if (errors['amount']) {
      setErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>New Loan</Text>
            <Text style={styles.subtitle}>
              Record money lent to a friend with due date and balance tracking.
            </Text>
          </View>

          {serverError && (
            <View style={styles.serverErrorBox}>
              <Text style={styles.serverErrorText}>{serverError}</Text>
            </View>
          )}

          <View style={styles.card}>
            {/* Friend Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Friend's Name *</Text>
              <TextInput
                style={[styles.textInput, errors['friendName'] ? styles.inputError : null]}
                placeholder="e.g. Rahul Verma"
                placeholderTextColor="#94A3B8"
                value={friendName}
                onChangeText={(txt) => {
                  setFriendName(txt);
                  if (errors['friendName']) {
                    setErrors((prev) => ({ ...prev, friendName: '' }));
                  }
                }}
                autoCapitalize="words"
                editable={!isSubmitting}
              />
              {errors['friendName'] ? (
                <Text style={styles.errorText}>{errors['friendName']}</Text>
              ) : null}
            </View>

            {/* Loan Amount */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Loan Amount (INR) *</Text>
              <View style={[styles.amountWrapper, errors['amount'] ? styles.inputError : null]}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="5,000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={amountStr}
                  onChangeText={(txt) => {
                    setAmountStr(txt.replace(/[^0-9.]/g, ''));
                    if (errors['amount']) {
                      setErrors((prev) => ({ ...prev, amount: '' }));
                    }
                  }}
                  editable={!isSubmitting}
                />
              </View>

              {/* Quick Amount Chips */}
              <View style={styles.quickChips}>
                {[1000, 2500, 5000, 10000, 20000].map((amt) => (
                  <Pressable
                    key={amt}
                    style={styles.chip}
                    onPress={() => setQuickAmount(amt)}
                    disabled={isSubmitting}>
                    <Text style={styles.chipText}>{formatINR(amt)}</Text>
                  </Pressable>
                ))}
              </View>

              {errors['amount'] ? <Text style={styles.errorText}>{errors['amount']}</Text> : null}
            </View>

            {/* Due Date */}
            <DatePickerInput
              label="Expected Due Date *"
              value={dueDate}
              onChange={(d) => {
                setDueDate(d);
                if (errors['dueDate']) {
                  setErrors((prev) => ({ ...prev, dueDate: '' }));
                }
              }}
              error={errors['dueDate']}
            />

            {/* Optional Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notes / Purpose (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="e.g. Split for dinner, flight tickets, urgent medical expense"
                placeholderTextColor="#94A3B8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                editable={!isSubmitting}
              />
            </View>

            {/* Optional Receipt Attachment */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Receipt Photo (Optional)</Text>
              {receipt ? (
                <View style={styles.receiptPreviewCard}>
                  <Image source={{ uri: receipt.uri }} style={styles.receiptThumb} contentFit="cover" />
                  <View style={styles.receiptDetails}>
                    <Text style={styles.receiptName} numberOfLines={1}>{receipt.name}</Text>
                    <View style={styles.receiptBtnRow}>
                      <Pressable style={styles.receiptChangeBtn} onPress={pickReceipt} disabled={isSubmitting}>
                        <Text style={styles.receiptChangeText}>Change</Text>
                      </Pressable>
                      <Pressable style={styles.receiptRemoveBtn} onPress={() => setReceipt(null)} disabled={isSubmitting}>
                        <Text style={styles.receiptRemoveText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable style={styles.attachBtn} onPress={pickReceipt} disabled={isSubmitting}>
                  <Text style={styles.attachIcon}>📷</Text>
                  <View>
                    <Text style={styles.attachTitle}>Attach Receipt or Bill</Text>
                    <Text style={styles.attachSubtitle}>JPG, PNG, WebP up to 5MB</Text>
                  </View>
                </Pressable>
              )}
            </View>

            {/* Submit Button */}
            <Pressable
              style={[styles.submitBtn, isSubmitting && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Create Loan</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 90,
  },
  header: {
    marginBottom: Spacing.four,
    marginTop: Spacing.two,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  serverErrorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  serverErrorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldGroup: {
    marginBottom: Spacing.four,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: Spacing.one,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    fontSize: 15,
    color: '#0F172A',
  },
  amountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.three,
  },
  rupeeSymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: Spacing.one,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: Spacing.two + 3,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  quickChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
    marginTop: Spacing.two,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.two + 2,
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    fontSize: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: Spacing.three + 3,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  attachIcon: {
    fontSize: 24,
  },
  attachTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  attachSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  receiptPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    padding: Spacing.two + 2,
    gap: Spacing.three,
  },
  receiptThumb: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#E2E8F0',
  },
  receiptDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  receiptName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },
  receiptBtnRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  receiptChangeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#E2E8F0',
  },
  receiptChangeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  receiptRemoveBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#FEE2E2',
  },
  receiptRemoveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
});
