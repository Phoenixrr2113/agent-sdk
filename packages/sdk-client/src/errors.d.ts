export declare class ApiClientError extends Error {
    readonly status?: number | undefined;
    readonly response?: unknown | undefined;
    constructor(message: string, status?: number | undefined, response?: unknown | undefined);
}
export declare class WebSocketError extends Error {
    readonly code?: number | undefined;
    constructor(message: string, code?: number | undefined);
}
//# sourceMappingURL=errors.d.ts.map