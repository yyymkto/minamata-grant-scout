import type { DateField as DateFieldDef } from "@shared/lib/record-def";

export function DateField({
  def,
  value,
  onChange,
  error,
  fieldKey,
  required,
}: {
  def: DateFieldDef;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  fieldKey?: string;
  required?: boolean;
}) {
  const id = fieldKey ? `field-${fieldKey}` : undefined;
  const errorId = fieldKey ? `field-${fieldKey}-error` : undefined;

  return (
    <div>
      <label className="mb-1.5 block text-sm text-slate-300" htmlFor={id}>
        {def.label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus:border-amber-300/40"
        aria-required={required || undefined}
        aria-describedby={error && errorId ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
