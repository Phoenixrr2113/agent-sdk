/**
 * Shared helpers for graph operations
 */

import type { QueryParams } from '../client';

/**
 * Convert typed props to QueryParams for graph queries.
 * Node prop interfaces are structurally compatible with QueryParams but
 * lack an explicit index signature. This helper bridges the gap safely.
 */
export function toParams<T extends object>(props: T): QueryParams {
  const params: QueryParams = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) {
      params[key] = value as QueryParams[string];
    }
  }
  return params;
}
