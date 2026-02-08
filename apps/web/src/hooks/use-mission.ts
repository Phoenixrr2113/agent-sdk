'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Mission } from '@/types/motia';
import { queryKeys } from '@/lib/query-utils';
import { api } from '@/lib/api';

type UseMissionOptions = {
  enabled?: boolean;
};

export function useMission(id: string, options: UseMissionOptions = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.missions.detail(id),
    queryFn: () => api.get<{ mission: Mission }>(`/api/missions/${id}`),
    enabled: enabled && !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.mission.status;
      const isActive = status === 'executing' || status === 'planning' || status === 'awaiting_approval';
      return isActive ? 3000 : false; // Faster polling for single mission
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Mission>) => 
      api.put<{ mission: Mission }>(`/api/missions/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missions.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.missions.all });
    },
  });

  const cancelMission = useMutation({
    mutationFn: () => api.put<{ mission: Mission }>(`/api/missions/${id}`, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missions.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.missions.all });
    },
  });

  return {
    mission: data?.mission,
    isLoading,
    error,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.missions.detail(id) }),
    updateMission: updateMutation.mutateAsync,
    cancelMission: cancelMission.mutateAsync,
    isUpdating: updateMutation.isPending,
    isCancelling: cancelMission.isPending,
  };
}
