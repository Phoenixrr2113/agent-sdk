import { AgentHttpClient } from './http-client';
import type { SessionManager } from './session';
import type { 
  ChatRequest, 
  GenerateStreamOptions, 
  StreamEvent, 
  TokenUsage,
  ReconnectOptions,
  StreamMetadata,
} from './types';

export type StreamCallbacks = {
  onTextDelta?: (text: string) => void;
  onToolCall?: (toolCallId: string, name: string, args: unknown) => void;
  onToolResult?: (toolCallId: string, name: string, result: unknown) => void;
  onStepStart?: (index: number) => void;
  onStepFinish?: (index: number, finishReason: string) => void;
  onComplete?: (result: { text: string; usage?: TokenUsage }) => void;
  onError?: (error: string) => void;
  onReconnect?: (attempt: number, runId: string) => void;
};

export type ChatClientOptions = {
  sessionManager?: SessionManager;
  reconnect?: ReconnectOptions;
};

const DEFAULT_RECONNECT: Required<ReconnectOptions> = {
  enabled: true,
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export class ChatClient {
  private sessionManager?: SessionManager;
  private reconnectConfig: Required<ReconnectOptions>;
  private _lastStreamMetadata?: StreamMetadata;

  constructor(private http: AgentHttpClient, options: ChatClientOptions = {}) {
    this.sessionManager = options.sessionManager;
    this.reconnectConfig = { ...DEFAULT_RECONNECT, ...options.reconnect };
  }

  /**
   * Get metadata from the last stream (workflow run ID, last event ID).
   */
  get lastStreamMetadata(): StreamMetadata | undefined {
    return this._lastStreamMetadata;
  }

  /**
   * Stream a chat response with callback handlers.
   * Supports auto-reconnection for resumable streams.
   */
  async stream(
    request: ChatRequest,
    callbacks: StreamCallbacks,
    options: GenerateStreamOptions = {}
  ): Promise<void> {
    try {
      // If session manager is enabled and sessionId provided, append history
      if (this.sessionManager && request.sessionId) {
        const history = this.sessionManager.getHistory(request.sessionId);
        if (history.length > 0) {
          request.messages = [...history, ...request.messages];
        }
        
        // Add new user messages to session
        for (const msg of request.messages.slice(history.length)) {
           this.sessionManager.addMessage(request.sessionId, msg);
        }
      }

      let fullText = '';
      let attempt = 0;
      let workflowRunId = options.workflowRunId;
      let lastEventId = options.lastEventId;
      let completed = false;

      while (!completed) {
        try {
          const streamOptions: GenerateStreamOptions = {
            ...options,
            workflowRunId,
            lastEventId,
          };

          const generator = this.http.generateStream(request, streamOptions);

          for await (const event of generator) {
            if (event.type === 'text-delta') {
              fullText += event.textDelta;
            }
            this.dispatch(event, callbacks);

            // If we get any event successfully, reset attempt counter
            attempt = 0;
          }

          // Stream finished normally
          completed = true;

          // Capture metadata for potential later reconnection
          this._lastStreamMetadata = this.http.lastStreamMetadata;
          if (this._lastStreamMetadata?.workflowRunId) {
            workflowRunId = this._lastStreamMetadata.workflowRunId;
          }
          if (this._lastStreamMetadata?.lastEventId) {
            lastEventId = this._lastStreamMetadata.lastEventId;
          }
        } catch (error) {
          // Capture what metadata we have before attempting reconnect
          this._lastStreamMetadata = this.http.lastStreamMetadata;
          if (this._lastStreamMetadata?.workflowRunId) {
            workflowRunId = this._lastStreamMetadata.workflowRunId;
          }
          if (this._lastStreamMetadata?.lastEventId) {
            lastEventId = this._lastStreamMetadata.lastEventId;
          }

          // Only attempt reconnection if:
          // 1. We have a workflow run ID (durable stream)
          // 2. Reconnect is enabled
          // 3. We haven't exhausted attempts
          // 4. The error isn't from an abort signal
          const isAbort = error instanceof DOMException && error.name === 'AbortError';
          const canReconnect = workflowRunId
            && this.reconnectConfig.enabled
            && attempt < this.reconnectConfig.maxAttempts
            && !isAbort;

          if (!canReconnect) {
            const message = error instanceof Error ? error.message : String(error);
            callbacks.onError?.(message);
            return;
          }

          attempt++;
          const delay = Math.min(
            this.reconnectConfig.baseDelayMs * Math.pow(2, attempt - 1),
            this.reconnectConfig.maxDelayMs
          );

          callbacks.onReconnect?.(attempt, workflowRunId!);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Add assistant response to session
      if (this.sessionManager && request.sessionId && fullText) {
        this.sessionManager.addMessage(request.sessionId, {
          role: 'assistant',
          content: fullText,
        });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      callbacks.onError?.(message);
    }
  }

  private dispatch(event: StreamEvent, callbacks: StreamCallbacks): void {
    switch (event.type) {
      case 'text-delta':
        callbacks.onTextDelta?.(event.textDelta);
        break;
      
      case 'tool-call':
        callbacks.onToolCall?.(event.toolCallId, event.toolName, event.args);
        break;
        
      case 'tool-result':
        callbacks.onToolResult?.(event.toolCallId, event.toolName, event.result);
        break;
        
      case 'step-start':
        callbacks.onStepStart?.(event.stepIndex);
        break;
        
      case 'step-finish':
        callbacks.onStepFinish?.(event.stepIndex, event.finishReason);
        break;
        
      case 'finish':
        callbacks.onComplete?.({ text: event.text, usage: event.usage });
        break;
        
      case 'error':
        callbacks.onError?.(event.error);
        break;
    }
  }
}
