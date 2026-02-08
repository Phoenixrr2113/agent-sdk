'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-utils';
import { api } from '@/lib/api';

type NotificationChannel = 'in_app' | 'email' | 'push' | 'webhook';
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  updatedAt: string;
};

type UseNotificationsOptions = {
  autoRefresh?: boolean;
  refreshInterval?: number;
};

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => api.get<{ notifications: Notification[] }>('/api/notifications'),
    refetchInterval: autoRefresh ? refreshInterval : undefined,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/notifications/${id}`, { read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      await Promise.all(unreadIds.map(id => api.put(`/api/notifications/${id}`, { read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() }),
    markAsRead: markAsReadMutation.mutateAsync,
    dismiss: dismissMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    isDismissing: dismissMutation.isPending,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
  };
}

export type { Notification, NotificationChannel, NotificationPriority };
