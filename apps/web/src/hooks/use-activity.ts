'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-utils';
import { api } from '@/lib/api';

type ActivityType = 'action' | 'approval' | 'mission' | 'automation' | 'device';

type ActivityItem = {
  id: string;
  type: ActivityType;
  action: string;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  missionId?: string;
  missionTitle?: string;
  deviceId?: string;
  deviceName?: string;
  createdAt: string;
};

type UseActivityOptions = {
  type?: ActivityType;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

export function useActivity(options: UseActivityOptions = {}) {
  const { type, limit = 50, startDate, endDate } = options;

  const queryKey = queryKeys.activity.list({ type, dateRange: startDate });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (limit) params.set('limit', limit.toString());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      
      const url = `/api/activity${params.toString() ? `?${params}` : ''}`;
      return api.get<{ activities: ActivityItem[] }>(url);
    },
  });

  return {
    activities: data?.activities ?? [],
    isLoading,
    error,
    refetch,
  };
}

export type { ActivityItem, ActivityType };
