/**
 * Graph operations — barrel export.
 * Re-exports sub-modules and provides the unified GraphOperations facade.
 */

export { CYPHER } from './cypher';
export { toParams } from './shared';

export { type FileOps, FileOpsImpl } from './file-ops';
export { type EpisodeOps, type EpisodeRow, EpisodeOpsImpl } from './episode-ops';
export { type EntityOps, EntityOpsImpl } from './entity-ops';
export { type QueryOps, QueryOpsImpl } from './query-ops';

export { createOperations, type GraphOperations } from './facade';
