/**
 * @agntk/core - SDK-wide Constants
 *
 * Centralized constants for URLs, defaults, and magic numbers.
 * All hardcoded values should live here for easy configuration.
 */

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

