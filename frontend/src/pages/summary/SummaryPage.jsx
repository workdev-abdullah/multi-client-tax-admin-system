import { useEffect, useState } from 'react';
import { apiDownload, apiFetch } from '../../services/api';

const money = (value) => {
  const number = Number(value?.$numberDecimal ?? value ?? 0);
  return `₹${(Number.isFinite(number) ? number : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function SummaryPage({ clientId }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');

  async function load(nextFrom = from, nextTo = to) {
    if (nextFrom && nextTo && nextFrom > nextTo) {
      setError('The From date cannot be after the To date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (nextFrom) qs.set('from', nextFrom);
      if (nextTo) qs.set('to', nextTo);
      qs.set('clientId', clientId || '');
      const d = await apiFetch(`/summary${qs.toString() ? `?${qs.toString()}` : ''}`);
      setS(d.summary || {});
    } catch (e) {
      setError(e.message || 'Could not load summary.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!clientId) {
      setS(null);
      setError('Please select a client.');
      setLoading(false);
      return;
    }
    load();
  }, [clientId]);

  function reportQuery() {
    const q = new URLSearchParams();
    if (clientId) q.set('clientId', clientId);
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return q.toString() ? `?${q.toString()}` : '';
  }

  async function exportReport(type) {
    setExporting(type);
    setError('');
    try {
      await apiDownload(`/reports/summary.${type}${reportQuery()}`, `summary.${type}`);
    } catch (e) {
      setError(e.message || `Could not export ${type.toUpperCase()} report.`);
    } finally {
      setExporting('');
    }
  }

  return (
    <section>
      <div className="page-head">
        <div><h3>Summary</h3><p className="muted">Automatic overview from issued invoices, clients and inventory.</p></div>
        <div className="button-row">
          <button className="secondary" type="button" disabled={Boolean(exporting)} onClick={() => exportReport('xlsx')}>{exporting === 'xlsx' ? 'Exporting…' : 'Export Excel'}</button>
          <button className="secondary" type="button" disabled={Boolean(exporting)} onClick={() => exportReport('pdf')}>{exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}</button>
        </div>
      </div>
      <div className="card toolbar">
        <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="primary" type="button" onClick={() => load() } disabled={loading}>Apply</button>
        <button className="secondary" type="button" disabled={loading && !s} onClick={() => { setFrom(''); setTo(''); load('', ''); }}>Clear</button>
      </div>
      {error && <div className="error page-error" role="alert">{error}</div>}
      {loading && !s ? (
        <div className="card empty">Loading summary…</div>
      ) : (
        <div className="stats-grid">
          {[['Clients', s?.clients ?? 0], ['Products', s?.products ?? 0], ['Invoices', s?.invoices ?? 0], ['Sales', money(s?.sales)], ['Taxable', money(s?.taxable)], ['CGST', money(s?.cgst)], ['SGST', money(s?.sgst)], ['IGST', money(s?.igst)], ['Stock Value', money(s?.stockValue)], ['Low Stock', s?.lowStock ?? 0]].map(([key, value]) => (
            <div className="stat card" key={key}><div className="muted">{key}</div><strong>{value}</strong></div>
          ))}
        </div>
      )}
    </section>
  );
}
