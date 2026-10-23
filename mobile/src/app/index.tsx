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
  View,
} from 'react-native';
import { AuthModal } from '../components/AuthModal';
import { LoanCard } from '../components/LoanCard';
import { DetailedLoan, LoanDetailModal } from '../components/LoanDetailModal';
import { SummaryCard } from '../components/SummaryCard';
import { BorderRadius, Spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatINR } from '../utils/format';
import { useDashboardQuery, useLoanMutations } from '../hooks/useLoansQuery';

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();

  const { data: summary, isLoading, error: queryError, refetch, isRefetching } = useDashboardQuery();
  const {
    recordRepaymentMutation,
    markRepaidMutation,
    uploadReceiptMutation,
    deleteReceiptMutation,
    invalidateAll,
  } = useLoanMutations();

  const [selectedLoan, setSelectedLoan] = useState<DetailedLoan | null>(null);

  const error = queryError ? (queryError as Error).message : null;

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

  const handleSeedSamples = async () => {
    await api.seedSampleLoans();
    invalidateAll();
  };

  if (authLoading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#0F172A" />
        }>
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>MiniLedger</Text>
            <Text style={styles.userPhone}>
              {user?.name ? `${user.name} • +91 ${user.phone}` : user ? `+91 ${user.phone}` : 'Sign in to track loans'}
            </Text>
          </View>

          <Pressable
            style={styles.addLoanHeaderBtn}
            onPress={() => router.push('/add-loan' as any)}>
            <Text style={styles.addLoanHeaderBtnText}>+ Add Loan</Text>
          </Pressable>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={styles.loadingText}>Loading your ledger...</Text>
          </View>
        ) : (
          <>
            {/* Hero Card: Total Outstanding */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <Text style={styles.heroTitle}>Total Outstanding</Text>
                {summary && summary.overdueAmount > 0 && (
                  <View style={styles.heroOverdueBadge}>
                    <Text style={styles.heroOverdueBadgeText}>
                      {formatINR(summary.overdueAmount)} Overdue
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.heroAmount}>{formatINR(summary?.outstanding || 0)}</Text>

              <View style={styles.heroFooter}>
                <Text style={styles.heroFooterText}>
                  {summary?.activeLoansCount || 0} active loan
                  {summary?.activeLoansCount === 1 ? '' : 's'}
                </Text>
                {summary && summary.overdueLoansCount > 0 && (
                  <Text style={styles.heroOverdueText}>
                    • {summary.overdueLoansCount} overdue
                  </Text>
                )}
              </View>
            </View>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricRow}>
                <SummaryCard
                  title="Total Lent"
                  amount={summary?.totalLent || 0}
                  variant="primary"
                />
                <SummaryCard
                  title="Total Repaid"
                  amount={summary?.totalRepaid || 0}
                  variant="success"
                  badge={
                    (summary?.totalLent ?? 0) > 0
                      ? `${Math.round(((summary?.totalRepaid || 0) / (summary?.totalLent || 1)) * 100)}%`
                      : undefined
                  }
                />
              </View>

              <View style={styles.metricRow}>
                <SummaryCard
                  title="Overdue Debt"
                  amount={summary?.overdueAmount || 0}
                  variant={(summary?.overdueAmount ?? 0) > 0 ? 'danger' : 'neutral'}
                  subtitle={`${summary?.overdueLoansCount || 0} loan(s) past due`}
                />
                <SummaryCard
                  title="Active Loans"
                  amount={summary?.outstanding || 0}
                  variant="warning"
                  subtitle={`${summary?.activeLoansCount || 0} ongoing loan(s)`}
                />
              </View>
            </View>

            {/* Quick Actions Bar */}
            <View style={styles.ctaRow}>
              <Pressable
                style={styles.mainCtaBtn}
                onPress={() => router.push('/add-loan' as any)}>
                <Text style={styles.mainCtaBtnText}>+ New Loan Record</Text>
              </Pressable>

              <Pressable
                style={styles.viewAllBtn}
                onPress={() => router.push('/loans' as any)}>
                <Text style={styles.viewAllBtnText}>View All Loans →</Text>
              </Pressable>
            </View>

            {/* Recent Loans Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Loans</Text>
                {summary?.recentLoans && summary.recentLoans.length > 0 && (
                  <Pressable onPress={() => router.push('/loans' as any)}>
                    <Text style={styles.seeAllText}>See all ({summary.recentLoans.length})</Text>
                  </Pressable>
                )}
              </View>

              {summary?.recentLoans && summary.recentLoans.length > 0 ? (
                summary.recentLoans.map((loan: any) => (
                  <LoanCard
                    key={loan.id}
                    loan={loan}
                    onPress={() => handleOpenLoan(loan.id)}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🤝</Text>
                  <Text style={styles.emptyTitle}>No loans recorded yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Keep track of money lent to friends and their repayments in one place.
                  </Text>
                  <Pressable
                    style={styles.emptyCtaBtn}
                    onPress={() => router.push('/add-loan' as any)}>
                    <Text style={styles.emptyCtaBtnText}>Add Your First Loan</Text>
                  </Pressable>

                  <Pressable style={styles.seedBtn} onPress={handleSeedSamples}>
                    <Text style={styles.seedBtnText}>Load Sample Loans (For Evaluation)</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Auth Modal gate when not logged in */}
      <AuthModal visible={!isAuthenticated} onSuccess={() => refetch()} />

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
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: Spacing.four,
    maxWidth: 750,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 90,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
    marginTop: Spacing.two,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  userPhone: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  addLoanHeaderBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 1,
    borderRadius: BorderRadius.md,
  },
  addLoanHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    backgroundColor: '#EF4444',
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.two,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingBox: {
    paddingVertical: Spacing.seven,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.xl,
    padding: Spacing.five,
    marginBottom: Spacing.four,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroOverdueBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  heroOverdueBadgeText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  heroAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginVertical: Spacing.two,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroFooterText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  heroOverdueText: {
    fontSize: 13,
    color: '#F87171',
    fontWeight: '600',
  },
  metricsGrid: {
    gap: Spacing.two + 4,
    marginBottom: Spacing.four,
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.two + 4,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  mainCtaBtn: {
    flex: 2,
    backgroundColor: '#0D9488',
    paddingVertical: Spacing.three + 2,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  viewAllBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: Spacing.three + 2,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionContainer: {
    marginTop: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D9488',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.six,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyEmoji: {
    fontSize: 42,
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: Spacing.four,
    maxWidth: 320,
    lineHeight: 18,
  },
  emptyCtaBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: Spacing.two + 4,
    paddingHorizontal: Spacing.four,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.two,
  },
  emptyCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  seedBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  seedBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488',
  },
});
