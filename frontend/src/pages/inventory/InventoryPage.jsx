import { useEffect, useMemo, useState } from 'react';
import { apiDownload, apiFetch, apiOpenPdf } from '../../services/api';

const EMPTY_STOCK_IN = { productId: '', quantity: '', reference: '', notes: '' };
const EMPTY_OPENING = { productId: '', quantity: '', lowStockThreshold: '', notes: '' };

const toNumber = (value) => {
  const raw = value?.$numberDecimal ?? value?.value ?? value ?? 0;
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
};

const fmtQty = (value) => {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
};

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2
}).format(toNumber(value));

export default function InventoryPage({ clientId }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [stockIn, setStockIn] = useState(EMPTY_STOCK_IN);
  const [opening, setOpening] = useState(EMPTY_OPENING);
  const [showStockIn, setShowStockIn] = useState(false);
  const [showOpening, setShowOpening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadInventory() {
    setLoading(true);
    setError('');
    try {
      const [inventoryData, productData] = await Promise.all([
        apiFetch(`/inventory?clientId=${clientId || ''}`),
        apiFetch(`/products?status=ACTIVE&clientId=${clientId || ''}`)
      ]);
      setItems(Array.isArray(inventoryData?.items) ? inventoryData.items : []);
      setProducts(Array.isArray(productData?.products) ? productData.products : []);
    } catch (err) {
      setError(err.message || 'Could not load inventory.');
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await apiFetch(`/inventory/history?clientId=${clientId || ''}`);
      setHistory(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err.message || 'Could not load stock history.');
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => { if (clientId) loadInventory(); }, [clientId]);

  async function submitStockIn(event) {
    event.preventDefault();
    const quantity = toNumber(stockIn.quantity);
    if (!stockIn.productId || quantity <= 0) {
      setError('Select a product and enter a quantity greater than 0.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiFetch('/inventory/stock-in', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          ...stockIn,
          quantity
        })
      });
      setStockIn(EMPTY_STOCK_IN);
      setShowStockIn(false);
      await loadInventory();
      if (showHistory) await loadHistory();
    } catch (err) {
      setError(err.message || 'Could not add stock.');
    } finally {
      setSaving(false);
    }
  }

  async function submitOpening(event) {
    event.preventDefault();
    const quantity = toNumber(opening.quantity);
    const lowStockThreshold = toNumber(opening.lowStockThreshold);
    if (!opening.productId || quantity < 0 || lowStockThreshold < 0) {
      setError('Select a product and enter valid stock values.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiFetch('/inventory/opening', {
        method: 'POST',
        body: JSON.stringify({
          productId: opening.productId,
          quantity,
          lowStockThreshold,
          notes: opening.notes || ''
        })
      });
      setOpening(EMPTY_OPENING);
      setShowOpening(false);
      await loadInventory();
      if (showHistory) await loadHistory();
    } catch (err) {
      setError(err.message || 'Could not set opening stock.');
    } finally {
      setSaving(false);
    }
  }

  function openHistory() {
    setShowHistory(true);
    loadHistory();
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const product = item.productId || {};
      const isLow = toNumber(item.quantity) <= toNumber(item.lowStockThreshold);
      const matchesStatus = status === 'ALL' || (status === 'LOW' ? isLow : status === 'OK' ? !isLow : true);
      const matchesSearch = !q || [product.description, product.hsnSac].some((v) => String(v || '').toLowerCase().includes(q));
      return matchesSearch && matchesStatus;
    });
  }, [items, search, status]);

  const totals = useMemo(() => {
    const currentStock = items.reduce((sum, item) => sum + toNumber(item.quantity), 0);
    const stockValue = items.reduce((sum, item) => sum + toNumber(item.stockValue ?? (toNumber(item.quantity) * toNumber(item.productId?.rate))), 0);
    const lowStock = items.filter((item) => toNumber(item.quantity) <= toNumber(item.lowStockThreshold)).length;
    return { currentStock, stockValue, lowStock };
  }, [items]);

  return (
    <section>
      <div className="page-head">
        <div>
          <h3>Inventory</h3>
          <p className="muted">Track current stock, add incoming stock and review every stock movement.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="secondary small" type="button" onClick={openHistory}>Stock History</button>
          <button className="secondary small" type="button" onClick={() => apiOpenPdf('/reports/stock-history.pdf').catch((e) => setError(e.message))}>History PDF</button>
          <button className="secondary small" type="button" onClick={() => apiDownload(`/reports/stock-history.xlsx?clientId=${clientId || ''}`, 'stock-history.xlsx').catch((e) => setError(e.message))}>History Excel</button>
          <button className="secondary small" type="button" onClick={() => apiDownload(`/reports/inventory.pdf?clientId=${clientId || ''}`, 'inventory.pdf').catch((e) => setError(e.message))}>PDF</button>
          <button className="secondary small" type="button" onClick={() => apiDownload(`/reports/inventory.xlsx?clientId=${clientId || ''}`, 'inventory.xlsx').catch((e) => setError(e.message))}>Excel</button>
          <button className="primary small" type="button" onClick={() => { setError(''); setShowStockIn(true); }}>+ Stock In</button>
        </div>
      </div>

      {error && <div className="error page-error">{error}</div>}

      <div className="stats-grid" style={{ marginBottom: 18 }}>
        <div className="card stat"><span>Products Tracked</span><strong>{items.length}</strong></div>
        <div className="card stat"><span>Total Units</span><strong>{fmtQty(totals.currentStock)}</strong></div>
        <div className="card stat"><span>Stock Value</span><strong>{money(totals.stockValue)}</strong></div>
        <div className="card stat"><span>Low Stock</span><strong>{totals.lowStock}</strong></div>
      </div>

      <div className="card toolbar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or HSN/SAC..." />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All Stock</option>
          <option value="LOW">Low Stock</option>
          <option value="OK">Healthy Stock</option>
        </select>
        <button type="button" className="secondary" onClick={() => { setSearch(''); setStatus('ALL'); }}>Clear</button>
      </div>

      {items.some((item) => Number(item.productId?.rate || 0) <= 0) && (
        <div className="card note" style={{ marginBottom: 18 }}>
          <strong>Some products have a ₹0.00 rate.</strong>
          <p className="muted">Stock Value is calculated as Current Stock × Product Rate. Edit those products and enter their correct Rate to show their real stock value.</p>
        </div>
      )}

      <div className="card table-card">
        {loading ? <div className="empty">Loading inventory...</div> : filteredItems.length === 0 ? (
          <div className="empty">No inventory records match your filters.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>HSN/SAC</th>
                  <th>Current Stock</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Stock Value</th>
                  <th>Threshold</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const product = item.productId || {};
                  const qty = Number(item.quantity || 0);
                  const threshold = Number(item.lowStockThreshold || 0);
                  const low = qty <= threshold;
                  return (
                    <tr key={item._id}>
                      <td><strong>{product.description || 'Unknown product'}</strong></td>
                      <td>{product.hsnSac || '—'}</td>
                      <td><strong>{fmtQty(qty)}</strong></td>
                      <td>{product.unit || '—'}</td>
                      <td>{money(Number(product.rate || 0))}</td>
                      <td>{money(Number(item.stockValue ?? (qty * Number(product.rate || 0))))}</td>
                      <td>{fmtQty(threshold)}</td>
                      <td><span className={low ? 'status-pill inactive' : 'status-pill active'}>{low ? 'Low Stock' : 'Healthy'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 18, marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <strong>Opening stock</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>Set the initial stock and low-stock threshold for a product.</p>
          </div>
          <button type="button" className="secondary" onClick={() => { setError(''); setShowOpening(true); }}>Set Opening Stock</button>
        </div>
      </div>

      {showStockIn && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && setShowStockIn(false)}>
          <form className="modal card" onSubmit={submitStockIn}>
            <div className="modal-head"><div><h3>Stock In</h3><p className="muted">Add newly received stock to the current balance.</p></div><button type="button" className="icon-btn" disabled={saving} onClick={() => setShowStockIn(false)}>×</button></div>
            <div className="form-grid">
              <label>Product *<select value={stockIn.productId} onChange={(e) => setStockIn({ ...stockIn, productId: e.target.value })} required><option value="">Select product</option>{products.map((p) => <option key={p._id} value={p._id}>{p.description} — {p.hsnSac}</option>)}</select></label>
              <label>Quantity *<input type="number" min="0.001" step="0.001" value={stockIn.quantity} onChange={(e) => setStockIn({ ...stockIn, quantity: e.target.value })} required /></label>
              <label>Reference<input value={stockIn.reference} onChange={(e) => setStockIn({ ...stockIn, reference: e.target.value })} placeholder="Purchase / supplier reference" /></label>
              <label>Notes<input value={stockIn.notes} onChange={(e) => setStockIn({ ...stockIn, notes: e.target.value })} /></label>
            </div>
            <div className="modal-actions"><button type="button" className="secondary" disabled={saving} onClick={() => setShowStockIn(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving...' : 'Add Stock'}</button></div>
          </form>
        </div>
      )}

      {showOpening && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && setShowOpening(false)}>
          <form className="modal card" onSubmit={submitOpening}>
            <div className="modal-head"><div><h3>Opening Stock</h3><p className="muted">Set the starting balance for a product. Changes are recorded in stock history.</p></div><button type="button" className="icon-btn" disabled={saving} onClick={() => setShowOpening(false)}>×</button></div>
            <div className="form-grid">
              <label>Product *<select value={opening.productId} onChange={(e) => setOpening({ ...opening, productId: e.target.value })} required><option value="">Select product</option>{products.map((p) => <option key={p._id} value={p._id}>{p.description} — {p.hsnSac}</option>)}</select></label>
              <label>Opening Quantity *<input type="number" min="0" step="0.001" value={opening.quantity} onChange={(e) => setOpening({ ...opening, quantity: e.target.value })} required /></label>
              <label>Low Stock Threshold<input type="number" min="0" step="0.001" value={opening.lowStockThreshold} onChange={(e) => setOpening({ ...opening, lowStockThreshold: e.target.value })} placeholder="0" /></label>
              <label>Notes<input value={opening.notes} onChange={(e) => setOpening({ ...opening, notes: e.target.value })} /></label>
            </div>
            <div className="modal-actions"><button type="button" className="secondary" disabled={saving} onClick={() => setShowOpening(false)}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Opening Stock'}</button></div>
          </form>
        </div>
      )}

      {showHistory && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="modal card" style={{ width: 'min(1050px, 100%)' }}>
            <div className="modal-head"><div><h3>Stock History</h3><p className="muted">Latest stock movements across all products.</p></div><button type="button" className="icon-btn" onClick={() => setShowHistory(false)}>×</button></div>
            {historyLoading ? <div className="empty">Loading stock history...</div> : history.length === 0 ? <div className="empty">No stock movements yet.</div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Previous</th><th>New Balance</th><th>Reference</th></tr></thead>
                  <tbody>{history.map((row) => <tr key={row._id}><td>{row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : '—'}</td><td><strong>{row.productId?.description || '—'}</strong></td><td>{row.type}</td><td>{fmtQty(row.quantity)}</td><td>{fmtQty(row.previousBalance)}</td><td>{fmtQty(row.newBalance)}</td><td>{row.reference || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            <div className="modal-actions"><button type="button" className="secondary" onClick={() => apiDownload(`/reports/stock-history.xlsx?clientId=${clientId || ''}`, 'stock-history.xlsx').catch((e) => setError(e.message))}>Download Excel</button><button type="button" className="primary" onClick={() => setShowHistory(false)}>Close</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
