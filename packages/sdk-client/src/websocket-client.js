// WebSocket client for streaming
import { WebSocketError } from './errors';
export class AgentWebSocketClient {
    ws = null;
    config;
    constructor(config) {
        this.config = config;
    }
    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.config.url);
                this.ws.onopen = () => resolve();
                this.ws.onerror = (event) => reject(new WebSocketError('Connection failed'));
            }
            catch (error) {
                reject(new WebSocketError('Failed to create WebSocket'));
            }
        });
    }
    send(message, callbacks) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new WebSocketError('WebSocket not connected');
        }
        this.ws.send(JSON.stringify(message));
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'text-delta' && callbacks.onText) {
                    callbacks.onText(data.text);
                }
                else if (data.type === 'complete' && callbacks.onComplete) {
                    callbacks.onComplete();
                }
            }
            catch (e) {
                callbacks.onError?.(new Error('Failed to parse message'));
            }
        };
    }
    disconnect() {
        this.ws?.close();
        this.ws = null;
    }
}
//# sourceMappingURL=websocket-client.js.map