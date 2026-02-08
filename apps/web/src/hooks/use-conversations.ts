'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Conversation = {
  id: string;
  title?: string;
  preview?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown>; result?: unknown }>;
  createdAt: string;
};

export function useConversations() {
  const queryClient = useQueryClient();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<{ conversations: Conversation[] }>('/api/conversations'),
  });
  
  const createConversation = useMutation({
    mutationFn: (title?: string) => api.post<Conversation>('/api/conversations', { title }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
  
  const updateConversation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string } }) => 
      api.put<Conversation>(`/api/conversations/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
  
  const deleteConversation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/conversations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  });
  
  return {
    conversations: data?.conversations ?? [],
    isLoading,
    error,
    createConversation: createConversation.mutateAsync,
    updateConversation: async (id: string, data: { title?: string }) => 
      updateConversation.mutateAsync({ id, data }),
    deleteConversation: deleteConversation.mutateAsync,
    isCreating: createConversation.isPending,
    isUpdating: updateConversation.isPending,
    isDeleting: deleteConversation.isPending,
  };
}

export function useConversation(id: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.get<{ conversation: Conversation; messages: Message[] }>(`/api/conversations/${id}`),
    enabled: !!id,
  });
  
  const saveMessage = useMutation({
    mutationFn: (message: { role: string; content: string; toolCalls?: unknown[] }) => 
      api.post(`/api/conversations/${id}/messages`, message),
  });
  
  return {
    conversation: data?.conversation,
    messages: data?.messages ?? [],
    isLoading,
    error,
    saveMessage: saveMessage.mutateAsync,
    isSaving: saveMessage.isPending,
  };
}
