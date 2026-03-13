export function AppShell({
  children,
}: {
  children: React.ReactNode;
  navItems?: { label: string; href: string }[];
}) {
  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
