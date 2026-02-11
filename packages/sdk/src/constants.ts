/**
 * @agntk/core - SDK-wide Constants
 *
 * Centralized constants for URLs, defaults, and magic numbers.
 * All hardcoded values should live here for easy configuration.
 */

// ============================================================================
// Embedding
// ============================================================================

/** Default embedding API endpoint */
export const DEFAULT_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';

/** Default embedding model */
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

// ============================================================================
// Geolocation
// ============================================================================

/** Geolocation API endpoint (HTTPS) */
export const GEOLOCATION_API_URL = 'https://ip-api.com/json/?fields=city,regionName,country,countryCode,timezone';

/** Whether geolocation fetch is enabled by default */
export const GEOLOCATION_ENABLED_DEFAULT = false;

// ============================================================================
// Browser Tool
// ============================================================================

/** Default browser command timeout (ms) */
export const BROWSER_DEFAULT_TIMEOUT = 30_000;

/** Max output length from browser CLI (chars) */
export const BROWSER_MAX_OUTPUT_LENGTH = 50_000;

/** Max buffer size for browser CLI output (bytes) */
export const BROWSER_MAX_BUFFER = 5 * 1024 * 1024;

// ============================================================================
// Memory
// ============================================================================

/** Default top-K results for memory recall */
export const DEFAULT_MEMORY_TOP_K = 5;

/** Default similarity threshold for memory recall */
export const DEFAULT_MEMORY_SIMILARITY_THRESHOLD = 0.7;
