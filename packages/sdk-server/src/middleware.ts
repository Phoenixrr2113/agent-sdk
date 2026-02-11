import { timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';
import { createLogger } from '@agntk/logger';

const log = createLogger('@agntk/server:middleware');

/** Default max request body size: 1 MB */
const DEFAULT_MAX_BODY_SIZE = 1024 * 1024;

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyGenerator?: (c: Context) => string;
};

export type AuthOptions = {
  apiKey?: string;
  headerName?: string;
};

export type BodyLimitOptions = {
  /** Max body size in bytes. Default: 1 MB */
  maxSize?: number;
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
 * Create API key auth middleware (timing-safe comparison)
 */
export function createAuthMiddleware(options: AuthOptions) {
  const headerName = options.headerName || 'x-api-key';

  return async (c: Context, next: Next) => {
    if (!options.apiKey) {
      return next();
    }

    const apiKey = c.req.header(headerName);

    if (!apiKey || !safeEqual(apiKey, options.apiKey)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return next();
  };
}

/**
 * Create body size limit middleware
 */
export function createBodyLimitMiddleware(options: BodyLimitOptions = {}) {
  const maxSize = options.maxSize ?? DEFAULT_MAX_BODY_SIZE;

  return async (c: Context, next: Next) => {
    const contentLength = c.req.header('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      return c.json({ error: 'Request body too large' }, 413);
    }
    return next();
  };
}

/**
 * Timing-safe string comparison to prevent timing attacks on auth tokens.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against self to keep constant time regardless of length mismatch
    const buf = Buffer.from(a);
    timingSafeEqual(buf, buf);
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
