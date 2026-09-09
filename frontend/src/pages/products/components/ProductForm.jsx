import { useEffect, useState } from 'react';

const UNITS = ['Pcs', 'Kg', 'Gram', 'Litre', 'Meter', 'Box', 'Set', 'Service'];

export default function ProductForm({ form, setForm, taxRates = [], onSubmit, onCancel, saving, editing }) {
  const [selectedTax, setSelectedTax] = useState(null);
  const activeRates = Array.isArray(taxRates) ? taxRates.filter((rate) => rate?.isActive) : [];

  useEffect(() => {
    const active = activeRates.find((rate) => String(rate?._id) === String(form?.taxRateId));
    setSelectedTax(active || null);
  }, [taxRates, form?.taxRateId]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  return (
    <div className="product-form-card card">
      <div className="product-form-header">
        <div>
          <div className="product-modal-eyebrow">PRODUCT MASTER</div>
          <h3>{editing ? 'Edit Product' : 'Add Product'}</h3>
          <p className="muted">Enter the product once. These details will be filled automatically when creating an invoice.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close">×</button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="product-form-grid">
          <div className="product-field">
            <label htmlFor="product-description">Description <span>*</span></label>
            <input id="product-description" value={form?.description || ''} onChange={(e) => setField('description', e.target.value)} placeholder="e.g. PVC Pipe" required autoFocus />
          </div>

          <div className="product-field">
            <label htmlFor="product-hsn">HSN / SAC <span>*</span></label>
            <input id="product-hsn" value={form?.hsnSac || ''} onChange={(e) => setField('hsnSac', e.target.value)} placeholder="e.g. 39172390" required />
          </div>

          <div className="product-field">
            <label htmlFor="product-rate">Rate <span>*</span></label>
            <input id="product-rate" value={form?.rate ?? ''} onChange={(e) => setField('rate', e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" required />
          </div>

          <div className="product-field">
            <label htmlFor="product-unit">Unit <span>*</span></label>
            <select id="product-unit" value={form?.unit || 'Pcs'} onChange={(e) => setField('unit', e.target.value)} required>
              {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </div>

          <div className="product-field product-field-full">
            <label htmlFor="product-tax-rate">GST / Tax Rate <span>*</span></label>
            <select id="product-tax-rate" value={form?.taxRateId || ''} onChange={(e) => setField('taxRateId', e.target.value)} required disabled={activeRates.length === 0}>
              <option value="">Select GST / Tax Rate</option>
              {activeRates.map((rate) => (
                <option key={rate._id} value={rate._id}>{rate.name} — CGST {rate.cgstRate}% + SGST {rate.sgstRate}%</option>
              ))}
            </select>
            {activeRates.length === 0 && (
              <div className="product-modal-warning">No active tax rate is available. Go to the <strong>Tax Rates</strong> tab and activate/add one first.</div>
            )}
            {selectedTax && (
              <div className="product-tax-preview">
                <div><span>GST</span><strong>{selectedTax.totalRate}%</strong></div>
                <div><span>CGST</span><strong>{selectedTax.cgstRate}%</strong></div>
                <div><span>SGST</span><strong>{selectedTax.sgstRate}%</strong></div>
                <div><span>IGST</span><strong>{selectedTax.igstRate}%</strong></div>
              </div>
            )}
          </div>
        </div>

        <div className="product-modal-footer">
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary" disabled={saving || activeRates.length === 0}>{saving ? 'Saving...' : editing ? 'Update Product' : 'Save Product'}</button>
        </div>
      </form>
    </div>
  );
}
