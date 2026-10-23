/**
 * MiniLedger Theme & Fintech Design System Tokens
 */

import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Primary fintech slate/navy
    primary: '#0F172A',
    primaryDark: '#020617',
    primaryLight: '#1E293B',

    // Accents
    accent: '#0D9488', // Teal
    accentLight: '#F0FDFA',
    accentBorder: '#99F6E4',

    // Financial indicators
    success: '#10B981', // Emerald for repayments
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',

    danger: '#EF4444', // Overdue red
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',

    warning: '#F59E0B', // Amber for approaching due dates
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',

    // Surface & background
    text: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    background: '#F8FAFC',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#E2E8F0',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    divider: '#E2E8F0',
    inputBg: '#FFFFFF',
    inputBorder: '#CBD5E1',
  },
  dark: {
    primary: '#38BDF8',
    primaryDark: '#0F172A',
    primaryLight: '#1E293B',

    accent: '#14B8A6',
    accentLight: '#042F2E',
    accentBorder: '#115E59',

    success: '#34D399',
    successBg: '#064E3B',
    successBorder: '#065F46',

    danger: '#F87171',
    dangerBg: '#450A0A',
    dangerBorder: '#7F1D1D',

    warning: '#FBBF24',
    warningBg: '#451A03',
    warningBorder: '#78350F',

    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    background: '#0B0F19',
    backgroundElement: '#1E293B',
    backgroundSelected: '#334155',
    card: '#111827',
    cardBorder: '#1F2937',
    divider: '#1F2937',
    inputBg: '#1E293B',
    inputBorder: '#334155',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
    rounded: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 48,
  seven: 64,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  full: 9999,
} as const;

export const BottomTabInset = Platform.select({ ios: 70, android: 80, web: 70 }) ?? 70;
export const MaxContentWidth = 840;
