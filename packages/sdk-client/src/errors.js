// Error classes
export class ApiClientError extends Error {
    status;
    response;
    constructor(message, status, response) {
        super(message);
        this.status = status;
        this.response = response;
        this.name = 'ApiClientError';
    }
}
export class WebSocketError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'WebSocketError';
    }
}
//# sourceMappingURL=errors.js.map