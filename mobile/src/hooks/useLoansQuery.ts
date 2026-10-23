import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { queryKeys } from '../services/queryClient';

export function useDashboardQuery() {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.dashboard(user?.id || ''),
    queryFn: async () => {
      const res = await api.getDashboardSummary();
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch dashboard summary');
      }
      return res.data!;
    },
    enabled: isAuthenticated && !!user?.id,
  });
}

export function useLoansQuery(status?: string, search?: string) {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.loans(user?.id || '', status, search),
    queryFn: async () => {
      const res = await api.getLoans({ status, search });
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch loans');
      }
      return res.data || [];
    },
    enabled: isAuthenticated && !!user?.id,
  });
}

export function useLoanDetailQuery(loanId: string | null) {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.loanDetails(user?.id || '', loanId || ''),
    queryFn: async () => {
      if (!loanId) return null;
      const res = await api.getLoanById(loanId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to load loan details');
      }
      return res.data;
    },
    enabled: isAuthenticated && !!user?.id && !!loanId,
  });
}

/**
 * Mutation hooks with automatic cache invalidation
 */
export function useLoanMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidateAll = () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.all });
    }
  };

  const createLoanMutation = useMutation({
    mutationFn: async (data: {
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
    }) => {
      const res = await api.createLoan(data);
      if (!res.success) {
        throw new Error(res.error || 'Failed to create loan');
      }
      return res.data;
    },
    onSuccess: (newLoan) => {
      if (user?.id && newLoan) {
        queryClient.setQueriesData(
          { queryKey: ['miniledger', 'loans', user.id] },
          (oldData: any) => {
            if (!Array.isArray(oldData)) return [newLoan];
            if (oldData.some((l: any) => l.id === newLoan.id)) return oldData;
            return [newLoan, ...oldData];
          }
        );
      }
      invalidateAll();
    },
  });

  const recordRepaymentMutation = useMutation({
    mutationFn: async ({ loanId, amount, notes, repaymentDate }: { loanId: string; amount: number; notes?: string; repaymentDate?: string }) => {
      const res = await api.recordRepayment(loanId, { amount, notes, repaymentDate });
      if (!res.success) {
        throw new Error(res.error || 'Repayment failed');
      }
      return res.data;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const markRepaidMutation = useMutation({
    mutationFn: async ({ loanId, notes }: { loanId: string; notes?: string }) => {
      const res = await api.markLoanRepaid(loanId, notes);
      if (!res.success) {
        throw new Error(res.error || 'Failed to mark loan as repaid');
      }
      return res.data;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: async ({ loanId, fileUri, mimeType, filename }: { loanId: string; fileUri: string; mimeType?: string; filename?: string }) => {
      const res = await api.uploadReceipt(loanId, fileUri, mimeType, filename);
      if (!res.success) {
        throw new Error(res.error || 'Failed to upload receipt');
      }
      return res.data;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: async (loanId: string) => {
      const res = await api.deleteReceipt(loanId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to remove receipt');
      }
      return res;
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  return {
    createLoanMutation,
    recordRepaymentMutation,
    markRepaidMutation,
    uploadReceiptMutation,
    deleteReceiptMutation,
    invalidateAll,
  };
}
