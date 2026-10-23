import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BorderRadius, Spacing } from '../constants/theme';
import { getReceiptFullUrl } from '../services/api';
import { formatDate, formatINR, formatRelativeDue, getInitials } from '../utils/format';
import { ConfirmationModal } from './ConfirmationModal';
import { RepaymentModal } from './RepaymentModal';
import { StatusBadge } from './StatusBadge';

interface RepaymentRecord {
  id: string;
  amount: number;
  repaymentDate: string | Date;
  notes?: string | null;
}

export interface DetailedLoan {
  id: string;
  friendName: string;
  amount: number;
  amountRepaid: number;
  remainingBalance: number;
  dueDate: string | Date;
  status: string;
  notes?: string | null;
  createdAt: string | Date;
  repayments?: RepaymentRecord[];
  receipt?: {
    id: string;
    url: string;
    publicId?: string | null;
    originalFilename?: string | null;
    sizeBytes?: number | null;
  } | null;
}

interface LoanDetailModalProps {
  visible: boolean;
  loan: DetailedLoan | null;
  isLoading?: boolean;
  onClose: () => void;
  onRecordRepayment: (loanId: string, amount: number, notes?: string) => Promise<void>;
  onMarkRepaid: (loanId: string) => Promise<void>;
  onAttachReceipt?: (loanId: string, uri: string, mimeType?: string, name?: string) => Promise<void>;
  onDeleteReceipt?: (loanId: string) => Promise<void>;
}

export const LoanDetailModal: React.FC<LoanDetailModalProps> = ({
  visible,
  loan,
  isLoading = false,
  onClose,
  onRecordRepayment,
  onMarkRepaid,
  onAttachReceipt,
  onDeleteReceipt,
}) => {
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [showConfirmMarkRepaid, setShowConfirmMarkRepaid] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!loan) return null;

  const isOverdue = loan.status === 'OVERDUE';
  const isRepaid = loan.status === 'REPAID';
  const relativeDue = formatRelativeDue(loan.dueDate, loan.remainingBalance);

  const percentRepaid = loan.amount > 0
    ? Math.min(100, Math.round((loan.amountRepaid / loan.amount) * 100))
    : 0;

  const handleConfirmMarkRepaid = async () => {
    setActionLoading(true);
    try {
      await onMarkRepaid(loan.id);
      setShowConfirmMarkRepaid(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepaySubmit = async (data: { amount: number; notes?: string }) => {
    setActionLoading(true);
    try {
      await onRecordRepayment(loan.id, data.amount, data.notes);
      setShowRepaymentModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePickAndUploadReceipt = async () => {
    if (!onAttachReceipt) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setActionLoading(true);
        const asset = result.assets[0];
        const filename = asset.fileName || asset.uri.split('/').pop() || 'receipt.jpg';
        const mimeType = asset.mimeType || 'image/jpeg';
        await onAttachReceipt(loan.id, asset.uri, mimeType, filename);
      }
    } catch (err: any) {
      console.warn('Failed to attach receipt:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteReceipt = async () => {
    if (!onDeleteReceipt) return;
    setActionLoading(true);
    try {
      await onDeleteReceipt(loan.id);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <Pressable style={styles.backButton} onPress={onClose}>
            <Text style={styles.backButtonText}>← Close</Text>
          </Pressable>
          <Text style={styles.navTitle}>Loan Details</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header Card */}
          <View style={[styles.headerCard, isOverdue && styles.overdueCard]}>
            <View style={styles.headerTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(loan.friendName)}</Text>
              </View>
              <View style={styles.headerTitles}>
                <Text style={styles.friendName}>{loan.friendName}</Text>
                <Text style={styles.createdDate}>Created {formatDate(loan.createdAt)}</Text>
              </View>
              <StatusBadge status={loan.status} size="md" />
            </View>

            {/* Balances Highlight */}
            <View style={styles.balanceHighlight}>
              <Text style={styles.remainingLabel}>Remaining Balance</Text>
              <Text
                style={[
                  styles.remainingAmount,
                  isOverdue && styles.overdueAmount,
                  isRepaid && styles.repaidAmount,
                ]}>
                {formatINR(loan.remainingBalance)}
              </Text>

              {/* Progress */}
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
                  <Text style={styles.progressText}>
                    {percentRepaid}% Repaid ({formatINR(loan.amountRepaid)})
                  </Text>
                  <Text style={styles.originalText}>Total: {formatINR(loan.amount)}</Text>
                </View>
              </View>
            </View>

            {/* Due date notice */}
            <View
              style={[
                styles.dueNotice,
                isOverdue ? styles.overdueNotice : isRepaid ? styles.repaidNotice : styles.activeNotice,
              ]}>
              <Text style={styles.dueNoticeIcon}>{isOverdue ? '⚠️' : isRepaid ? '✅' : '📅'}</Text>
              <Text
                style={[
                  styles.dueNoticeText,
                  isOverdue ? styles.overdueNoticeText : isRepaid ? styles.repaidNoticeText : styles.activeNoticeText,
                ]}>
                {isRepaid
                  ? 'This loan is fully settled.'
                  : `${relativeDue.text} (${formatDate(loan.dueDate)})`}
              </Text>
            </View>
          </View>

          {/* Notes Card if present */}
          {loan.notes && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText}>{loan.notes}</Text>
            </View>
          )}

          {/* Action Buttons */}
          {!isRepaid && (
            <View style={styles.actionButtons}>
              <Pressable
                style={[styles.actionBtn, styles.repayBtn]}
                onPress={() => setShowRepaymentModal(true)}
                disabled={actionLoading}>
                <Text style={styles.repayBtnText}>+ Record Repayment</Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, styles.settleBtn]}
                onPress={() => setShowConfirmMarkRepaid(true)}
                disabled={actionLoading}>
                <Text style={styles.settleBtnText}>Mark as Repaid</Text>
              </Pressable>
            </View>
          )}

          {/* Receipt / Attachment Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Receipt / Proof</Text>
              {loan.receipt ? (
                <Pressable onPress={handleDeleteReceipt} disabled={actionLoading}>
                  <Text style={styles.deleteReceiptText}>
                    {actionLoading ? 'Removing...' : 'Remove'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {loan.receipt ? (
              <View style={styles.receiptContainer}>
                <Pressable
                  onPress={() => setShowImageViewer(true)}
                  style={styles.receiptThumbnailWrapper}>
                  <Image
                    source={{ uri: getReceiptFullUrl(loan.receipt.url) }}
                    style={styles.receiptThumbnail}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.receiptZoomOverlay}>
                    <Text style={styles.receiptZoomText}>🔍 Tap to view</Text>
                  </View>
                </Pressable>
                {loan.receipt.originalFilename && (
                  <Text style={styles.receiptFilename} numberOfLines={1}>
                    📎 {loan.receipt.originalFilename}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.emptyReceiptContainer}>
                <Text style={styles.emptyReceiptText}>No receipt attached</Text>
                {onAttachReceipt && (
                  <Pressable
                    style={[styles.attachReceiptBtn, actionLoading && styles.disabledBtn]}
                    onPress={handlePickAndUploadReceipt}
                    disabled={actionLoading}>
                    {actionLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator size="small" color="#0F172A" />
                        <Text style={styles.attachReceiptBtnText}>Uploading...</Text>
                      </View>
                    ) : (
                      <Text style={styles.attachReceiptBtnText}>+ Upload Receipt Photo</Text>
                    )}
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Repayment History Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Repayment History</Text>
              <Text style={styles.historyCount}>
                {(loan.repayments || []).length} payment{loan.repayments?.length === 1 ? '' : 's'}
              </Text>
            </View>

            {loan.repayments && loan.repayments.length > 0 ? (
              loan.repayments.map((rep) => (
                <View key={rep.id} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>₹</Text>
                    </View>
                    <View>
                      <Text style={styles.historyAmount}>+{formatINR(rep.amount)}</Text>
                      {rep.notes ? <Text style={styles.historyNotes}>{rep.notes}</Text> : null}
                    </View>
                  </View>
                  <Text style={styles.historyDate}>{formatDate(rep.repaymentDate)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>No repayments recorded yet.</Text>
                {!isRepaid && (
                  <Text style={styles.emptyHistorySubtext}>
                    Tap "Record Repayment" above when your friend pays you back.
                  </Text>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Partial Repayment Modal */}
        <RepaymentModal
          visible={showRepaymentModal}
          loanId={loan.id}
          friendName={loan.friendName}
          remainingBalance={loan.remainingBalance}
          isLoading={actionLoading}
          onClose={() => setShowRepaymentModal(false)}
          onSubmit={handleRepaySubmit}
        />

        {/* Confirmation Modal for Mark as Repaid */}
        <ConfirmationModal
          visible={showConfirmMarkRepaid}
          title="Mark Loan as Repaid?"
          message={`Are you sure you want to mark this loan from ${loan.friendName} as fully repaid? This will clear the remaining balance of ${formatINR(loan.remainingBalance)}.`}
          confirmLabel="Mark as Repaid"
          variant="success"
          isLoading={actionLoading}
          onConfirm={handleConfirmMarkRepaid}
          onCancel={() => setShowConfirmMarkRepaid(false)}
        />

        {/* Fullscreen Image Viewer Modal */}
        {loan.receipt && (
          <Modal
            visible={showImageViewer}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowImageViewer(false)}>
            <View style={styles.imageViewerOverlay}>
              <Pressable
                style={styles.imageViewerCloseBtn}
                onPress={() => setShowImageViewer(false)}>
                <Text style={styles.imageViewerCloseText}>✕ Close</Text>
              </Pressable>
              <Image
                source={{ uri: getReceiptFullUrl(loan.receipt.url) }}
                style={styles.fullscreenImage}
                contentFit="contain"
              />
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    paddingVertical: Spacing.one,
    paddingRight: Spacing.two,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: Spacing.four,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: Spacing.seven,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.three,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  overdueCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFBFB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.three,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTitles: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  createdDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  balanceHighlight: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.lg,
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  remainingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  remainingAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  overdueAmount: {
    color: '#DC2626',
  },
  repaidAmount: {
    color: '#059669',
  },
  progressContainer: {
    marginTop: Spacing.two,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  originalText: {
    fontSize: 12,
    color: '#64748B',
  },
  dueNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two + 2,
    borderRadius: BorderRadius.md,
    gap: Spacing.two,
  },
  activeNotice: {
    backgroundColor: '#F1F5F9',
  },
  overdueNotice: {
    backgroundColor: '#FEF2F2',
  },
  repaidNotice: {
    backgroundColor: '#ECFDF5',
  },
  dueNoticeIcon: {
    fontSize: 14,
  },
  dueNoticeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeNoticeText: {
    color: '#334155',
  },
  overdueNoticeText: {
    color: '#B91C1C',
  },
  repaidNoticeText: {
    color: '#047857',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: Spacing.two,
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repayBtn: {
    backgroundColor: '#0F172A',
  },
  repayBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  settleBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  settleBtnText: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  historyCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  historyBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  historyNotes: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  historyDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyHistory: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyHistorySubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  deleteReceiptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  receiptContainer: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  receiptThumbnailWrapper: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  receiptThumbnail: {
    width: '100%',
    height: '100%',
  },
  receiptZoomOverlay: {
    position: 'absolute',
    bottom: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  receiptZoomText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  receiptFilename: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  emptyReceiptContainer: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyReceiptText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  attachReceiptBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  attachReceiptBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  imageViewerCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BorderRadius.md,
  },
  imageViewerCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
});
