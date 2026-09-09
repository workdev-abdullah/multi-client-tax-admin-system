import { useState } from 'react';

const menu = [
  { key: 'Dashboard', icon: '⌂' },
  { key: 'Clients', icon: '👥' },
  { key: 'Products', icon: '📦' },
  { key: 'Invoices', icon: '🧾' },
  { key: 'Summary', icon: '📊' },
  { key: 'Inventory', icon: '📦' },
  { key: 'Settings', icon: '⚙' }
];

export default function AppShell({ page, onNavigate, admin, clients = [], selectedClientId = '', onClientChange, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function navigate(nextPage) {
    onNavigate(nextPage);
    setMobileOpen(false);
  }

  return (
    <div className="app-shell">
      {mobileOpen && <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="logo">TAX ADMIN</div>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {menu.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav ${page === item.key ? 'active' : ''}`}
              aria-current={page === item.key ? 'page' : undefined}
              onClick={() => navigate(item.key)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.key}</span>
            </button>
          ))}
        </nav>
        <button className="nav logout" type="button" onClick={onLogout}>
          <span className="nav-icon" aria-hidden="true">↪</span>
          <span>Logout</span>
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-nav-toggle" type="button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>☰</button>
          <div>
            <h2>{page}</h2>
            <span className="muted">Admin: {admin.email}</span>
          </div>
          <div className="workspace-switcher">
            <label>Active Client
              <select value={selectedClientId} onChange={(e) => onClientChange?.(e.target.value)} disabled={!clients.length}>
                {!clients.length ? <option value="">No active clients</option> : clients.map((c) => <option key={c._id} value={c._id}>{c.name}{c.businessName ? ` — ${c.businessName}` : ''}</option>)}
              </select>
            </label>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
