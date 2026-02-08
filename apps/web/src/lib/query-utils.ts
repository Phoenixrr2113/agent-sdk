import { api } from '@/lib/api';

export const queryKeys = {
  missions: {
    all: ['missions'] as const,
    list: (filters?: { status?: string }) => [...queryKeys.missions.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.missions.all, 'detail', id] as const,
  },
  automations: {
    all: ['automations'] as const,
    list: (filters?: { status?: string }) => [...queryKeys.automations.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.automations.all, 'detail', id] as const,
  },
  devices: {
    all: ['devices'] as const,
    list: (filters?: { platform?: string }) => [...queryKeys.devices.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.devices.all, 'detail', id] as const,
  },
  approvals: {
    all: ['approvals'] as const,
    list: () => [...queryKeys.approvals.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.approvals.all, 'detail', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => [...queryKeys.notifications.all, 'list'] as const,
  },
  activity: {
    all: ['activity'] as const,
    list: (filters?: { type?: string; dateRange?: string }) =>
      [...queryKeys.activity.all, 'list', filters] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  profile: {
    all: ['profile'] as const,
  },
  apiKeys: {
    all: ['apiKeys'] as const,
    list: () => [...queryKeys.apiKeys.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.apiKeys.all, 'detail', id] as const,
  },
} as const;

export async function fetcher<T>(url: string): Promise<T> {
  return api.get<T>(url);
}
