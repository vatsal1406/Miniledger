/**
 * MiniLedger Reusable API Client
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';

// Resolve appropriate API Base URL for platform
export function getDefaultApiBaseUrl(): string {
  // 1. Environment variable if explicitly set
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // 2. Web browser: Use current hostname (works on both localhost:8081 and 192.168.x.x:8081)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    return `http://${host}:5000`;
  }

  // 3. Physical phone / Expo Go: extract host machine LAN IP from Metro configuration
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:5000`;
    }
  }

  // 4. Android emulator fallback (10.0.2.2 maps to host 127.0.0.1)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }

  // 5. Default localhost for iOS Simulator or local desktop
  return 'http://localhost:5000';
}

export let API_BASE_URL = getDefaultApiBaseUrl();

export function setCustomApiUrl(url: string) {
  API_BASE_URL = url.replace(/\/$/, '');
}

/**
 * Resolves a receipt URL to an absolute URL, appending auth token for protected local storage files.
 */
export function getReceiptFullUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const token = storage.getToken();
  const separator = cleanPath.includes('?') ? '&' : '?';
  const tokenParam = token ? `${separator}token=${encodeURIComponent(token)}` : '';
  return `${base}${cleanPath}${tokenParam}`;
}

// In-memory token storage + Web LocalStorage persistence
let memoryToken: string | null = null;
let memoryUser: any | null = null;

const TOKEN_KEY = 'miniledger_auth_token';
const USER_KEY = 'miniledger_auth_user';

export const storage = {
  getToken: (): string | null => {
    if (memoryToken) return memoryToken;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(TOKEN_KEY);
        if (stored) {
          memoryToken = stored;
          return stored;
        }
      } catch {}
    }
    return null;
  },

  setToken: (token: string | null) => {
    memoryToken = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (token) {
          window.localStorage.setItem(TOKEN_KEY, token);
        } else {
          window.localStorage.removeItem(TOKEN_KEY);
        }
      } catch {}
    }
  },

  getUser: (): any | null => {
    if (memoryUser) return memoryUser;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(USER_KEY);
        if (stored) {
          memoryUser = JSON.parse(stored);
          return memoryUser;
        }
      } catch {}
    }
    return null;
  },

  setUser: (user: any | null) => {
    memoryUser = user;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (user) {
          window.localStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
          window.localStorage.removeItem(USER_KEY);
        }
      } catch {}
    }
  },

  clear: () => {
    memoryToken = null;
    memoryUser = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
      } catch {}
    }
  },
};

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export interface ApiError {
  message: string;
  status?: number;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = storage.getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

    if (__DEV__) {
      console.log(`[API] -> ${options.method || 'GET'} ${url}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      storage.clear();
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }

    const json = await response.json().catch(() => null);

    if (__DEV__) {
      console.log(`[API] <- Status: ${response.status} from ${url}`);
    }

    if (!response.ok) {
      const errorMessage =
        json?.error ||
        json?.message ||
        `Request failed with status ${response.status} (${response.statusText})`;
      return { success: false, error: errorMessage };
    }

    return {
      success: true,
      data: (json?.data !== undefined ? json.data : json) as T,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: `Request timed out connecting to ${url}. Please verify the backend is running at that URL.`,
      };
    }
    return {
      success: false,
      error:
        `Cannot connect to MiniLedger backend at ${url}. Please ensure 'npm run dev' is running in the backend directory. (${err.message || 'Network request failed'})`,
    };
  }
}

async function buildReceiptFormData(
  fileUri: string,
  mimeType: string,
  filename: string
): Promise<FormData> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    let blob: Blob;
    if (fileUri.startsWith('data:')) {
      const parts = fileUri.split(',');
      const detectedMime = parts[0]?.match(/:(.*?);/)?.[1] || mimeType;
      const base64Data = parts[1] || '';
      const bstr = atob(base64Data);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: detectedMime });
    } else {
      const resp = await fetch(fileUri);
      blob = await resp.blob();
    }
    formData.append('receipt', blob, filename);
  } else {
    // Native (Android / iOS):
    // In React Native 0.88 / Expo SDK 52+, global fetch is WinterCG-compliant (expo/fetch).
    // Passing a legacy { uri, name, type } object causes [Error: Unsupported FormDataPart implementation].
    // Using expo-file-system's File satisfies WinterCG requirements by implementing Blob and .bytes().
    try {
      const file = new ExpoFile(fileUri);
      Object.defineProperty(file, 'name', {
        value: filename,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      Object.defineProperty(file, 'type', {
        value: mimeType,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      formData.append('receipt', file as any, filename);
    } catch {
      // Graceful fallback for legacy environments
      formData.append('receipt', {
        uri: fileUri,
        name: filename,
        type: mimeType,
      } as any);
    }
  }

  return formData;
}

// API methods
export const api = {
  // Auth
  sendOtp: (phone: string) =>
    request<{
      message: string;
      cooldownSeconds?: number;
      expiresInSeconds?: number;
      isMockDelivery?: boolean;
      provider?: string;
    }>('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (phone: string, otp: string, name?: string) =>
    request<{ token: string; user: any }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, name }),
    }),

  getCurrentUser: () =>
    request<any>('/api/auth/me', { method: 'GET' }),

  getMe: () =>
    request<{ user: { id: string; phone: string; name?: string } }>('/api/auth/me', {
      method: 'GET',
    }),

  // Dashboard
  getDashboardSummary: () =>
    request<{
      totalLent: number;
      totalRepaid: number;
      outstanding: number;
      overdueAmount: number;
      activeLoansCount: number;
      overdueLoansCount: number;
      recentLoans: any[];
    }>('/api/dashboard/summary', {
      method: 'GET',
    }),

  // Loans
  getLoans: (filter?: { search?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filter?.search) params.append('search', filter.search);
    if (filter?.status && filter.status !== 'ALL') params.append('status', filter.status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<any[]>(`/api/loans${qs}`, { method: 'GET' });
  },

  getLoanById: (id: string) =>
    request<any>(`/api/loans/${id}`, { method: 'GET' }),

  createLoan: (data: {
    friendName: string;
    amount: number;
    dueDate: string;
    notes?: string;
    receipt?: {
      url: string;
      publicId?: string | null;
      originalFilename?: string | null;
      mimeType?: string | null;
      sizeBytes?: number | null;
    } | null;
  }) =>
    request<any>('/api/loans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recordRepayment: (id: string, data: { amount: number; notes?: string; repaymentDate?: string }) =>
    request<{ loan: any; repayment: any }>(`/api/loans/${id}/repay`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  markLoanRepaid: (id: string, notes?: string) =>
    request<any>(`/api/loans/${id}/mark-repaid`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    }),

  // Receipts
  stageReceipt: async (
    fileUri: string,
    mimeType = 'image/jpeg',
    filename = 'receipt.jpg'
  ): Promise<{
    success: boolean;
    data?: {
      url: string;
      publicId: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
    };
    error?: string;
  }> => {
    const url = `${API_BASE_URL}/api/receipts/stage`;
    const token = storage.getToken();

    try {
      const formData = await buildReceiptFormData(fileUri, mimeType, filename);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.status === 401) {
        storage.clear();
        if (unauthorizedHandler) {
          unauthorizedHandler();
        }
      }

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        return { success: false, error: json?.error || 'Failed to upload receipt photo' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during receipt upload' };
    }
  },

  uploadReceipt: async (
    loanId: string,
    fileUri: string,
    mimeType = 'image/jpeg',
    filename = 'receipt.jpg'
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    const url = `${API_BASE_URL}/api/loans/${loanId}/receipt`;
    const token = storage.getToken();

    try {
      const formData = await buildReceiptFormData(fileUri, mimeType, filename);
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.status === 401) {
        storage.clear();
        if (unauthorizedHandler) {
          unauthorizedHandler();
        }
      }

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        return { success: false, error: json?.error || 'Failed to upload receipt' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during upload' };
    }
  },

  deleteReceipt: (loanId: string) =>
    request<{ success: boolean; message: string }>(`/api/loans/${loanId}/receipt`, {
      method: 'DELETE',
    }),

  // Health
  checkHealth: () =>
    request<{ status: string; service: string; database: string; postgresConnected: boolean }>(
      '/api/health',
      { method: 'GET' }
    ),

  // Development sample seed
  seedSampleLoans: () =>
    request<{ success: boolean; message: string; count: number }>(
      '/api/seed-sample-loans',
      { method: 'POST' }
    ),
};
