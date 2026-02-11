/**
 * @codegraph/graph - Query Operations (barrel re-export)
 *
 * This file re-exports from the queries/ sub-modules for backward compat.
 * New code should import from './queries/index' directly.
 */
export { createQueries, type GraphQueries } from './queries/builders';
