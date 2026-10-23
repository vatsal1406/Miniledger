import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Spacing } from '../constants/theme';

export type LoanStatus = 'ACTIVE' | 'PARTIALLY_REPAID' | 'REPAID' | 'OVERDUE';

interface StatusBadgeProps {
  status: LoanStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const norm = (status || 'ACTIVE').toUpperCase();

  let bg = '#F1F5F9';
  let border = '#CBD5E1';
  let text = '#475569';
  let label = 'Active';

  switch (norm) {
    case 'ACTIVE':
      bg = '#EFF6FF';
      border = '#BFDBFE';
      text = '#1D4ED8';
      label = 'Active';
      break;
    case 'PARTIALLY_REPAID':
      bg = '#F0FDFA';
      border = '#99F6E4';
      text = '#0F766E';
      label = 'Partially Repaid';
      break;
    case 'REPAID':
      bg = '#ECFDF5';
      border = '#A7F3D0';
      text = '#047857';
      label = 'Repaid';
      break;
    case 'OVERDUE':
      bg = '#FEF2F2';
      border = '#FECACA';
      text = '#B91C1C';
      label = 'Overdue';
      break;
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border },
        isSmall ? styles.badgeSm : styles.badgeMd,
      ]}>
      {norm === 'OVERDUE' && <View style={styles.dot} />}
      <Text style={[styles.text, { color: text }, isSmall ? styles.textSm : styles.textMd]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    gap: 4,
  },
  badgeMd: {
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: 4,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textSm: {
    fontSize: 11,
  },
  textMd: {
    fontSize: 12,
  },
});
