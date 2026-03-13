import { Link, useLocation } from "wouter";

export function AppShell({
  children,
  navItems = [],
}: {
  children: React.ReactNode;
  navItems?: { label: string; href: string }[];
}) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_32%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-white"
            >
              補助金スカウト
            </Link>
            <nav className="flex gap-1 overflow-x-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    (item.href === "/" ? location === "/" : location.startsWith(item.href))
                      ? "bg-amber-400/15 text-amber-200"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
