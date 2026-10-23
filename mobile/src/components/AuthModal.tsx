import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BorderRadius, Spacing } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';

interface AuthModalProps {
  visible: boolean;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onSuccess }) => {
  const { sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(300); // 5 minutes
  const [isMockDelivery, setIsMockDelivery] = useState<boolean | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  // Cooldown countdown timer (30s)
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // OTP Expiry countdown timer (5 mins)
  useEffect(() => {
    if (step !== 'otp' || expirySeconds <= 0) return;
    const timer = setInterval(() => {
      setExpirySeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, expirySeconds]);

  const handleSendOtp = async () => {
    setError(null);
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned || cleaned.length !== 10 || !['6', '7', '8', '9'].includes(cleaned[0])) {
      setError('Please enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9.');
      return;
    }

    setIsLoading(true);
    const res = await sendOtp(cleaned);
    setIsLoading(false);

    if (res.success) {
      setStep('otp');
      setCooldown(res.cooldownSeconds || 30);
      setExpirySeconds(300); // reset 5 minutes
      setIsMockDelivery(res.isMockDelivery ?? true);
      setProvider(res.provider || null);
    } else {
      setError(res.error || 'Failed to send OTP.');
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    if (expirySeconds <= 0) {
      setError('This OTP code has expired. Please tap "Resend OTP" below.');
      return;
    }

    setIsVerifying(true);
    const res = await verifyOtp(phone, otp.trim(), name.trim() || undefined);
    setIsVerifying(false);

    if (res.success) {
      if (onSuccess) onSuccess();
    } else {
      setError(res.error || 'Invalid OTP code.');
    }
  };

  const isExpired = step === 'otp' && expirySeconds <= 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.card}>
          {/* Logo / Brand Header */}
          <View style={styles.brandContainer}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandIconText}>₹</Text>
            </View>
            <Text style={styles.brandTitle}>MiniLedger</Text>
            <Text style={styles.brandTagline}>Personal lending & debt tracker</Text>
          </View>

          {step === 'phone' ? (
            /* STEP 1: Phone Input */
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Sign in with Phone</Text>
              <Text style={styles.stepSubtitle}>
                Enter your 10-digit Indian mobile number to access your ledger.
              </Text>

              {/* Name (Optional) */}
              <Text style={styles.inputLabel}>Your Name (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Aditya Sharma"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!isLoading}
              />

              {/* Phone Input */}
              <Text style={styles.inputLabel}>Mobile Number *</Text>
              <View style={[styles.phoneWrapper, error ? styles.inputError : null]}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryFlag}>🇮🇳</Text>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="9876543210"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(txt) => {
                    setPhone(txt.replace(/\D/g, ''));
                    setError(null);
                  }}
                  editable={!isLoading}
                />
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                style={[styles.primaryBtn, isLoading && styles.disabledBtn]}
                onPress={handleSendOtp}
                disabled={isLoading}>
                {isLoading ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>Sending OTP via SMS...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Get OTP Code</Text>
                )}
              </Pressable>
            </View>
          ) : (
            /* STEP 2: OTP Verification */
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Enter 6-digit OTP</Text>
              <Text style={styles.stepSubtitle}>
                Code sent to <Text style={styles.boldPhone}>+91 {phone}</Text>
              </Text>

              {/* Clear Delivery Status Banners */}
              {isMockDelivery ? (
                <View style={styles.mockNoticeBox}>
                  <Text style={styles.mockNoticeTitle}>🛠️ Development Mock Mode (Provider: {provider || 'mock'})</Text>
                  <Text style={styles.mockNoticeText}>
                    No live SMS provider credentials configured in backend/.env. Real SMS delivery is UNTESTED.
                    Your 6-digit mock OTP is logged in your backend terminal.
                  </Text>
                </View>
              ) : (
                <View style={styles.smsSuccessBox}>
                  <Text style={styles.smsSuccessTitle}>📱 Real SMS Dispatched</Text>
                  <Text style={styles.smsSuccessText}>
                    A real SMS verification code was sent to +91 {phone} via {provider?.toUpperCase() || 'SMS'}.
                  </Text>
                </View>
              )}

              {/* Expiry Countdown Row */}
              <View style={styles.expiryBox}>
                <Text style={[styles.expiryText, isExpired && styles.expiredText]}>
                  {expirySeconds > 0
                    ? `⏱️ Code expires in ${Math.floor(expirySeconds / 60)}:${(expirySeconds % 60).toString().padStart(2, '0')}`
                    : '⚠️ This OTP has expired. Please request a new code below.'}
                </Text>
              </View>

              <TextInput
                style={[styles.otpInput, error || isExpired ? styles.inputError : null]}
                placeholder="123456"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(txt) => {
                  setOtp(txt.replace(/\D/g, ''));
                  setError(null);
                }}
                editable={!isVerifying && !isExpired}
                autoFocus
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <Pressable
                style={[styles.primaryBtn, (isVerifying || isExpired || otp.length !== 6) && styles.disabledBtn]}
                onPress={handleVerifyOtp}
                disabled={isVerifying || isExpired || otp.length !== 6}>
                {isVerifying ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>Verifying OTP...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Verify & Proceed</Text>
                )}
              </Pressable>

              <View style={styles.otpActions}>
                <Pressable
                  onPress={() => {
                    setStep('phone');
                    setError(null);
                  }}
                  disabled={isVerifying}
                  style={styles.linkBtn}>
                  <Text style={styles.linkText}>← Change Phone Number</Text>
                </Pressable>

                <Pressable
                  onPress={handleSendOtp}
                  disabled={isVerifying || cooldown > 0}
                  style={styles.linkBtn}>
                  <Text style={[styles.linkText, cooldown > 0 && styles.disabledLink]}>
                    {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.five,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  brandIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  brandIconText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#10B981',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  noticeBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  noticeTarget: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
    marginTop: 4,
  },
  stepContainer: {
    width: '100%',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: Spacing.four,
  },
  boldPhone: {
    fontWeight: '700',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: Spacing.one,
    marginTop: Spacing.two,
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
  phoneWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    backgroundColor: '#F8FAFC',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    gap: 4,
  },
  countryFlag: {
    fontSize: 16,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: 1,
  },
  otpInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.three,
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: Spacing.two,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: Spacing.one,
    marginBottom: Spacing.one,
  },
  primaryBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: Spacing.three + 2,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  linkBtn: {
    paddingVertical: Spacing.one,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D9488',
  },
  disabledLink: {
    color: '#94A3B8',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockNoticeBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  mockNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 2,
  },
  mockNoticeText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  smsSuccessBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  smsSuccessTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 2,
  },
  smsSuccessText: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 16,
  },
  expiryBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.two,
    marginTop: Spacing.one,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  expiredText: {
    color: '#DC2626',
    fontWeight: '700',
  },
});
