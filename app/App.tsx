import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { useSession } from "./hooks/useSession";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthPage } from "./pages/AuthPage";
import { SettingsPage } from "./pages/SettingsPage";
import { GrantListPage } from "./pages/grants/GrantListPage";
import { GrantDetailPage } from "./pages/grants/GrantDetailPage";

const queryClient = new QueryClient();

const navItems = [
  { label: "補助金一覧", href: "/grants" },
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
    <AppShell navItems={navItems}>
      {children}
    </AppShell>
  );
}

function AppRoutes() {
  return (
    <AuthGuard>
      <Switch>
        <Route path="/settings" component={SettingsPage} />
        <Route path="/grants" component={GrantListPage} />
        <Route path="/grants/:id" component={GrantDetailPage} />
        <Route path="/">
          <GrantListPage />
        </Route>
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
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
