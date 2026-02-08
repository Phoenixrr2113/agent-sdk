'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ActionResult, ConnectionStatus, Device, DeviceAction } from '@/types/motia';
import { queryKeys } from '@/lib/query-utils';
import { api } from '@/lib/api';

export type { ActionResult, ConnectionStatus, Device, DeviceAction } from '@/types/motia';

type UseDevicesOptions = {
  status?: ConnectionStatus;
  autoRefresh?: boolean;
  refreshInterval?: number;
};

type UseDevicesReturn = {
  devices: Device[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  dispatchAction: (deviceId: string, action: DeviceAction) => Promise<ActionResult>;
  getDeviceById: (deviceId: string) => Device | undefined;
  isDispatching: boolean;
};

type ActionPayload = {
  deviceId: string;
  action: DeviceAction;
};

type DeviceRecord = {
  id: string;
  userId: string;
  name: string;
  platform: 'desktop' | 'android' | 'ios' | 'web';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  metadata: Record<string, unknown> | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapDeviceRecordToDevice(record: DeviceRecord): Device {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    platform: record.platform,
    metadata: record.metadata ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    connection: {
      deviceId: record.id,
      userId: record.userId,
      status: record.status,
      lastSeenAt: record.lastSeenAt ?? record.updatedAt,
    },
  };
}

export function useDevices(options: UseDevicesOptions = {}): UseDevicesReturn {
  const { status, autoRefresh = false, refreshInterval = 30000 } = options;
  const queryClient = useQueryClient();

  const queryKey = queryKeys.devices.list(status ? { platform: status } : undefined);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const url = status ? `/api/devices?status=${status}` : '/api/devices';
      const result = await api.get<{ devices: DeviceRecord[] }>(url);
      return { devices: result.devices.map(mapDeviceRecordToDevice) };
    },
    refetchInterval: autoRefresh ? refreshInterval : undefined,
  });

  const actionMutation = useMutation({
    mutationFn: ({ deviceId, action }: ActionPayload) =>
      api.post<{ result: ActionResult }>(`/api/devices/${deviceId}/actions`, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
    },
  });

  const dispatchAction = async (deviceId: string, action: DeviceAction): Promise<ActionResult> => {
    const response = await actionMutation.mutateAsync({ deviceId, action });
    return response.result;
  };

  const getDeviceById = (deviceId: string): Device | undefined => {
    return data?.devices?.find(d => d.id === deviceId);
  };

  const refetch = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey });
  };

  return {
    devices: data?.devices ?? [],
    isLoading,
    error: error as Error | null,
    refetch,
    dispatchAction,
    getDeviceById,
    isDispatching: actionMutation.isPending,
  };
}
