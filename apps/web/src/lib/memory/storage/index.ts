export * from './types';
export { createInMemoryStorage } from './memory-storage';
export { createSQLiteStorage } from './sqlite-storage';

import { createInMemoryStorage } from './memory-storage';
import { createSQLiteStorage } from './sqlite-storage';
import type { StorageAdapter } from './types';

export type StorageType = 'memory' | 'sqlite';

export type StorageConfig = {
  type: StorageType;
  path?: string;
};

export function createStorage(config: StorageConfig): StorageAdapter {
  switch (config.type) {
    case 'sqlite': {
      if (!config.path) {
        throw new Error('SQLite storage requires a path');
      }
      return createSQLiteStorage(config.path);
    }
    case 'memory':
    default:
      return createInMemoryStorage();
  }
}
