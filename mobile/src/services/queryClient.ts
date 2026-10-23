import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  all: ['miniledger'] as const,
  dashboard: (userId: string) => ['miniledger', 'dashboard', userId] as const,
  loans: (userId: string, status?: string, search?: string) =>
    ['miniledger', 'loans', userId, status || 'ALL', search?.trim() || ''] as const,
  loanDetails: (userId: string, loanId: string) =>
    ['miniledger', 'loan', userId, loanId] as const,
};

export function clearUserCache() {
  queryClient.clear();
}
