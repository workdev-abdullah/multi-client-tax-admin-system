import { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiDownload, apiOpenPdf } from '../../services/api';

const emptyItem = {
  productId: '',
  description: '',
  hsnSac: '',
  quantity: 1
};

const initialForm = {
  clientId: '',
  buyerSnapshot: { name:'', businessName:'', address:'', city:'', district:'', state:'', stateCode:'', pincode:'', gstin:'', phone:'', panNumber:'', shippingAddress:'' },
  placeOfSupply: '',
  reverseCharge: false,
  notes: '',
  items: [{ ...emptyItem }]
};

const n = (value) => {
  const raw = value?.$numberDecimal ?? value ?? 0;
  const result = Number(raw);
  return Number.isFinite(result) ? result : 0;
};

const normalizeText = (value = '') => String(value).trim().replace(/\s+/g, ' ').toLowerCase();
const normalizeHsn = (value = '') => String(value).replace(/[^a-z0-9]/gi, '').toLowerCase();

function findProductByDescription(products, value) {
  const needle = normalizeText(value);
  if (!needle) return null;
  return products.find((product) => normalizeText(product.description) === needle) || null;
}

function findProductByHsn(products, value) {
  const needle = normalizeHsn(value);
  if (!needle) return null;
  return products.find((product) => normalizeHsn(product.hsnSac) === needle) || null;
}

function formatAddress(client) {
  if (!client) return '—';
  return [
    client.address,
    client.city,
    client.district,
    client.state,
    client.pincode
  ].filter(Boolean).join(', ') || '—';
}

function ProductAutocomplete({ products, description, hsnSac, onDescriptionChange, onHsnChange, index }) {
  return (
    <div className="product-entry-grid">
      <div className="invoice-entry-field">
        <label>Product / Description *</label>
        <input
          list={`invoice-product-options-${index}`}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Type product name"
          required
        />
      </div>
      <div className="invoice-entry-field">
        <label>HSN / SAC *</label>
        <input
          list={`invoice-hsn-options-${index}`}
          value={hsnSac}
          onChange={(event) => onHsnChange(event.target.value)}
          placeholder="Type HSN/SAC"
          required
        />
      </div>
      <datalist id={`invoice-product-options-${index}`}>
        {products.map((product) => (
          <option key={`product-${product._id}`} value={product.description}>
            HSN {product.hsnSac}
          </option>
        ))}
      </datalist>
      <datalist id={`invoice-hsn-options-${index}`}>
        {products.map((product) => (
          <option key={`hsn-${product._id}`} value={product.hsnSac}>
            {product.description}
          </option>
        ))}
      </datalist>
    </div>
  );
}

export default function InvoicesPage({ clientId }) {
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [settings, setSettings] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [exporting, setExporting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const [clientResponse, productResponse, invoiceResponse, settingsResponse, inventoryResponse] = await Promise.all([
        apiFetch(`/clients/${clientId}`),
        apiFetch(`/products?status=ACTIVE&clientId=${clientId || ''}`),
        apiFetch(`/invoices?clientId=${clientId || ''}`),
        apiFetch(`/settings?clientId=${clientId || ''}`),
        apiFetch(`/inventory?clientId=${clientId || ''}`)
      ]);

      setClients(clientResponse.client ? [clientResponse.client] : []);
      setProducts(productResponse.products || []);
      setInvoices(invoiceResponse.invoices || []);
      setSettings(settingsResponse.settings || null);
      setInventory(inventoryResponse.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (clientId) { setForm((current) => ({ ...current, clientId })); load(); }
  }, [clientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client._id === form.clientId) || null,
    [clients, form.clientId]
  );

  useEffect(() => {
    const buyer = form.buyerSnapshot || {};
    const inferred = buyer.stateCode || (buyer.gstin || '').slice(0, 2);
    if (inferred && String(form.placeOfSupply || '') !== String(inferred)) {
      setForm((current) => ({ ...current, placeOfSupply: String(inferred) }));
    }
  }, [form.buyerSnapshot?.stateCode, form.buyerSnapshot?.gstin]);

  const previewState = useMemo(() => {
    const buyerCode = String(
      form.placeOfSupply ||
      form.buyerSnapshot?.stateCode ||
      (form.buyerSnapshot?.gstin || '').slice(0, 2)
    ).trim();

    const sellerCode = String(
      settings?.stateCode ||
      (settings?.gstin || '').slice(0, 2)
    ).trim();

    return {
      buyerCode,
      sellerCode,
      interstate: Boolean(
        buyerCode &&
        sellerCode &&
        buyerCode !== sellerCode
      )
    };
  }, [form.placeOfSupply, form.buyerSnapshot?.stateCode, form.buyerSnapshot?.gstin, settings]);

  const rows = useMemo(
    () =>
      form.items.map((item) => {
        const product = products.find((candidate) => candidate._id === item.productId) || null;
        const qty = Number(item.quantity) || 0;
        const inventoryRow = inventory.find((entry) => entry.productId?._id === item.productId);
        const availableStock = Number(inventoryRow?.quantity || 0);
        const rate = n(product?.rate);
        const tax = n(product?.taxRateId?.totalRate ?? product?.taxRate ?? 0);
        const cgstRate = n(product?.taxRateId?.cgstRate ?? 0);
        const sgstRate = n(product?.taxRateId?.sgstRate ?? 0);
        const igstRate = n(product?.taxRateId?.igstRate ?? tax);
        const taxable = qty * rate;
        const cgst = taxable * cgstRate / 100;
        const sgst = taxable * sgstRate / 100;
        const igst = taxable * igstRate / 100;
        const applicableTax = previewState.interstate ? igst : cgst + sgst;

        return {
          ...item,
          product,
          qty,
          rate,
          tax,
          taxable,
          cgst,
          sgst,
          igst,
          total: taxable + applicableTax,
          availableStock
        };
      }),
    [form.items, products, inventory, previewState.interstate]
  );

  const totals = useMemo(() => {
    const taxable = rows.reduce((sum, row) => sum + row.taxable, 0);
    const cgst = previewState.interstate ? 0 : rows.reduce((sum, row) => sum + row.cgst, 0);
    const sgst = previewState.interstate ? 0 : rows.reduce((sum, row) => sum + row.sgst, 0);
    const igst = previewState.interstate ? rows.reduce((sum, row) => sum + row.igst, 0) : 0;

    const beforeRoundOff = taxable + cgst + sgst + igst;
    const grand = settings?.roundOff ? Math.round(beforeRoundOff) : beforeRoundOff;
    return {
      taxable,
      cgst,
      sgst,
      igst,
      roundOff: grand - beforeRoundOff,
      grand,
      interstate: previewState.interstate
    };
  }, [rows, previewState.interstate, settings]);

  function updateFormField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateItem(index, patch) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    }));
  }

  function handleDescriptionChange(index, value) {
    const matched = findProductByDescription(products, value);
    if (matched) {
      updateItem(index, {
        productId: matched._id,
        description: matched.description,
        hsnSac: matched.hsnSac
      });
      return;
    }

    updateItem(index, {
      productId: '',
      description: value
    });
  }

  function handleHsnChange(index, value) {
    const matched = findProductByHsn(products, value);
    if (matched) {
      updateItem(index, {
        productId: matched._id,
        description: matched.description,
        hsnSac: matched.hsnSac
      });
      return;
    }

    updateItem(index, {
      productId: '',
      hsnSac: value
    });
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, { ...emptyItem }]
    }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_item, itemIndex) => itemIndex !== index)
    }));
  }

  function selectClient(clientId) {
    const client = clients.find((candidate) => candidate._id === clientId);
    setForm((current) => ({
      ...current,
      clientId,
      placeOfSupply: current.placeOfSupply
    }));
  }

  function resetForm() {
    setForm({ ...initialForm, clientId, items: [{ ...emptyItem }] });
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const invalidQuantity = form.items.find((item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0);
    if (invalidQuantity) {
      setError('Each invoice item must have a quantity greater than 0.');
      return;
    }

    const unresolved = form.items.find(
      (item) => !item.productId || !findProductByDescription(products, item.description)
    );

    if (unresolved) {
      setError('Please select a valid product from the product suggestions, or enter its exact HSN/SAC.');
      return;
    }

    try {
      setSaving(true);
      await apiFetch('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          status: 'DRAFT',
          items: form.items.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity)
          }))
        })
      });
      resetForm();
      setSuccess('Invoice draft created successfully.');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function issue(id) {
    if (busyAction) return;
    setBusyAction(`issue:${id}`);
    try {
      setError('');
      setSuccess('');
      await apiFetch(`/invoices/${id}/issue`, { method: 'PATCH' });
      setSuccess('Invoice issued and inventory updated successfully.');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyAction('');
    }
  }

  async function cancel(id) {
    if (!window.confirm('Cancel this invoice?')) return;
    if (busyAction) return;
    setBusyAction(`cancel:${id}`);
    try {
      setError('');
      setSuccess('');
      await apiFetch(`/invoices/${id}/cancel`, { method: 'PATCH' });
      setSuccess('Invoice cancelled successfully.');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyAction('');
    }
  }

  async function pdf(id) {
    try {
      setError('');
      await apiOpenPdf(`/reports/invoice/${id}/pdf?clientId=${clientId || ''}`);
    } catch (e) {
      setError(e.message);
    }
  }

  async function exportExcel() {
    setExporting(true);
    setError('');
    try { await apiDownload(`/reports/invoices.xlsx?clientId=${clientId || ''}`, 'invoices.xlsx'); }
    catch (e) { setError(e.message || 'Could not export invoices.'); }
    finally { setExporting(false); }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h3>Invoices</h3>
          <p className="muted">Create GST invoices, issue them and keep inventory synchronized.</p>
        </div>
        <button className="secondary" type="button" disabled={exporting} onClick={exportExcel}>{exporting ? 'Exporting…' : 'Export Excel'}</button>
      </div>

      {error && <div className="error page-error">{error}</div>}
      {success && <div className="success page-error">{success}</div>}

      <div className="card invoice-builder" style={{ padding: 20, marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>Create Invoice</h3>
            <p className="muted">Select a client and enter either the product name or HSN/SAC. The matching details will fill automatically.</p>
          </div>
        </div>

        <form onSubmit={save}>
          <div className="invoice-parties-grid">
            <div className="invoice-party-card">
              <div className="invoice-party-title">Bill To / Buyer</div>
              <label>
                Client *
                <select value={form.clientId} onChange={(event) => selectClient(event.target.value)} required>
                  <option value="">Select client</option>
                  {clients.filter((client) => String(client._id) === String(clientId)).map((client) => (
                    <option key={client._id} value={client._id}>
                      {client.name}{client.businessName ? ` — ${client.businessName}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {selectedClient ? (
                <div className="party-details">
                  <strong>{selectedClient.name}</strong>
                  {selectedClient.businessName && <span>{selectedClient.businessName}</span>}
                  <span>{formatAddress(selectedClient)}</span>
                  <span>Business workspace · {selectedClient.clientCode || selectedClient._id}</span>
                </div>
              ) : <div className="empty party-empty">Choose an active client workspace above.</div>}

              <div className="buyer-fields" style={{marginTop:12}}>
                <div className="invoice-party-title">Customer / Buyer</div>
                <div className="form-grid">
                  {['name','businessName','phone','gstin','panNumber','address','city','district','state','stateCode','pincode','shippingAddress'].map((key)=>(
                    <label key={key}>{key === 'name' ? 'Customer Name *' : key.replace(/([A-Z])/g,' $1').replace(/^./,m=>m.toUpperCase())}
                      <input required={key==='name'} value={form.buyerSnapshot?.[key] || ''} onChange={(e)=>setForm((current)=>({...current,buyerSnapshot:{...current.buyerSnapshot,[key]:e.target.value}}))} />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="invoice-party-card">
              <div className="invoice-party-title">Place of Supply / Seller</div>
              <label>
                Place of Supply State Code
                <input
                  value={form.placeOfSupply}
                  onChange={(event) => updateFormField('placeOfSupply', event.target.value)}
                  placeholder={settings?.stateCode || 'e.g. 19'}
                />
              </label>
              {settings ? (
                <div className="party-details">
                  <strong>{settings.businessName || 'Business Name not configured'}</strong>
                  <span>{[settings.address, settings.city, settings.district, settings.state, settings.pincode].filter(Boolean).join(', ') || '—'}</span>
                  <span>Phone: {settings.phone || '—'}</span>
                  <span>GSTIN: {settings.gstin || '—'}</span>
                </div>
              ) : (
                <div className="empty party-empty">Configure your business details in Settings.</div>
              )}
            </div>
          </div>

          <div className="table-card invoice-items-card" style={{ marginTop: 16 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product / Description</th>
                    <th>HSN/SAC</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>GST</th>
                    <th>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`invoice-item-${index}`}>
                      <td>{index + 1}</td>
                      <td style={{ minWidth: 260 }}>
                        <ProductAutocomplete
                          products={products}
                          index={index}
                          description={row.description}
                          hsnSac={row.hsnSac}
                          onDescriptionChange={(value) => handleDescriptionChange(index, value)}
                          onHsnChange={(value) => handleHsnChange(index, value)}
                        />
                        {row.product && (
                          <div className="muted tiny invoice-auto-info">
                            Auto matched · HSN {row.product.hsnSac} · ₹{row.rate.toFixed(2)} · GST {row.tax.toFixed(0)}% · Stock {row.availableStock}
                          </div>
                        )}
                      </td>
                      <td>{row.hsnSac || '—'}</td>
                      <td>
                        <input
                          className="invoice-qty"
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={row.quantity}
                          onChange={(event) => updateItem(index, { quantity: event.target.value })}
                          required
                        />
                      </td>
                      <td>
                        <div>₹{row.rate.toFixed(2)}</div>
                        {row.product && <div className="muted tiny">Stock: {row.availableStock}</div>}
                      </td>
                      <td>{row.tax.toFixed(0)}%</td>
                      <td>₹{row.total.toFixed(2)}</td>
                      <td>
                        {form.items.length > 1 && (
                          <button type="button" className="secondary small" onClick={() => removeItem(index)}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="invoice-builder-footer">
            <button type="button" className="secondary" onClick={addItem}>
              + Add Item
            </button>

            <div className="invoice-total-box">
              <div>Taxable: <b>₹{totals.taxable.toFixed(2)}</b></div>
              <div>
                CGST: ₹{totals.cgst.toFixed(2)} · SGST: ₹{totals.sgst.toFixed(2)} · IGST: ₹{totals.igst.toFixed(2)}
              </div>
              <div style={{ fontSize: 18, marginTop: 4 }}>
                Grand Total: <b>₹{totals.grand.toFixed(2)}</b>
              </div>
            </div>
          </div>

          <div className="invoice-stock-note">
            <strong>Inventory:</strong> Issuing this invoice will automatically deduct the sold quantity from current stock. Draft creation does not change stock.
            {rows.some((row) => row.product && row.qty > row.availableStock) && (
              <div className="invoice-stock-warning">
                ⚠ One or more quantities are higher than current stock. The invoice cannot be issued until sufficient stock is available.
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <label>
              Notes / Declaration
              <input
                value={form.notes}
                onChange={(event) => updateFormField('notes', event.target.value)}
                placeholder="Optional invoice note"
              />
            </label>
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan="6">No invoices yet.</td></tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.clientId?.name || '—'}</td>
                    <td>{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</td>
                    <td>₹{n(invoice.grandTotal).toFixed(2)}</td>
                    <td>{invoice.status}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {invoice.status === 'DRAFT' && (
                          <button className="primary small" type="button" disabled={Boolean(busyAction)} onClick={() => issue(invoice._id)}>
                            Issue
                          </button>
                        )}
                        <button className="secondary small" type="button" disabled={Boolean(busyAction)} onClick={() => pdf(invoice._id)}>
                          PDF
                        </button>
                        {invoice.status === 'ISSUED' && (
                          <button className="secondary small" type="button" disabled={Boolean(busyAction)} onClick={() => cancel(invoice._id)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
