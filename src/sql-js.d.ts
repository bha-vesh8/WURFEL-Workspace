declare module 'sql.js' {
  export interface Statement {
    bind(values?: any): boolean;
    step(): boolean;
    getAsObject(params?: any): Record<string, any>;
    run(values?: any): void;
    free(): boolean;
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: any): this;
    exec(sql: string, params?: any): Array<{ columns: string[]; values: any[][] }>;
    prepare(sql: string, params?: any): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}
