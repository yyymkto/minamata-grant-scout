export type ModuleCatalogEntry = {
  key: string;
  label: string;
  kind: "core" | "optional";
  note: string;
};

export declare const moduleCatalog: ModuleCatalogEntry[];
