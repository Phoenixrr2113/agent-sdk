// HTTP client for agent server
import { ApiClientError } from './errors';
export class AgentHttpClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async generate(request) {
        const response = await fetch(`${this.baseUrl}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            throw new ApiClientError('Generate failed', response.status);
        }
        return response.json();
    }
    async getSession(sessionId) {
        const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`);
        if (!response.ok) {
            throw new ApiClientError('Session not found', response.status);
        }
        return response.json();
    }
    async getHistory(sessionId) {
        const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/history`);
        if (!response.ok) {
            throw new ApiClientError('History not found', response.status);
        }
        return response.json();
    }
}
//# sourceMappingURL=http-client.js.map