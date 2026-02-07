import { AgentHttpClient } from './http-client';
import type { SessionManager } from './session';
import type { 
  ChatRequest, 
  GenerateStreamOptions, 
  StreamEvent, 
  TokenUsage 
} from './types';

export type StreamCallbacks = {
  onTextDelta?: (text: string) => void;
  onToolCall?: (toolCallId: string, name: string, args: unknown) => void;
  onToolResult?: (toolCallId: string, name: string, result: unknown) => void;
  onStepStart?: (index: number) => void;
  onStepFinish?: (index: number, finishReason: string) => void;
  onComplete?: (result: { text: string; usage?: TokenUsage }) => void;
  onError?: (error: string) => void;
};

export type ChatClientOptions = {
  sessionManager?: SessionManager;
};

export class ChatClient {
  private sessionManager?: SessionManager;

  constructor(private http: AgentHttpClient, options: ChatClientOptions = {}) {
    this.sessionManager = options.sessionManager;
  }

  /**
   * Stream a chat response with callback handlers
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

      const generator = this.http.generateStream(request, options);
      
      let fullText = '';

      for await (const event of generator) {
        if (event.type === 'text-delta') {
          fullText += event.textDelta;
        }
        this.dispatch(event, callbacks);
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
