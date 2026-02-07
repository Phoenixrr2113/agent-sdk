// Client types

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  sessionId?: string;
}

export interface ChatResponse {
  message: ChatMessage;
  sessionId: string;
}

export interface SessionResponse {
  sessionId: string;
}

export interface HistoryResponse {
  messages: ChatMessage[];
}

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type StreamEvent =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown }
  | { type: 'step-start'; stepIndex: number }
  | { type: 'step-finish'; stepIndex: number; finishReason: string }
  | { type: 'finish'; text: string; usage?: TokenUsage }
  | { type: 'error'; error: string };

export type StreamEventCallback = (event: StreamEvent) => void;

/**
 * Options for streaming generation.
 */
export interface GenerateStreamOptions {
  /** AbortSignal for timeout/cancellation */
  signal?: AbortSignal;
}
