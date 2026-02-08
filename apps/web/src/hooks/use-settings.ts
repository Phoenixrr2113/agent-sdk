'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-utils';

export type Theme = 'light' | 'dark' | 'system';

export type NotificationPreferences = {
  email: boolean;
  push: boolean;
  missionComplete: boolean;
  missionFailed: boolean;
  approvalRequired: boolean;
  automationFailed: boolean;
};

export type UserSettings = {
  theme: Theme;
  accentColor?: string;
  notifications: NotificationPreferences;
  timezone?: string;
  language?: string;
};

type UseSettingsReturn = {
  settings: UserSettings | null;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (settings: Partial<UserSettings>) => Promise<UserSettings>;
  isUpdating: boolean;
};

const defaultSettings: UserSettings = {
  theme: 'system',
  accentColor: '#00ff88',
  notifications: {
    email: true,
    push: true,
    missionComplete: true,
    missionFailed: true,
    approvalRequired: true,
    automationFailed: true,
  },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: 'en',
};

export function useSettings(): UseSettingsReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: () => api.get<UserSettings>('/api/settings'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: (settings: Partial<UserSettings>) =>
      api.put<UserSettings>('/api/settings', settings),
    onMutate: async (newSettings) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.all });

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<UserSettings>(queryKeys.settings.all);

      // Optimistically update to new value
      if (previousSettings) {
        queryClient.setQueryData<UserSettings>(queryKeys.settings.all, {
          ...previousSettings,
          ...newSettings,
        });
      }

      return { previousSettings };
    },
    onError: (_err, _newSettings, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKeys.settings.all, context.previousSettings);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });

  const updateSettings = async (settings: Partial<UserSettings>): Promise<UserSettings> => {
    return updateMutation.mutateAsync(settings);
  };

  return {
    settings: data || defaultSettings,
    isLoading,
    error: error as Error | null,
    updateSettings,
    isUpdating: updateMutation.isPending,
  };
}
