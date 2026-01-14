import type { ChatRequest, ChatResponse, SessionResponse, HistoryResponse } from './types';
export declare class AgentHttpClient {
    private baseUrl;
    constructor(baseUrl: string);
    generate(request: ChatRequest): Promise<ChatResponse>;
    getSession(sessionId: string): Promise<SessionResponse>;
    getHistory(sessionId: string): Promise<HistoryResponse>;
}
//# sourceMappingURL=http-client.d.ts.map