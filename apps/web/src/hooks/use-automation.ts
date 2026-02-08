'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Automation } from '@/types/motia';
import { queryKeys } from '@/lib/query-utils';
import { api } from '@/lib/api';

type UseAutomationOptions = {
  enabled?: boolean;
};

export function useAutomation(id: string, options: UseAutomationOptions = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.automations.detail(id),
    queryFn: () => api.get<{ automation: Automation }>(`/api/automations/${id}`),
    enabled: enabled && !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Automation>) =>
      api.put<{ automation: Automation }>(`/api/automations/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/automations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.put<{ automation: Automation }>(`/api/automations/${id}`, { status: 'paused' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.put<{ automation: Automation }>(`/api/automations/${id}`, { status: 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: () => api.post(`/api/automations/${id}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.detail(id) });
    },
  });

  return {
    automation: data?.automation,
    isLoading,
    error,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.automations.detail(id) }),
    updateAutomation: updateMutation.mutateAsync,
    deleteAutomation: deleteMutation.mutateAsync,
    pauseAutomation: pauseMutation.mutateAsync,
    resumeAutomation: resumeMutation.mutateAsync,
    runNow: runNowMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isPausing: pauseMutation.isPending,
    isResuming: resumeMutation.isPending,
    isRunning: runNowMutation.isPending,
  };
}
