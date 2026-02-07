import type { Context, Next } from 'hono';
import { createLogger } from '@agent/logger';

const log = createLogger('@agent/sdk-server:middleware');

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyGenerator?: (c: Context) => string;
};

export type AuthOptions = {
  apiKey?: string;
  headerName?: string;
};

/**
 * Create logging middleware
 */
export function createLoggingMiddleware() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    const { method, path } = c.req;
    
    log.info('Request started', { method, path });
    
    await next();
    
    const duration = Date.now() - start;
    log.info('Request completed', { 
      method, 
      path, 
      status: c.res.status, 
      duration: `${duration}ms` 
    });
  };
}

/**
 * Create in-memory rate limiting middleware
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const hits = new Map<string, { count: number; reset: number }>();
  let lastCleanup = Date.now();
  const cleanupInterval = options.windowMs * 2;
  
  const cleanup = (now: number) => {
    if (now - lastCleanup < cleanupInterval) return;
    lastCleanup = now;
    for (const [key, record] of hits) {
      if (now > record.reset) {
        hits.delete(key);
      }
    }
  };
  
  return async (c: Context, next: Next) => {
    const key = options.keyGenerator ? options.keyGenerator(c) : c.req.header('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    cleanup(now);
    
    const record = hits.get(key) || { count: 0, reset: now + options.windowMs };
    
    if (now > record.reset) {
      record.count = 0;
      record.reset = now + options.windowMs;
    }
    
    if (record.count >= options.max) {
      c.header('Retry-After', Math.ceil((record.reset - now) / 1000).toString());
      return c.json({ error: 'Too many requests' }, 429);
    }
    
    record.count++;
    hits.set(key, record);
    
    return next();
  };
}

/**
 * Create API key auth middleware
 */
export function createAuthMiddleware(options: AuthOptions) {
  const headerName = options.headerName || 'x-api-key';
  
  return async (c: Context, next: Next) => {
    if (!options.apiKey) {
      return next();
    }
    
    const apiKey = c.req.header(headerName);
    
    if (!apiKey || apiKey !== options.apiKey) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    return next();
  };
}
