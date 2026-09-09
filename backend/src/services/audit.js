import AuditLog from '../models/AuditLog.js';
export async function audit(req,action,entity,entityId,metadata={}){ try{await AuditLog.create({adminId:req.admin?.sub||'',action,entity,entityId:String(entityId||''),metadata});}catch(e){console.error('audit:',e.message);} }
