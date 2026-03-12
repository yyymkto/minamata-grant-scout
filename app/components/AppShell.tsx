import { Link, useLocation } from "wouter";
import { useSession, useLogout } from "~/hooks/useSession";
import { useHealth } from "~/hooks/useHealth";

export function AppShell({
  children,
  navItems = [],
}: {
  children: React.ReactNode;
  navItems?: { label: string; href: string }[];
}) {
  const { data: session } = useSession();
  const { data: health } = useHealth();
  const logout = useLogout();
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
              cf-starter
            </Link>
            {session ? (
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
                <Link
                  href="/settings"
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    location === "/settings"
                      ? "bg-amber-400/15 text-amber-200"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Settings
                </Link>
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {health?.checks ? (
              <div className="flex gap-2">
                {Object.entries(health.checks).map(([k, v]) => (
                  <span
                    key={k}
                    className={`rounded-full px-2 py-0.5 text-xs font-mono ${
                      v === "ok"
                        ? "bg-emerald-400/15 text-emerald-200"
                        : "bg-rose-400/15 text-rose-200"
                    }`}
                  >
                    {k}
                  </span>
                ))}
              </div>
            ) : null}
            {session ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">{session.name}</span>
                <button
                  type="button"
                  onClick={() => logout.mutate()}
                  className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
