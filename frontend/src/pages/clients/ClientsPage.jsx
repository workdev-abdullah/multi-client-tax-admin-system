import { useEffect, useMemo, useState } from 'react';
import Field from '../../components/common/Field';
import FileUpload from '../../components/common/FileUpload';
import { ASSESSMENT_YEARS, DOCUMENT_REQUIREMENTS, SERVICES, SERVICE_LABELS } from '../../constants/services';
import { apiFetch, apiDownload, apiOpenFile } from '../../services/api';

const emptyClient = {
  name: '',
  businessName: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  district: '',
  state: '',
  stateCode: '',
  pincode: '',
  panNumber: '',
  gstin: '',
  services: []
};

function buildAttachmentInputs(services, assessmentYears) {
  const rows = [];

  if (services.includes('GST')) {
    DOCUMENT_REQUIREMENTS.GST.forEach((doc) => rows.push({ ...doc, serviceType: 'GST', financialYear: '' }));
  }

  if (services.includes('INCOME_TAX')) {
    assessmentYears.forEach((year) => {
      DOCUMENT_REQUIREMENTS.INCOME_TAX.forEach((doc) => {
        rows.push({ ...doc, serviceType: 'INCOME_TAX', financialYear: year });
      });
    });
  }

  if (services.includes('P_TAX')) {
    DOCUMENT_REQUIREMENTS.P_TAX.forEach((doc) => rows.push({ ...doc, serviceType: 'P_TAX', financialYear: '' }));
  }

  if (services.includes('OTHERS')) {
    DOCUMENT_REQUIREMENTS.OTHERS.forEach((doc) => rows.push({ ...doc, serviceType: 'OTHERS', financialYear: '' }));
  }

  return rows;
}

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [service, setService] = useState('ALL');
  const [status, setStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyClient);
  const [attachments, setAttachments] = useState({});
  const [assessmentYears, setAssessmentYears] = useState([]);
  const [clientDocuments, setClientDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [detailsClient, setDetailsClient] = useState(null);
  const [detailsDocuments, setDetailsDocuments] = useState([]);
  const [detailsInvoices, setDetailsInvoices] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function load(page = 1) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: 20, search, service, status });
      const data = await apiFetch(`/clients?${params.toString()}`);
      setClients(data.items || []);
      setMeta(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
  }, [service, status]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function openDetails(client) {
    setDetailsClient(client);
    setDetailsDocuments([]);
    setDetailsInvoices([]);
    setDetailsLoading(true);
    try {
      const [docsData, invoiceData] = await Promise.all([
        apiFetch(`/documents/client/${client._id}`),
        apiFetch(`/invoices?clientId=${client._id}`)
      ]);
      setDetailsDocuments(docsData.documents || []);
      setDetailsInvoices(invoiceData.invoices || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailsLoading(false);
    }
  }

  function openCreate() {
    setSelected(null);
    setForm({ ...emptyClient, services: [] });
    setAttachments({});
    setAssessmentYears([]);
    setClientDocuments([]);
    setError('');
    setShowForm(true);
  }

  async function openEdit(client) {
    setSelected(client);
    setForm({ ...emptyClient, ...client, services: client.services || [] });
    setAttachments({});
    setAssessmentYears([]);
    setError('');
    setShowForm(true);
    setDocsLoading(true);

    try {
      const documents = (await apiFetch(`/documents/client/${client._id}`)).documents || [];
      setClientDocuments(documents);
      setAssessmentYears([...new Set(documents.filter((doc) => doc.serviceType === 'INCOME_TAX' && doc.financialYear).map((doc) => doc.financialYear))]);
    } catch (err) {
      setClientDocuments([]);
      setError(err.message);
    } finally {
      setDocsLoading(false);
    }
  }

  function toggleService(key) {
    setForm((current) => {
      const services = current.services.includes(key)
        ? current.services.filter((serviceKey) => serviceKey !== key)
        : [...current.services, key];

      return { ...current, services };
    });

    if (key === 'INCOME_TAX' && form.services.includes(key)) {
      setAssessmentYears([]);
    }
  }

  function toggleAssessmentYear(year) {
    setAssessmentYears((current) => (
      current.includes(year)
        ? current.filter((item) => item !== year)
        : [...current, year]
    ));
  }

  function setAttachment(key, value) {
    setAttachments((current) => ({ ...current, [key]: value }));
  }

  async function uploadSelectedDocuments(clientId) {
    const uploads = Object.entries(attachments).filter(([, item]) => item?.file);
    let completed = 0;

    for (const [, item] of uploads) {
      const data = new FormData();
      data.append('file', item.file);
      data.append('serviceType', item.serviceType);
      data.append('documentType', item.documentType);
      if (item.financialYear) data.append('financialYear', item.financialYear);
      await apiFetch(`/documents/client/${clientId}`, { method: 'POST', body: data });
      completed += 1;
    }
    return completed;
  }

  function validateFiles() {
    const invalid = Object.values(attachments).find((item) => item?.error);
    if (invalid?.error) return invalid.error;

    const missing = attachmentInputs.find((item) => {
      if (!item.required) return false;
      const key = `${item.serviceType}-${item.key}-${item.financialYear || 'general'}`;
      const hasNewFile = Boolean(attachments[key]?.file);
      const hasExistingFile = clientDocuments.some((doc) => (
        doc.serviceType === item.serviceType &&
        doc.documentType === item.documentType &&
        String(doc.financialYear || '') === String(item.financialYear || '')
      ));
      return !hasNewFile && !hasExistingFile;
    });

    return missing ? `${missing.documentType}${missing.financialYear ? ` — AY ${missing.financialYear}` : ''} is required.` : '';
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    if (!form.services.length) {
      setError('Please select at least one service.');
      setSaving(false);
      return;
    }

    if (form.services.includes('INCOME_TAX') && assessmentYears.length === 0) {
      setError('Please select at least one Income Tax assessment year.');
      setSaving(false);
      return;
    }

    const fileError = validateFiles();
    if (fileError) {
      setError(fileError);
      setSaving(false);
      return;
    }

    try {
      const data = await apiFetch(selected ? `/clients/${selected._id}` : '/clients', {
        method: selected ? 'PUT' : 'POST',
        body: JSON.stringify(form)
      });

      try {
        await uploadSelectedDocuments(data.client._id);
      } catch (uploadError) {
        setError(`Client saved, but one or more documents could not be uploaded: ${uploadError.message}`);
        setSelected(data.client);
        setClientDocuments((await apiFetch(`/documents/client/${data.client._id}`)).documents || []);
        return;
      }

      setShowForm(false);
      window.dispatchEvent(new Event('admin:clients-changed'));
      await load(meta.page);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(client) {
    const action = client.status === 'INACTIVE' ? 'activate' : 'make inactive';
    if (!window.confirm(`Do you want to ${action} ${client.name}?`)) return;
    setError('');

    try {
      await apiFetch(`/clients/${client._id}/status`, { method: 'PATCH' });
      window.dispatchEvent(new Event('admin:clients-changed'));
      await load(meta.page);
    } catch (err) {
      setError(err.message);
    }
  }

  const attachmentInputs = useMemo(
    () => buildAttachmentInputs(form.services, assessmentYears),
    [form.services, assessmentYears]
  );

  return (
    <section>
      <div className="page-head">
        <div>
          <h3>Clients</h3>
          <p className="muted">Manage client information, services and documents from one place.</p>
        </div>
        <div className="button-row"><button className="secondary small" type="button" disabled={exporting} onClick={async()=>{setExporting(true);setError('');try{await apiDownload('/reports/clients.xlsx','clients.xlsx')}catch(e){setError(e.message)}finally{setExporting(false)}}}>{exporting?'Exporting…':'Excel'}</button><button className="primary small" type="button" onClick={openCreate}>+ Add Client</button></div>
      </div>

      <div className="card toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && load(1)}
          placeholder="Search name, business, phone, GSTIN, PAN..."
        />
        <select value={service} onChange={(event) => setService(event.target.value)}>
          <option value="ALL">All Services</option>
          {SERVICES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ALL">All</option>
        </select>
        <button className="secondary" type="button" onClick={() => load(1)}>Search</button>
      </div>

      {error && !showForm && <div className="error page-error">{error}</div>}

      <div className="card table-card">
        {loading ? (
          <div className="empty">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="empty">No clients found. Click <strong>+ Add Client</strong> to create one.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Client</th><th>Contact</th><th>GSTIN</th><th>Services</th><th>Code</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client._id}>
                      <td><strong>{client.name}</strong><div className="muted tiny">{client.businessName || '—'}</div></td>
                      <td>{client.phone || '—'}<div className="muted tiny">{client.email || ''}</div></td>
                      <td>{client.gstin || '—'}</td>
                      <td><div className="chips">{(client.services || []).map((s) => <span className="chip" key={s}>{SERVICE_LABELS[s]}</span>)}</div></td>
                      <td>{client.clientCode}</td>
                      <td><div className="actions"><button className="view-btn" type="button" onClick={() => openDetails(client)}>View</button><button className="link-btn" type="button" onClick={() => openEdit(client)}>Edit</button><button className={client.status === 'INACTIVE' ? 'secondary' : 'danger-btn'} type="button" onClick={() => toggleStatus(client)}>{client.status === 'INACTIVE' ? 'Activate' : 'Inactive'}</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span className="muted">{meta.total} {status === 'ALL' ? 'client' : status.toLowerCase() + ' client'}{meta.total === 1 ? '' : 's'}</span>
              <div>
                <button className="secondary" type="button" disabled={loading || meta.page <= 1} onClick={() => load(meta.page - 1)}>Previous</button>
                <span className="page-number">Page {meta.page} / {Math.max(meta.pages, 1)}</span>
                <button className="secondary" type="button" disabled={loading || meta.page >= meta.pages} onClick={() => load(meta.page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {detailsClient && (
        <div className="details-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setDetailsClient(null)}>
          <aside className="details-panel">
            <div className="details-header">
              <div>
                <div className="details-eyebrow">CLIENT PROFILE</div>
                <h3>{detailsClient.name}</h3>
                <p className="muted">{detailsClient.businessName || 'Individual Client'}</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setDetailsClient(null)} aria-label="Close client profile">×</button>
            </div>

            {detailsLoading ? (
              <div className="details-loading">Loading client profile...</div>
            ) : (
              <div className="details-content">
                <div className="details-stats">
                  <div><span>Invoices</span><strong>{detailsInvoices.length}</strong></div>
                  <div><span>Services</span><strong>{(detailsClient.services || []).length}</strong></div>
                  <div><span>Documents</span><strong>{detailsDocuments.length}</strong></div>
                </div>

                <section className="details-section">
                  <div className="section-heading"><h4>Contact & Business</h4></div>
                  <div className="profile-grid">
                    <div><span>Name</span><strong>{detailsClient.name}</strong></div>
                    <div><span>Business Name</span><strong>{detailsClient.businessName || '—'}</strong></div>
                    <div><span>Phone</span><strong>{detailsClient.phone || '—'}</strong></div>
                    <div><span>Email</span><strong>{detailsClient.email || '—'}</strong></div>
                    <div><span>PAN</span><strong>{detailsClient.panNumber || '—'}</strong></div>
                    <div><span>GSTIN</span><strong>{detailsClient.gstin || '—'}</strong></div>
                    <div className="profile-wide"><span>Address</span><strong>{detailsClient.address || '—'}{detailsClient.city ? `, ${detailsClient.city}` : ''}{detailsClient.district ? `, ${detailsClient.district}` : ''}{detailsClient.state ? `, ${detailsClient.state}` : ''}{detailsClient.pincode ? ` - ${detailsClient.pincode}` : ''}</strong></div>
                  </div>
                </section>

                <section className="details-section">
                  <div className="section-heading"><h4>Services</h4></div>
                  <div className="chips detail-chips">{(detailsClient.services || []).map((s) => <span className="chip" key={s}>{SERVICE_LABELS[s]}</span>)}</div>
                </section>

                <section className="details-section">
                  <div className="section-heading"><h4>Documents</h4><span>{detailsDocuments.length} uploaded</span></div>
                  {detailsDocuments.length === 0 ? (
                    <div className="doc-empty">No documents uploaded yet.</div>
                  ) : (
                    <div className="document-grid">
                      {detailsDocuments.map((doc) => (
                        <div className="document-card" key={doc._id}>
                          <div className="document-icon">📄</div>
                          <div className="document-main">
                            <strong>{doc.documentType}</strong>
                            <span>{doc.serviceType === 'INCOME_TAX' && doc.financialYear ? `Income Tax · AY ${doc.financialYear}` : SERVICE_LABELS[doc.serviceType]}</span>
                            <small>{doc.originalName}</small>
                          </div>
                          <div className="document-actions">
                            <button className="mini-btn" type="button" onClick={async () => {
                              try { await apiOpenFile(`/documents/${doc._id}`, doc.originalName); }
                              catch (err) { setError(err.message); }
                            }}>View</button>
                            <button className="mini-btn secondary-mini" type="button" onClick={async () => {
                              try { await apiDownload(`/documents/${doc._id}`, doc.originalName); }
                              catch (err) { setError(err.message); }
                            }}>Download</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="details-section">
                  <div className="section-heading"><h4>Recent Invoices</h4><span>{detailsInvoices.length} total</span></div>
                  {detailsInvoices.length === 0 ? (
                    <div className="doc-empty">No invoices for this client yet.</div>
                  ) : (
                    <div className="invoice-mini-list">
                      {detailsInvoices.slice(0, 5).map((invoice) => (
                        <div className="invoice-mini-row" key={invoice._id}>
                          <div><strong>{invoice.invoiceNumber}</strong><span>{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span></div>
                          <strong>₹{Number(invoice.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            <div className="details-footer">
              <button className="secondary" onClick={() => { setDetailsClient(null); openEdit(detailsClient); }}>Edit Client</button>
              <button className="primary" onClick={() => setDetailsClient(null)}>Done</button>
            </div>
          </aside>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}>
          <form className="modal card" onSubmit={save}>
            <div className="modal-head">
              <div>
                <h3>{selected ? 'Edit Client' : 'Add Client'}</h3>
                <p className="muted">Select services and attach the actual documents required for each service.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setShowForm(false)}>×</button>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="form-grid">
              <Field label="Name" value={form.name} onChange={(value) => setField('name', value)} required />
              <Field label="Business Name" value={form.businessName} onChange={(value) => setField('businessName', value)} />
              <Field label="Phone" value={form.phone} onChange={(value) => setField('phone', value)} />
              <Field label="Email" value={form.email} onChange={(value) => setField('email', value)} type="email" />
              <Field label="PAN" value={form.panNumber} onChange={(value) => setField('panNumber', value)} />
              <Field label="GSTIN" value={form.gstin} onChange={(value) => setField('gstin', value)} />
              <Field label="City" value={form.city} onChange={(value) => setField('city', value)} />
              <Field label="District" value={form.district} onChange={(value) => setField('district', value)} />
              <Field label="State" value={form.state} onChange={(value) => setField('state', value)} />
              <Field label="State Code" value={form.stateCode || ''} onChange={(value) => setField('stateCode', value)} placeholder="e.g. 19" />
              <Field label="PIN" value={form.pincode} onChange={(value) => setField('pincode', value)} />
              <div className="field full"><label>Address</label><textarea rows="3" value={form.address} onChange={(event) => setField('address', event.target.value)} /></div>

              <div className="field full">
                <label>Services <span className="required-mark">*</span></label>
                <div className="service-options">
                  {SERVICES.map((item) => (
                    <label key={item.key} className={`service-option ${form.services.includes(item.key) ? 'selected' : ''}`}>
                      <input type="checkbox" checked={form.services.includes(item.key)} onChange={() => toggleService(item.key)} />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.services.includes('INCOME_TAX') && (
                <div className="field full">
                  <label>Income Tax — Assessment Year <span className="required-mark">*</span></label>
                  <div className="year-options">
                    {ASSESSMENT_YEARS.map((year) => (
                      <label key={year} className={`year-option ${assessmentYears.includes(year) ? 'selected' : ''}`}>
                        <input type="checkbox" checked={assessmentYears.includes(year)} onChange={() => toggleAssessmentYear(year)} />
                        <span>{year}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="field full">
                <div className="section-title-row">
                  <div>
                    <label>Document Attachments</label>
                    <p className="muted tiny">Only the documents belonging to the selected services are shown below.</p>
                  </div>
                </div>

                {!attachmentInputs.length && (
                  <div className="doc-empty">Select at least one service above. The required document upload fields will appear here.</div>
                )}

                {attachmentInputs.length > 0 && (
                  <div className="attachment-stack">
                    {attachmentInputs.map((item) => {
                      const attachmentKey = `${item.serviceType}-${item.key}-${item.financialYear || 'general'}`;
                      const current = attachments[attachmentKey];
                      const label = item.financialYear ? `${item.documentType} — AY ${item.financialYear}` : item.documentType;

                      return (
                        <FileUpload
                          key={attachmentKey}
                          label={label}
                          required={item.required}
                          value={current}
                          onChange={(value) => setAttachment(attachmentKey, value ? { ...value, serviceType: item.serviceType, documentType: item.documentType, financialYear: item.financialYear || '' } : null)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {selected && (
                <div className="field full">
                  <label>Previously Uploaded Documents</label>
                  {docsLoading ? (
                    <div className="doc-empty">Loading documents...</div>
                  ) : clientDocuments.length === 0 ? (
                    <div className="doc-empty">No documents uploaded yet.</div>
                  ) : (
                    <div className="uploaded-list">
                      {clientDocuments.map((doc) => (
                        <div className="uploaded-row" key={doc._id}>
                          <div><strong>{doc.documentType}</strong><span>{doc.serviceType === 'INCOME_TAX' && doc.financialYear ? `AY ${doc.financialYear}` : SERVICE_LABELS[doc.serviceType]}</span></div>
                          <span className="muted tiny">{doc.originalName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary" disabled={saving}>{saving ? 'Saving & Uploading...' : selected ? 'Update Client' : 'Save Client'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
