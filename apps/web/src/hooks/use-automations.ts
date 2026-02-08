'use client';

import type { Automation, AutomationStatus, CreateAutomationInput } from '@/types/motia';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-utils';
import { api } from '@/lib/api';

export type { Automation, AutomationStatus, CreateAutomationInput } from '@/types/motia';

type UseAutomationsOptions = {
  enabled?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
};

type UpdateAutomationInput = {
  name?: string;
  description?: string;
  status?: AutomationStatus;
};

type UseAutomationsReturn = {
  automations: Automation[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createAutomation: (input: CreateAutomationInput) => Promise<Automation>;
  updateAutomation: (id: string, input: UpdateAutomationInput) => Promise<Automation>;
  deleteAutomation: (id: string) => Promise<void>;
  toggleAutomation: (id: string, enabled: boolean) => Promise<Automation>;
  isCreating?: boolean;
  isUpdating?: boolean;
  isDeleting?: boolean;
  isToggling?: boolean;
};

export function useAutomations(options: UseAutomationsOptions = {}): UseAutomationsReturn {
  const { enabled = true, autoRefresh = false, refreshInterval = 30000 } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.automations.all,
    queryFn: () => api.get<{ automations: Automation[] }>('/api/automations'),
    enabled,
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateAutomationInput) =>
      api.post<{ automation: Automation }>('/api/automations', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAutomationInput }) =>
      api.put<{ automation: Automation }>(`/api/automations/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/automations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => {
      const newStatus: AutomationStatus = enabled ? 'active' : 'disabled';
      return api.put<{ automation: Automation }>(`/api/automations/${id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
  });

  return {
    automations: data?.automations || [],
    isLoading,
    error: error as Error | null,
    refetch: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    },
    createAutomation: async (input: CreateAutomationInput) => {
      const result = await createMutation.mutateAsync(input);
      return result.automation;
    },
    updateAutomation: async (id: string, input: UpdateAutomationInput) => {
      const result = await updateMutation.mutateAsync({ id, input });
      return result.automation;
    },
    deleteAutomation: async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    toggleAutomation: async (id: string, enabled: boolean) => {
      const result = await toggleMutation.mutateAsync({ id, enabled });
      return result.automation;
    },
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isToggling: toggleMutation.isPending,
  };
}
