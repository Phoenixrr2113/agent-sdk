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
 * Options for auto-reconnection on resumable streams.
 */
export interface ReconnectOptions {
  /** Enable auto-reconnect on disconnect. Default: true when workflowRunId is present. */
  enabled?: boolean;

  /** Maximum number of reconnect attempts. Default: 3 */
  maxAttempts?: number;

  /** Base delay between reconnect attempts in ms. Default: 1000. Exponential backoff is applied. */
  baseDelayMs?: number;

  /** Maximum delay between reconnect attempts in ms. Default: 30000 */
  maxDelayMs?: number;
}

/**
 * Options for streaming generation.
 */
export interface GenerateStreamOptions {
  /** AbortSignal for timeout/cancellation */
  signal?: AbortSignal;

  /** Workflow run ID for resumable streams. Set automatically on reconnect. */
  workflowRunId?: string;

  /** Last event ID received. Used for replay on reconnection. */
  lastEventId?: string;

  /** Reconnect configuration for resumable streams. */
  reconnect?: ReconnectOptions;
}

/**
 * Result metadata from a streaming generation.
 * Includes the workflow run ID if the server returned one (durable agent).
 */
export interface StreamMetadata {
  /** Workflow run ID returned by the server. Undefined for non-durable agents. */
  workflowRunId?: string;

  /** The last event ID received from the server. */
  lastEventId?: string;
}
