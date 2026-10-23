import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Spacing } from '../constants/theme';
import { formatDate, formatINR, formatRelativeDue, getInitials } from '../utils/format';
import { StatusBadge } from './StatusBadge';

export interface LoanItemData {
  id: string;
  friendName: string;
  amount: number;
  amountRepaid: number;
  remainingBalance: number;
  dueDate: string | Date;
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'REPAID' | 'OVERDUE' | string;
  notes?: string | null;
  receipt?: {
    id: string;
    url: string;
    publicId?: string | null;
    originalFilename?: string | null;
  } | null;
}

interface LoanCardProps {
  loan: LoanItemData;
  onPress: () => void;
}

export const LoanCard: React.FC<LoanCardProps> = ({ loan, onPress }) => {
  const isOverdue = loan.status === 'OVERDUE';
  const isRepaid = loan.status === 'REPAID';

  const relativeDue = formatRelativeDue(loan.dueDate, loan.remainingBalance);

  // Percentage repaid
  const percentRepaid = loan.amount > 0
    ? Math.min(100, Math.round((loan.amountRepaid / loan.amount) * 100))
    : 0;

  // Background tint when overdue
  const cardBorder = isOverdue ? '#FECACA' : '#E2E8F0';
  const cardBg = isOverdue ? '#FFFBFB' : '#FFFFFF';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBg, borderColor: cardBorder },
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <View style={styles.friendInfo}>
          <View style={[styles.avatar, isOverdue && styles.avatarOverdue]}>
            <Text style={[styles.avatarText, isOverdue && styles.avatarTextOverdue]}>
              {getInitials(loan.friendName)}
            </Text>
          </View>
          <View>
            <View style={styles.friendNameRow}>
              <Text style={styles.friendName}>{loan.friendName}</Text>
              {loan.receipt ? (
                <View style={styles.receiptChip}>
                  <Text style={styles.receiptChipText}>📎 Proof</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.dateText}>Due {formatDate(loan.dueDate)}</Text>
          </View>
        </View>

        <StatusBadge status={loan.status} />
      </View>

      {/* Financial Details */}
      <View style={styles.amountsRow}>
        <View>
          <Text style={styles.amountLabel}>Remaining</Text>
          <Text
            style={[
              styles.remainingText,
              isOverdue && styles.overdueText,
              isRepaid && styles.repaidText,
            ]}>
            {formatINR(loan.remainingBalance)}
          </Text>
        </View>

        <View style={styles.lentInfo}>
          <Text style={styles.amountLabel}>Original Loan</Text>
          <Text style={styles.originalAmount}>{formatINR(loan.amount)}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${percentRepaid}%`,
                backgroundColor: isRepaid ? '#10B981' : isOverdue ? '#EF4444' : '#0D9488',
              },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressSubtext}>
            {isRepaid ? '100% Repaid' : `${percentRepaid}% repaid (${formatINR(loan.amountRepaid)})`}
          </Text>
          <Text
            style={[
              styles.relativeDueText,
              relativeDue.isOverdue && styles.overdueBadgeText,
            ]}>
            {relativeDue.text}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.two + 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  avatarTextOverdue: {
    color: '#DC2626',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.two,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  remainingText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  overdueText: {
    color: '#DC2626',
  },
  repaidText: {
    color: '#059669',
  },
  lentInfo: {
    alignItems: 'flex-end',
  },
  originalAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  progressContainer: {
    marginTop: Spacing.one,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  progressSubtext: {
    fontSize: 11,
    color: '#94A3B8',
  },
  relativeDueText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  overdueBadgeText: {
    color: '#DC2626',
    fontWeight: '700',
  },
  friendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiptChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  receiptChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
});
