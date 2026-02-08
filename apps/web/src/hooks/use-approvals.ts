'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-utils';
import { api } from '@/lib/api';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
type ApprovalCategory = 'mission_step' | 'device_action' | 'file_write' | 'shell_execute' | 'network_request' | 'data_access' | 'other';

type ApprovalRequest = {
  id: string;
  userId: string;
  missionId?: string;
  automationId?: string;
  category: ApprovalCategory;
  action: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
};

type ApprovalResponse = {
  approved: boolean;
  comment?: string;
  modifiedAction?: string;
};

export function useApprovals() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.approvals.list(),
    queryFn: () => api.get<{ approvals: ApprovalRequest[] }>('/api/approvals'),
    refetchInterval: 10000, // Check every 10 seconds for new approvals
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, response }: { id: string; response: ApprovalResponse }) =>
      api.post(`/api/approvals/${id}/respond`, response),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.missions.all });
    },
  });

  const approvals = data?.approvals ?? [];
  const pendingCount = approvals.filter(a => a.category !== undefined).length;

  return {
    approvals,
    pendingCount,
    isLoading,
    error,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list() }),
    respondToApproval: (id: string, response: ApprovalResponse) => 
      respondMutation.mutateAsync({ id, response }),
    approveAction: (id: string, comment?: string) =>
      respondMutation.mutateAsync({ id, response: { approved: true, comment } }),
    rejectAction: (id: string, comment?: string) =>
      respondMutation.mutateAsync({ id, response: { approved: false, comment } }),
    isResponding: respondMutation.isPending,
  };
}

export type { ApprovalRequest, ApprovalResponse, ApprovalStatus, ApprovalCategory };
