declare module '@ai-sdk/openai' {
  export const openai: {
    embedding(model: string): unknown;
  };
}

declare module 'better-sqlite3' {
  interface Statement {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
  interface DatabaseInstance {
    prepare(sql: string): Statement;
    exec(sql: string): void;
    close(): void;
    pragma(statement: string): unknown;
  }
  interface DatabaseConstructor {
    new(filename: string): DatabaseInstance;
    (filename: string): DatabaseInstance;
  }
  const Database: DatabaseConstructor;
  export = Database;
}
