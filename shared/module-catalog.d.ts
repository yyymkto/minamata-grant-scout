export type ModuleCatalogEntry = {
  key: "jobs" | "rate_limiter" | "kv" | "upload" | "email_delivery";
  label: string;
  kind: "core" | "optional";
  note: string;
};

export const moduleCatalog: ModuleCatalogEntry[];

