import { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';

const basicFields = ['businessName','address','city','district','state','stateCode','pincode','phone','email','gstin','pan'];
const invoiceFields = ['invoicePrefix','financialYear','startingSequence','paymentTerms'];

export default function SettingsPage({ clientId }){
  const [form,setForm]=useState({roundOff:false})
  const [saved,setSaved]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [logs,setLogs]=useState([]);
  const [logsLoading,setLogsLoading]=useState(false);

  useEffect(()=>{
    apiFetch(`/settings?clientId=${clientId || ''}`).then(d=>setForm({...d.settings,roundOff:d.settings?.roundOff ?? false})).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[]);

  async function loadLogs(){
    setLogsLoading(true);
    try{ const d=await apiFetch(`/settings/activity?limit=100&clientId=${clientId || ''}`); setLogs(d.logs||[]); }
    catch(e){ setError(e.message); }
    finally{ setLogsLoading(false); }
  }

  async function save(e){
    e.preventDefault();
    setSaved('');
    setError('');
    const startingSequence = form.startingSequence === '' || form.startingSequence == null ? 1 : Number(form.startingSequence);
    if (!Number.isInteger(startingSequence) || startingSequence < 1) {
      setError('Starting sequence must be a whole number greater than 0.');
      return;
    }
    setSaving(true);
    try{
      await apiFetch('/settings',{method:'PUT',body:JSON.stringify({...form, clientId, startingSequence})});
      setSaved('Settings saved successfully.');
    }catch(err){setError(err.message);} finally {setSaving(false);}
  }

  function inputField(key){
    const label=key.replace(/([A-Z])/g,' $1').replace(/^./,m=>m.toUpperCase());
    return <label key={key}>{label}<input value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>;
  }

  if(loading) return <section><div className="card empty">Loading settings...</div></section>;

  return <section>
    <div className="page-head"><div><h3>Settings</h3><p className="muted">Business profile and invoice configuration.</p></div></div>
    {saved&&<div className="success">{saved}</div>}
    {error&&<div className="error page-error">{error}</div>}
    <form onSubmit={save}>
      <div className="card" style={{padding:20,marginBottom:18}}>
        <div className="section-title"><h3>Business Profile</h3><p className="muted">These details are used on GST invoices.</p></div>
        <div className="form-grid">{basicFields.map(inputField)}</div>
      </div>
      <div className="card" style={{padding:20}}>
        <div className="section-title"><h3>Invoice Settings</h3><p className="muted">Controls invoice numbering and print details.</p></div>
        <div className="form-grid">{invoiceFields.map(inputField)}
          <label className="full">Declaration<textarea rows="4" value={form.declaration??''} onChange={e=>setForm({...form,declaration:e.target.value})}/></label>
          <label className="service-option selected" style={{alignItems:'center'}}><input type="checkbox" checked={Boolean(form.roundOff)} onChange={e=>setForm({...form,roundOff:e.target.checked})}/><span>Enable invoice round-off</span></label>
        </div>
        <div style={{marginTop:16}}><button className="primary" type="submit" disabled={saving}>{saving?'Saving...':'Save Settings'}</button></div>
      </div>
    </form>

    <div className="card" style={{padding:20,marginTop:18}}>
      <div className="section-title"><div><h3>Activity Log</h3><p className="muted">Recent administrative actions recorded by the system.</p></div><button className="secondary" type="button" onClick={loadLogs}>{logsLoading?'Loading...':'Refresh Log'}</button></div>
      {logsLoading ? <div className="doc-empty">Loading activity...</div> : logs.length===0 ? <div className="doc-empty">{logsLoading?'Loading activity...':'No activity loaded. Click Refresh Log to view recent activity.'}</div> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Entity</th><th>Admin</th></tr></thead><tbody>{logs.map(log=><tr key={log._id}><td>{log.createdAt?new Date(log.createdAt).toLocaleString('en-IN'):'—'}</td><td>{log.action}</td><td>{log.entity}{log.entityId?<div className="muted tiny">{log.entityId}</div>:null}</td><td>{log.metadata?.email||'Admin'}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
