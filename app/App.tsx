import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { AppShell } from "./components/AppShell";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GrantListPage } from "./pages/grants/GrantListPage";
import { GrantDetailPage } from "./pages/grants/GrantDetailPage";
import { MethodologyPage } from "./pages/grants/MethodologyPage";

const queryClient = new QueryClient();

const navItems = [
  { label: "補助金一覧", href: "/grants" },
  { label: "評価方法について", href: "/grants/about-scoring" },
];

function AppRoutes() {
  return (
    <AppShell navItems={navItems}>
      <Switch>
        <Route path="/grants/about-scoring" component={MethodologyPage} />
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
    </AppShell>
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
