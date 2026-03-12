export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
