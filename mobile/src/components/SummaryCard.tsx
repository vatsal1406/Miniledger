import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Spacing } from '../constants/theme';
import { formatINR } from '../utils/format';

interface SummaryCardProps {
  title: string;
  amount: number;
  subtitle?: string;
  badge?: string;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'neutral';
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  amount,
  subtitle,
  badge,
  variant = 'neutral',
}) => {
  let accentColor = '#64748B';
  let bg = '#FFFFFF';
  let border = '#E2E8F0';
  let badgeBg = '#F1F5F9';
  let badgeText = '#475569';

  switch (variant) {
    case 'primary':
      accentColor = '#0F172A';
      border = '#CBD5E1';
      break;
    case 'success':
      accentColor = '#059669';
      border = '#A7F3D0';
      badgeBg = '#ECFDF5';
      badgeText = '#047857';
      break;
    case 'danger':
      accentColor = '#DC2626';
      border = '#FECACA';
      badgeBg = '#FEF2F2';
      badgeText = '#B91C1C';
      break;
    case 'warning':
      accentColor = '#D97706';
      border = '#FDE68A';
      badgeBg = '#FFFBEB';
      badgeText = '#B45309';
      break;
  }

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {badge && (
          <View style={[styles.badgeContainer, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeText }]}>{badge}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.amount, { color: accentColor }]}>{formatINR(amount)}</Text>

      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  badgeContainer: {
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
