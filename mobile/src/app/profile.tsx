import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { BorderRadius, Spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, api } from '../services/api';
import { formatDate } from '../utils/format';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const [backendStatus, setBackendStatus] = useState<any>(null);
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const checkHealth = async () => {
    setCheckingBackend(true);
    try {
      const res = await api.checkHealth();
      if (res.success && res.data) {
        setBackendStatus(res.data);
      } else {
        setBackendStatus({ status: 'unreachable', error: res.error });
      }
    } catch (err: any) {
      setBackendStatus({ status: 'unreachable', error: err.message });
    } finally {
      setCheckingBackend(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleSeedSamples = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const res = await api.seedSampleLoans();
      if (res.success) {
        setSeedMessage('Sample loans added! Check your Dashboard and Loans tab.');
      } else {
        setSeedMessage(res.error || 'Failed to seed sample loans');
      }
    } catch (err: any) {
      setSeedMessage(err.message || 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Account & Settings</Text>
        </View>

        {/* User Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name[0]?.toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.name || 'MiniLedger User'}</Text>
              <Text style={styles.userPhone}>+91 {user?.phone || '—'}</Text>
              <Text style={styles.userJoined}>
                Member since {formatDate(new Date())}
              </Text>
            </View>
          </View>
        </View>

        {/* Backend & Database Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Backend & Database Status</Text>
            <Pressable onPress={checkHealth} style={styles.refreshBtn} disabled={checkingBackend}>
              {checkingBackend ? (
                <ActivityIndicator size="small" color="#0F172A" />
              ) : (
                <Text style={styles.refreshBtnText}>Check</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>API Server</Text>
            <View style={styles.statusBadge}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      backendStatus?.status === 'ok' ? '#10B981' : '#EF4444',
                  },
                ]}
              />
              <Text style={styles.statusValue}>
                {backendStatus?.status === 'ok' ? 'Online' : 'Unreachable'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Database Storage</Text>
            <Text style={styles.statusValueText}>
              {backendStatus?.database || 'Checking...'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>API URL</Text>
            <Text style={styles.apiUrlText}>{API_BASE_URL}</Text>
          </View>
        </View>

        {/* Mock OTP & Dev Guidance */}
        

        {/* Developer Seeding Tool */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Testing & Evaluation</Text>
          <Text style={styles.cardSubtitle}>
            Quickly populate sample active and overdue loans to explore all dashboard calculations,
            repayments, and filters.
          </Text>

          {seedMessage && (
            <View style={styles.seedMessageBox}>
              <Text style={styles.seedMessageText}>{seedMessage}</Text>
            </View>
          )}

          <Pressable
            style={[styles.seedBtn, seeding && styles.disabledBtn]}
            onPress={handleSeedSamples}
            disabled={seeding}>
            {seeding ? (
              <ActivityIndicator size="small" color="#0F172A" />
            ) : (
              <Text style={styles.seedBtnText}>Seed Sample Loans</Text>
            )}
          </Pressable>
        </View>

        {/* Logout Button */}
        <Pressable
          style={styles.logoutBtn}
          onPress={() => setShowLogoutModal(true)}>
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </Pressable>
      </ScrollView>

      {/* Logout Confirmation */}
      <ConfirmationModal
        visible={showLogoutModal}
        title="Log Out?"
        message="Are you sure you want to log out of MiniLedger? You can sign in again anytime using your phone number."
        confirmLabel="Log Out"
        variant="danger"
        onConfirm={() => {
          setShowLogoutModal(false);
          logout();
        }}
        onCancel={() => setShowLogoutModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.three,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  userPhone: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  userJoined: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: Spacing.three,
    lineHeight: 18,
  },
  refreshBtn: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.two,
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.sm,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  statusValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  apiUrlText: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  noticeCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: Spacing.three,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  codeText: {
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  seedMessageBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: BorderRadius.md,
    padding: Spacing.two + 2,
    marginBottom: Spacing.three,
  },
  seedMessageText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  seedBtn: {
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seedBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  logoutBtn: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three + 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
});
