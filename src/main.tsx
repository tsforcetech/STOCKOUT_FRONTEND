import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/auth';
import Shell from './components/Shell';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Business, { Documents } from './pages/Business';
import Listings from './pages/Listings';
import ListingEditor from './pages/ListingEditor';
import ListingDetail from './pages/ListingDetail';
import { ProfilePage, SecurityPage } from './pages/Account';
import { Empty } from './components/ui';
import './styles.css';
const Router = import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter;
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30000 },
    mutations: { retry: false },
  },
});
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <div className="fatal-error">
          <h1>Unable to display this screen</h1>
          <p>
            Please reload the page. If the issue persists, check that the API response matches the
            expected contract.
          </p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Reload portal
          </button>
        </div>
      );
    return this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route element={<Shell />}>
                <Route index element={<Dashboard />} />
                <Route path="business" element={<Business />} />
                <Route path="documents" element={<Documents />} />
                <Route path="listings" element={<Listings />} />
                <Route path="listings/new" element={<ListingEditor />} />
                <Route path="listings/:id" element={<ListingDetail />} />
                <Route path="inventory" element={<Listings purpose="inventory" />} />
                <Route path="inspections" element={<Listings purpose="inspections" />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="security" element={<SecurityPage />} />
                <Route
                  path="*"
                  element={
                    <Empty
                      title="Page not found"
                      description="This page isn’t part of your seller workspace."
                      action={
                        <Link className="button primary" to="/">
                          Back to overview
                        </Link>
                      }
                    />
                  }
                />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
