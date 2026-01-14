import type { StreamingChatCallbacks, ChatMessage } from './types';
export interface WebSocketClientConfig {
    url: string;
    reconnect?: boolean;
    reconnectInterval?: number;
}
export declare class AgentWebSocketClient {
    private ws;
    private config;
    constructor(config: WebSocketClientConfig);
    connect(): Promise<void>;
    send(message: ChatMessage, callbacks: StreamingChatCallbacks): void;
    disconnect(): void;
}
//# sourceMappingURL=websocket-client.d.ts.map