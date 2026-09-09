import { useEffect, useState } from 'react';
import { apiFetch, apiDownload } from '../../services/api';

const UNITS = ['Pcs', 'Kg', 'Gram', 'Litre', 'Meter', 'Box', 'Set', 'Service'];


const EMPTY_PRODUCT = { description: '', hsnSac: '', rate: '', unit: 'Pcs', taxRateId: '' };

function numeric(value) {
  const raw = value?.$numberDecimal ?? value?.value ?? value ?? 0;
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric(value));
}

export default function ProductsPage({ clientId }) {
  const [tab, setTab] = useState('PRODUCTS');
  const [products, setProducts] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [taxRatesLoading, setTaxRatesLoading] = useState(true);
  const [taxRatesError, setTaxRatesError] = useState('');

  useEffect(() => {
    if (clientId) { loadTaxRates(); loadProducts(); }
  }, [clientId]);

  useEffect(() => {
    if (!showForm) loadProducts();
  }, [status]);

  async function loadTaxRates() {
    setTaxRatesLoading(true);
    setTaxRatesError('');
    try {
      const data = await apiFetch('/tax-rates');
      const serverRates = Array.isArray(data?.rates) ? data.rates.filter((r) => r?.isActive) : [];
      if (!serverRates.length) throw new Error('No active tax rates are configured.');
      setTaxRates(serverRates);
    } catch (err) {
      const message = err.message || 'Could not load tax rates.';
      setTaxRatesError(message);
      setError(message);
      setTaxRates([]);
    } finally {
      setTaxRatesLoading(false);
    }
  }

  async function loadProducts() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, search, clientId: clientId || '' });
      const data = await apiFetch(`/products?${params.toString()}`);
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (err) {
      setError(err.message || 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setError('');
    const firstRate = taxRates.find((r) => r.isActive);
    setEditing(null);
    setForm({ ...EMPTY_PRODUCT, taxRateId: firstRate?._id || '' });
    setShowForm(true);
  }

  function openEdit(product) {
    setError('');
    setEditing(product);
    setForm({
      description: product.description || '',
      hsnSac: product.hsnSac || '',
      rate: product.rate ?? '',
      unit: product.unit || 'Pcs',
      taxRateId: product.taxRateId?._id || product.taxRateId || ''
    });
    setShowForm(true);
  }

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const rate = numeric(form.rate);
      if (!form.description.trim()) throw new Error('Description is required.');
      if (!form.hsnSac.trim()) throw new Error('HSN / SAC is required.');
      if (!Number.isFinite(rate) || rate < 0) throw new Error('Enter a valid product rate.');
      if (taxRatesLoading || !taxRates.length) throw new Error('Tax rates are still loading or unavailable. Refresh the page and try again.');
      const payload = { ...form, clientId, description: form.description.trim(), hsnSac: form.hsnSac.trim(), rate };
      if (!taxRates.some((taxRate) => String(taxRate._id) === String(payload.taxRateId))) {
        throw new Error('Select an active tax rate before saving.');
      }
      await apiFetch(editing ? `/products/${editing._id}` : '/products', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_PRODUCT);
      await loadProducts();
    } catch (err) {
      setError(err.message || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_PRODUCT);
  }

  async function toggleProduct(product) {
    try {
      await apiFetch(`/products/${product._id}/status?clientId=${clientId || ''}`, { method: 'PATCH', body: JSON.stringify({ clientId }) });
      await loadProducts();
    } catch (err) {
      setError(err.message || 'Could not update product.');
    }
  }

  const selectedTax = taxRates.find((r) => String(r._id) === String(form.taxRateId));

  return (
    <section>
      <div className="page-head">
        <div>
          <h3>Products</h3>
          <p className="muted">Product master for invoice and inventory.</p>
        </div>
        <div style={{display:'flex',gap:8}}><button className="secondary small" type="button" onClick={()=>apiDownload(`/reports/products.xlsx?clientId=${clientId || ''}`,'products.xlsx')}>Excel</button><button className="primary small" type="button" onClick={openCreate}>+ Add Product</button></div>
      </div>

      {error && <div className="error page-error">{error}</div>}

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 20, border: '2px solid #d5dcf7', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.12em', color: '#5364d8', marginBottom: 5 }}>PRODUCT MASTER</div>
              <h3 style={{ marginBottom: 6 }}>{editing ? 'Edit Product' : 'Add Product'}</h3>
              <p className="muted" style={{ margin: 0 }}>Enter the product details. GST rate comes from the Tax Rate Master.</p>
            </div>
            <button type="button" className="icon-btn" onClick={closeForm} aria-label="Close product form">×</button>
          </div>

          <form onSubmit={saveProduct}>
            <div className="form-grid">
              <label>
                Description *
                <input autoFocus value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="e.g. PVC Pipe" required />
              </label>
              <label>
                HSN / SAC *
                <input value={form.hsnSac} onChange={(e) => setField('hsnSac', e.target.value)} placeholder="e.g. 39172390" required />
              </label>
              <label>
                Rate *
                <input type="number" min="0" step="0.01" value={form.rate} onChange={(e) => setField('rate', e.target.value)} placeholder="0.00" required />
              </label>
              <label>
                Unit *
                <select value={form.unit} onChange={(e) => setField('unit', e.target.value)} required>
                  {UNITS.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                </select>
              </label>
              <label className="full">
                GST / Tax Rate *
                <select value={form.taxRateId} onChange={(e) => setField('taxRateId', e.target.value)} required>
                  {taxRates.map((rate) => <option value={rate._id} key={rate._id}>{rate.name} — CGST {rate.cgstRate}% + SGST {rate.sgstRate}%</option>)}
                </select>
              </label>
            </div>

            {selectedTax && (
              <div className="tax-preview" style={{ marginTop: 14 }}>
                <span>GST {selectedTax.totalRate}%</span>
                <span>CGST {selectedTax.cgstRate}%</span>
                <span>SGST {selectedTax.sgstRate}%</span>
                <span>IGST {selectedTax.igstRate}%</span>
              </div>
            )}

            {!taxRatesLoading && !taxRates.length && (
            <div className="error page-error" style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>{taxRatesError || 'No active tax rates are available. A valid Tax Rate Master entry is required to save a product.'}</span>
              <button type="button" className="secondary small" onClick={loadTaxRates}>Retry Tax Rates</button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, paddingTop: 18, borderTop: '1px solid #e8ecf2' }}>
              <button type="button" className="secondary" onClick={closeForm}>Cancel</button>
              <button type="submit" className="primary" disabled={saving || taxRatesLoading || !taxRates.length}>{saving ? 'Saving...' : taxRatesLoading ? 'Loading tax rates...' : editing ? 'Update Product' : 'Save Product'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="tabs">
        <button type="button" className={tab === 'PRODUCTS' ? 'tab active' : 'tab'} onClick={() => setTab('PRODUCTS')}>Products</button>
        <button type="button" className={tab === 'TAX_RATES' ? 'tab active' : 'tab'} onClick={() => setTab('TAX_RATES')}>Tax Rates</button>
      </div>

      {tab === 'PRODUCTS' && (
        <>
          <div className="card toolbar">
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadProducts()} placeholder="Search product or HSN/SAC..." />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ALL">All</option>
            </select>
            <button type="button" className="secondary" onClick={() => loadProducts()}>Search</button>
          </div>
          <div className="card table-card">
            {loading ? <div className="empty">Loading products...</div> : products.length === 0 ? <div className="empty">No products found. Click <strong>+ Add Product</strong> to create one.</div> : (
              <div className="table-wrap"><table><thead><tr><th>Description</th><th>HSN / SAC</th><th>Rate</th><th>GST</th><th>Unit</th><th>Status</th><th>Action</th></tr></thead><tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td><strong>{product.description}</strong></td><td>{product.hsnSac}</td><td>₹{money(product.rate)}</td><td>{product.taxRateId?.name || '—'}</td><td>{product.unit}</td>
                    <td><span className={product.isActive ? 'status-pill active' : 'status-pill inactive'}>{product.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td><div className="actions"><button type="button" className="link-btn" onClick={() => openEdit(product)}>Edit</button><button type="button" className={product.isActive ? 'danger-btn' : 'secondary'} onClick={() => toggleProduct(product)}>{product.isActive ? 'Deactivate' : 'Activate'}</button></div></td>
                  </tr>
                ))}
              </tbody></table></div>
            )}
          </div>
        </>
      )}

      {tab === 'TAX_RATES' && (
        <div className="card table-card">
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Total GST</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Status</th></tr></thead><tbody>
            {taxRates.map((rate) => <tr key={rate._id}><td><strong>{rate.name}</strong></td><td>{rate.totalRate}%</td><td>{rate.cgstRate}%</td><td>{rate.sgstRate}%</td><td>{rate.igstRate}%</td><td><span className="status-pill active">Active</span></td></tr>)}
          </tbody></table></div>
        </div>
      )}
    </section>
  );
}
