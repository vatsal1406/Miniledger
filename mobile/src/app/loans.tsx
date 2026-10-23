import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LoanCard } from '../components/LoanCard';
import { DetailedLoan, LoanDetailModal } from '../components/LoanDetailModal';
import { BorderRadius, Spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

import { useLoansQuery, useLoanMutations } from '../hooks/useLoansQuery';

type FilterStatus = 'ALL' | 'ACTIVE' | 'OVERDUE' | 'REPAID';

export default function LoansScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [selectedLoan, setSelectedLoan] = useState<DetailedLoan | null>(null);

  const {
    data: loans = [],
    isLoading,
    refetch,
    isRefetching,
  } = useLoansQuery(statusFilter, search);

  const {
    recordRepaymentMutation,
    markRepaidMutation,
    uploadReceiptMutation,
    deleteReceiptMutation,
  } = useLoanMutations();

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleOpenLoan = async (loanId: string) => {
    try {
      const res = await api.getLoanById(loanId);
      if (res.success && res.data) {
        setSelectedLoan(res.data);
      }
    } catch (err) {
      console.warn('Failed to load loan details:', err);
    }
  };

  const handleRecordRepayment = async (loanId: string, amount: number, notes?: string) => {
    await recordRepaymentMutation.mutateAsync({ loanId, amount, notes });
    const refreshed = await api.getLoanById(loanId);
    if (refreshed.success) setSelectedLoan(refreshed.data);
  };

  const handleMarkRepaid = async (loanId: string) => {
    await markRepaidMutation.mutateAsync({ loanId });
    const refreshed = await api.getLoanById(loanId);
    if (refreshed.success) setSelectedLoan(refreshed.data);
  };

  const handleAttachReceipt = async (loanId: string, uri: string, mimeType?: string, name?: string) => {
    await uploadReceiptMutation.mutateAsync({ loanId, fileUri: uri, mimeType, filename: name });
    const refreshed = await api.getLoanById(loanId);
    if (refreshed.success) setSelectedLoan(refreshed.data);
  };

  const handleDeleteReceipt = async (loanId: string) => {
    await deleteReceiptMutation.mutateAsync(loanId);
    const refreshed = await api.getLoanById(loanId);
    if (refreshed.success) setSelectedLoan(refreshed.data);
  };

  const filterTabs: { key: FilterStatus; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'OVERDUE', label: 'Overdue' },
    { key: 'REPAID', label: 'Repaid' },
  ];

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Loans</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push('/add-loan' as any)}>
            <Text style={styles.addBtnText}>+ New Loan</Text>
          </Pressable>
        </View>

        {/* Search input */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by friend's name..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Status Filter Chips */}
        <View style={styles.filterRow}>
          {filterTabs.map((tab) => {
            const isSelected = statusFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive,
                  tab.key === 'OVERDUE' && isSelected && styles.filterChipOverdue,
                ]}
                onPress={() => setStatusFilter(tab.key)}>
                <Text
                  style={[
                    styles.filterChipText,
                    isSelected && styles.filterChipTextActive,
                    tab.key === 'OVERDUE' && isSelected && styles.filterChipTextOverdue,
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* List Content */}
        {isLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#0F172A" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollList}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#0F172A" />
            }>
            {loans.length > 0 ? (
              loans.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  onPress={() => handleOpenLoan(loan.id)}
                />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🔎</Text>
                <Text style={styles.emptyTitle}>No matching loans found</Text>
                <Text style={styles.emptySubtext}>
                  {search
                    ? `No loans matching "${search}". Try searching another name.`
                    : statusFilter !== 'ALL'
                    ? `No loans currently in ${statusFilter.toLowerCase()} status.`
                    : 'You haven’t added any loans yet.'}
                </Text>
                {search || statusFilter !== 'ALL' ? (
                  <Pressable
                    style={styles.resetFilterBtn}
                    onPress={() => {
                      setSearch('');
                      setStatusFilter('ALL');
                    }}>
                    <Text style={styles.resetFilterBtnText}>Reset Filters</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.createLoanBtn}
                    onPress={() => router.push('/add-loan' as any)}>
                    <Text style={styles.createLoanBtnText}>+ Add Loan</Text>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Detailed Loan Modal */}
      <LoanDetailModal
        visible={!!selectedLoan}
        loan={selectedLoan}
        onClose={() => setSelectedLoan(null)}
        onRecordRepayment={handleRecordRepayment}
        onMarkRepaid={handleMarkRepaid}
        onAttachReceipt={handleAttachReceipt}
        onDeleteReceipt={handleDeleteReceipt}
      />
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
    maxWidth: 750,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  addBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: Spacing.two + 1,
    paddingHorizontal: Spacing.three,
    borderRadius: BorderRadius.md,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    marginBottom: Spacing.three,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  clearSearchBtn: {
    padding: Spacing.one,
  },
  clearSearchText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  filterChip: {
    paddingVertical: Spacing.one + 3,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipTextOverdue: {
    color: '#DC2626',
    fontWeight: '700',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollList: {
    paddingBottom: 90,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.six,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: Spacing.four,
    maxWidth: 280,
  },
  resetFilterBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
  },
  resetFilterBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  createLoanBtn: {
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.md,
  },
  createLoanBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
