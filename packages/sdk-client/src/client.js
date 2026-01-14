// Main client combining HTTP and WebSocket
import { AgentHttpClient } from './http-client';
import { AgentWebSocketClient } from './websocket-client';
export class AgentClient {
    httpClient;
    wsClient;
    constructor(options) {
        this.httpClient = new AgentHttpClient(options.baseUrl);
        if (options.useWebSocket) {
            const wsUrl = options.baseUrl.replace(/^http/, 'ws') + '/ws';
            this.wsClient = new AgentWebSocketClient({ url: wsUrl });
        }
    }
    async generate(request) {
        return this.httpClient.generate(request);
    }
    async stream(message, callbacks) {
        if (!this.wsClient) {
            throw new Error('WebSocket not configured');
        }
        await this.wsClient.connect();
        this.wsClient.send(message, callbacks);
    }
    disconnect() {
        this.wsClient?.disconnect();
    }
}
//# sourceMappingURL=client.js.map