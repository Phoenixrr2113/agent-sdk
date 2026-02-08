'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-utils';

export type UserProfile = {
  userId: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  timezone?: string;
  language?: string;
  createdAt: string;
  updatedAt: string;
};

type UseProfileReturn = {
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  updateProfile: (profile: Partial<UserProfile>) => Promise<UserProfile>;
  isUpdating: boolean;
};

export function useProfile(): UseProfileReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.profile.all,
    queryFn: () => api.get<UserProfile>('/api/profile'),
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: (profile: Partial<UserProfile>) =>
      api.put<UserProfile>('/api/profile', profile),
    onMutate: async (newProfile) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile.all });

      const previousProfile = queryClient.getQueryData<UserProfile>(queryKeys.profile.all);

      if (previousProfile) {
        queryClient.setQueryData<UserProfile>(queryKeys.profile.all, {
          ...previousProfile,
          ...newProfile,
        });
      }

      return { previousProfile };
    },
    onError: (_err, _newProfile, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKeys.profile.all, context.previousProfile);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });

  const updateProfile = async (profile: Partial<UserProfile>): Promise<UserProfile> => {
    return updateMutation.mutateAsync(profile);
  };

  return {
    profile: data || null,
    isLoading,
    error: error as Error | null,
    updateProfile,
    isUpdating: updateMutation.isPending,
  };
}
