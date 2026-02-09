// @agent/sdk-client - Main exports
// Re-exports client functionality for connecting to @agent/sdk-server

export { AgentClient, type AgentClientOptions } from './client';
export { AgentHttpClient } from './http-client';
export { ChatClient, type StreamCallbacks, type ChatClientOptions } from './chat-client';
export { SessionManager, type Session } from './session';
export { 
  AgentWebSocketClient, 
  type WebSocketClientConfig, 
  type ConnectionState,
  type WebSocketCallbacks,
} from './websocket-client';
export {
  BrowserStreamClient,
  type BrowserStreamClientOptions,
  type BrowserFrame,
  type BrowserStreamConfig,
  type BrowserStreamState,
  type BrowserStreamCallbacks,
} from './browser-stream';
export { ApiClientError, WebSocketError } from './errors';
export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  SessionResponse,
  HistoryResponse,
  StreamEvent,
  StreamEventCallback,
  GenerateStreamOptions,
  TokenUsage,
  ReconnectOptions,
  StreamMetadata,
} from './types';

