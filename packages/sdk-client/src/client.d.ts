import type { ChatRequest, ChatResponse, StreamingChatCallbacks, ChatMessage } from './types';
export interface AgentClientOptions {
    baseUrl: string;
    useWebSocket?: boolean;
}
export declare class AgentClient {
    private httpClient;
    private wsClient?;
    constructor(options: AgentClientOptions);
    generate(request: ChatRequest): Promise<ChatResponse>;
    stream(message: ChatMessage, callbacks: StreamingChatCallbacks): Promise<void>;
    disconnect(): void;
}
//# sourceMappingURL=client.d.ts.map