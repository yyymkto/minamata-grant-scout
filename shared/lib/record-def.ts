/**
 * Record Engine — defineRecord type definitions
 *
 * A record definition describes a business entity: its fields, status workflow,
 * list view columns, and form view sections. The generator reads these definitions
 * to produce Drizzle schema, Zod validation, Hono routes, and TanStack Query hooks.
 */

// ──────────────────────────────────────────────
// Field types
// ──────────────────────────────────────────────

export interface TextField {
  type: "text";
  label: string;
  required?: boolean;
  maxLength?: number;
  multiline?: boolean;
  defaultValue?: string;
}

export interface NumberField {
  type: "number";
  label: string;
  required?: boolean;
  min?: number;
  max?: number;
  defaultValue?: number;
}

export interface DateField {
  type: "date";
  label: string;
  required?: boolean;
  defaultValue?: string;
}

export interface SelectField {
  type: "select";
  label: string;
  required?: boolean;
  options: readonly string[];
  defaultValue?: string;
}

export interface RelationField {
  type: "relation";
  label: string;
  required?: boolean;
  relatedRecord: string;
  relatedLabel: string;
}

export interface FileField {
  type: "file";
  label: string;
  required?: boolean;
}

export type FieldDef =
  | TextField
  | NumberField
  | DateField
  | SelectField
  | RelationField
  | FileField;

// ──────────────────────────────────────────────
// Status definition
// ──────────────────────────────────────────────

export interface StatusDef {
  field: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
}

// ──────────────────────────────────────────────
// List view
// ──────────────────────────────────────────────

export interface ListViewDef<K extends string = string> {
  columns: readonly K[];
  defaultSort: {
    field: K;
    direction: "asc" | "desc";
  };
}

// ──────────────────────────────────────────────
// Form view
// ──────────────────────────────────────────────

export interface FormSectionDef<K extends string = string> {
  label: string;
  fields: readonly K[];
}

export interface FormViewDef<K extends string = string> {
  sections: readonly FormSectionDef<K>[];
}

// ──────────────────────────────────────────────
// Record definition
// ──────────────────────────────────────────────

/** Valid column keys: field keys plus the status field key (if defined). */
type AllowedKeys<
  F extends Record<string, FieldDef>,
  S extends StatusDef | undefined,
> = Extract<keyof F, string> | (S extends StatusDef ? S["field"] : never);

export interface RecordDef<
  F extends Record<string, FieldDef> = Record<string, FieldDef>,
  S extends StatusDef | undefined = StatusDef | undefined,
> {
  key: string;
  label: string;
  tableName: string;
  fields: F;
  status?: S;
  /** Enable soft delete (deletedAt column). Default: false. */
  softDelete?: boolean;
  listView: ListViewDef<AllowedKeys<F, S>>;
  formView: FormViewDef<Extract<keyof F, string>>;
}

/**
 * Define a record. This is the entry point for record definitions.
 * The function is identity at runtime — it exists for type inference.
 *
 * Field keys from `fields` (and the status field key if defined) are inferred
 * and used to constrain `listView.columns` and `formView.sections[*].fields`.
 */
/** Loosened type for components that accept any concrete RecordDef. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRecordDef = RecordDef<any, any>;

export function defineRecord<
  F extends Record<string, FieldDef>,
  S extends StatusDef | undefined = undefined,
>(def: RecordDef<F, S>): RecordDef<F, S> {
  return def;
}
