export interface Env {
  DB: D1Database;
  KV?: KVNamespace;
  ASSETS: Fetcher;
  CORS_ORIGIN?: string;
  APP_BASE_URL?: string;
}

export interface AppVariables {
  requestId: string;
}

export type AppContextEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
