export default function TaxRateForm({ form, setForm, onSubmit, onCancel, saving }) {
  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="modal card product-modal" role="dialog" aria-modal="true" aria-labelledby="tax-rate-modal-title">
      <div className="modal-head">
        <div>
          <h3 id="tax-rate-modal-title">Add Tax Rate</h3>
          <p className="muted">Keep tax rates configurable so the invoice engine can use the selected master rate.</p>
        </div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close">×</button>
      </div>

      <form onSubmit={onSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="tax-name">Name <span className="required-mark">*</span></label>
            <input id="tax-name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. 18%" required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="tax-total">Total GST % <span className="required-mark">*</span></label>
            <input id="tax-total" value={form.totalRate} onChange={(e) => setField('totalRate', e.target.value)} type="number" min="0" step="0.01" required />
          </div>
          <div className="field">
            <label htmlFor="tax-cgst">CGST % <span className="required-mark">*</span></label>
            <input id="tax-cgst" value={form.cgstRate} onChange={(e) => setField('cgstRate', e.target.value)} type="number" min="0" step="0.01" required />
          </div>
          <div className="field">
            <label htmlFor="tax-sgst">SGST % <span className="required-mark">*</span></label>
            <input id="tax-sgst" value={form.sgstRate} onChange={(e) => setField('sgstRate', e.target.value)} type="number" min="0" step="0.01" required />
          </div>
          <div className="field">
            <label htmlFor="tax-igst">IGST % <span className="required-mark">*</span></label>
            <input id="tax-igst" value={form.igstRate} onChange={(e) => setField('igstRate', e.target.value)} type="number" min="0" step="0.01" required />
          </div>
          <div className="field">
            <label htmlFor="tax-notes">Notes</label>
            <input id="tax-notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="notice">These values are configuration data. Confirm the applicable rate before using it on an invoice.</div>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : 'Save Tax Rate'}</button>
        </div>
      </form>
    </div>
  );
}
