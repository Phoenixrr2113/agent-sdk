/**
 * @codegraph/graph - CRUD Operations (barrel re-export)
 *
 * This file re-exports from the operations/ sub-modules for backward compat.
 * New code should import from './operations/index' directly.
 */
export {
  createOperations,
  type GraphOperations,
} from './operations/facade';

export { type EpisodeRow } from './operations/episode-ops';
