import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { useSession } from "./hooks/useSession";
import { AppShell } from "./components/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { SettingsPage } from "./pages/SettingsPage";

const queryClient = new QueryClient();

/**
 * Record Engine nav items — add entries here as you generate new records.
 * Each record page will be mounted at /:recordKey
 */
const recordNavItems: { label: string; href: string }[] = [
  // Example: { label: "Houses", href: "/houses" },
];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading } = useSession();
  if (isLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </AppShell>
    );
  }
  if (!session) {
    return (
      <AppShell>
        <AuthPage />
      </AppShell>
    );
  }
  return (
    <AppShell navItems={recordNavItems}>
      {children}
    </AppShell>
  );
}

function WelcomePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-white">Tara Grant Scout</h1>
      <p className="text-sm text-slate-400">
        Ready to go. Add your first record with the Record Engine.
      </p>
    </div>
  );
}

function AppRoutes() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/settings" component={SettingsPage} />
        <Route path="/" component={WelcomePage} />
        {/* record-engine:routes */}
        <Route>
          <div className="mx-auto max-w-3xl py-20 text-center">
            <h2 className="text-xl font-semibold text-white">404</h2>
            <p className="mt-2 text-sm text-slate-400">Page not found</p>
          </div>
        </Route>
      </Switch>
    </AuthGuard>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
