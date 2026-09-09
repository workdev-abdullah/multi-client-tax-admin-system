import { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '₹0.00';
  return `₹${number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Stat({ label, value }) {
  return (
    <div className="card stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Action({ title, text, onClick }) {
  return (
    <button className="card action" type="button" onClick={onClick}>
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
  );
}

export default function DashboardPage({ navigate, clientId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      if (!clientId) return;
      const data = await apiFetch(`/dashboard?clientId=${encodeURIComponent(clientId)}`);
      setStats(data?.stats || {});
    } catch (err) {
      setStats(null);
      setError(err.message || 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!clientId) {
      setStats(null);
      setLoading(false);
      setError('Please select a client.');
      return;
    }
    refresh();
  }, [clientId]);

  const values = stats || {};

  return (
    <section>
      {error && (
        <div className="error page-error dashboard-error" role="alert">
          <span>{error}</span>
          <button className="link-btn" type="button" onClick={refresh}>Retry</button>
        </div>
      )}

      <div className="stats-grid">
        <Stat label="Clients" value={loading ? '—' : values.clients ?? 0} />
        <Stat label="Products" value={loading ? '—' : values.products ?? 0} />
        <Stat label="Invoices" value={loading ? '—' : values.invoices ?? 0} />
        <Stat label="Low Stock" value={loading ? '—' : values.lowStock ?? 0} />
      </div>

      <div className="stats-grid" style={{ marginTop: 18 }}>
        <Stat label="Sales" value={loading ? '—' : money(values.sales)} />
        <Stat label="Taxable" value={loading ? '—' : money(values.taxable)} />
        <Stat label="CGST" value={loading ? '—' : money(values.cgst)} />
        <Stat label="SGST" value={loading ? '—' : money(values.sgst)} />
      </div>

      <div className="quick-grid">
        <Action title="Add Client" text="Create a new client profile" onClick={() => navigate('Clients')} />
        <Action title="Add Product" text="Add product, HSN and tax rate" onClick={() => navigate('Products')} />
        <Action title="Stock In" text="Add incoming stock" onClick={() => navigate('Inventory')} />
        <Action title="Create Invoice" text="Make a new tax invoice" onClick={() => navigate('Invoices')} />
      </div>

      <div className="card note">
        <strong>Admin workspace ready.</strong>
        <p className="muted">Clients → Products → Inventory → Invoice → Summary → PDF/Excel.</p>
      </div>
    </section>
  );
}
