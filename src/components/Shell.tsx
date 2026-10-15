import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ClipboardCheck,
  Building2,
  FileText,
  UserRound,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  ChevronDown,
  Search,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ErrorBox, Loading } from './ui';
const nav = [
  {
    section: 'WORKSPACE',
    links: [
      { to: '/', label: 'Overview', icon: LayoutDashboard },
      { to: '/listings', label: 'My listings', icon: Package },
      { to: '/inventory', label: 'Inventory', icon: Boxes },
      { to: '/inspections', label: 'Inspections', icon: ClipboardCheck },
    ],
  },
  {
    section: 'BUSINESS',
    links: [
      { to: '/business', label: 'Business profile', icon: Building2 },
      { to: '/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    section: 'ACCOUNT',
    links: [
      { to: '/profile', label: 'My profile', icon: UserRound },
      { to: '/security', label: 'Security & sessions', icon: ShieldCheck },
    ],
  },
];
export default function Shell() {
  const auth = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  if (!auth.session) return <Navigate to="/login" replace />;
  const current = nav
    .flatMap((n) => n.links)
    .find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));
  return (
    <div className="app-shell">
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}stockout-logo.png`} alt="Stockout" />
          <span>SELLER</span>
          <button
            className="icon-button mobile"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="nav-search">
          <Search size={15} />
          <input
            aria-label="Find a page"
            placeholder="Find a page"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <nav>
          {nav.map((group) => (
            <div className="nav-group" key={group.section}>
              <p>{group.section}</p>
              {group.links
                .filter((l) => l.label.toLowerCase().includes(search.toLowerCase()))
                .map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setOpen(false)}>
                    <l.icon size={18} />
                    <span>{l.label}</span>
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="impact-note">
            <div className="eyebrow">MAKE ROOM FOR WHAT’S NEXT</div>
            <p>
              Surplus today.
              <br />
              Opportunity tomorrow.
            </p>
            <ArrowUpRight size={20} />
          </div>
          <NavLink to="/profile" className="seller-avatar">
            <span>{(auth.session.displayName || 'S').slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{auth.session.displayName || 'Seller account'}</strong>
              <small>Seller workspace</small>
            </div>
          </NavLink>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Seller portal <span>/</span> <strong>{current?.label || 'Listing workspace'}</strong>
          </div>
          <div className="topbar-right">
            {auth.contexts.length > 0 && (
              <div className="seller-select">
                <Building2 size={15} />
                <select
                  aria-label="Active seller"
                  value={auth.seller?.sellerId || ''}
                  onChange={(e) => auth.selectSeller(e.target.value)}
                >
                  {auth.contexts.map((s) => (
                    <option key={s.sellerId} value={s.sellerId}>
                      {s.displayName || s.sellerId}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </div>
            )}
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => void auth.logout().catch(() => {})}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="main-content">
          {auth.actor.isPending ? (
            <Loading />
          ) : auth.actor.isError ? (
            <ErrorBox error={auth.actor.error} retry={() => void auth.actor.refetch()} />
          ) : (
            <Outlet key={auth.seller?.sellerId || 'new'} />
          )}
        </main>
        <footer className="workspace-footer">
          <span>Stockout Seller Portal</span>
          <span>Less waste. More possibility.</span>
        </footer>
      </div>
    </div>
  );
}
