'use client';

import type { CreateMissionInput, Mission, MissionStatus } from '@/types/motia';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-utils';
import { api } from '@/lib/api';

export type { CreateMissionInput, Mission, MissionStatus } from '@/types/motia';

type UseMissionsOptions = {
  status?: MissionStatus;
  autoRefresh?: boolean;
  refreshInterval?: number;
};

type UseMissionsReturn = {
  missions: Mission[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createMission: (input: CreateMissionInput) => Promise<Mission>;
  deleteMission: (id: string) => Promise<void>;
  isCreating: boolean;
  isDeleting: boolean;
};

export function useMissions(options: UseMissionsOptions = {}): UseMissionsReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.missions.all,
    queryFn: () => api.get<{ missions: Mission[] }>('/api/missions'),
    refetchInterval: (query) => {
      // Poll every 5s if any mission is executing or planning
      const hasExecuting = query.state.data?.missions.some(
        m => m.status === 'executing' || m.status === 'planning'
      );
      if (hasExecuting) return 5000;
      // Otherwise use autoRefresh settings
      return autoRefresh ? refreshInterval : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateMissionInput) =>
      api.post<{ id: string; status: string; userId: string }>('/api/missions', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missions.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/missions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.missions.all });
    },
  });

  const createMission = async (input: CreateMissionInput): Promise<Mission> => {
    const response = await createMutation.mutateAsync(input);

    const newMission: Mission = {
      id: response.id,
      userId: response.userId,
      goal: input.goal,
      status: response.status as MissionStatus,
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return newMission;
  };

  const deleteMission = async (id: string): Promise<void> => {
    await deleteMutation.mutateAsync(id);
  };

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.missions.all });
  };

  return {
    missions: data?.missions || [],
    isLoading,
    error: error as Error | null,
    refetch,
    createMission,
    deleteMission,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
