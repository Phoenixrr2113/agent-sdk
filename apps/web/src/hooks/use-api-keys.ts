'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-utils';

export type APIKeyScope =
  | 'read:missions'
  | 'write:missions'
  | 'read:automations'
  | 'write:automations'
  | 'read:devices'
  | 'write:devices'
  | 'full_access';

export type APIKey = {
  id: string;
  name: string;
  keyPrefix: string; // "ctrl_abc1..."
  scopes: APIKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type CreateAPIKeyInput = {
  name: string;
  scopes: APIKeyScope[];
  expiresAt?: string | null;
};

export type CreateAPIKeyResponse = APIKey & {
  key: string; // Full key, shown only once
};

type UseAPIKeysReturn = {
  apiKeys: APIKey[];
  isLoading: boolean;
  error: Error | null;
  createKey: (input: CreateAPIKeyInput) => Promise<CreateAPIKeyResponse>;
  revokeKey: (id: string) => Promise<void>;
  isCreating: boolean;
  isRevoking: boolean;
};

export function useAPIKeys(): UseAPIKeysReturn {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.apiKeys.list(),
    queryFn: () => api.get<{ keys: APIKey[] }>('/api/api-keys'),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateAPIKeyInput) =>
      api.post<CreateAPIKeyResponse>('/api/api-keys', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
    },
  });

  const createKey = async (input: CreateAPIKeyInput): Promise<CreateAPIKeyResponse> => {
    return createMutation.mutateAsync(input);
  };

  const revokeKey = async (id: string): Promise<void> => {
    await revokeMutation.mutateAsync(id);
  };

  return {
    apiKeys: data?.keys || [],
    isLoading,
    error: error as Error | null,
    createKey,
    revokeKey,
    isCreating: createMutation.isPending,
    isRevoking: revokeMutation.isPending,
  };
}
