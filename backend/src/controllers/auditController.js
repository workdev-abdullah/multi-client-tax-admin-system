import AuditLog from '../models/AuditLog.js';
export async function listAuditLogs(req,res){
  try{
    const limit=Math.min(Math.max(Number(req.query.limit)||100,1),500);
    const logs=await AuditLog.find().sort({createdAt:-1}).limit(limit).lean();
    res.json({logs});
  }catch(error){ console.error(error); res.status(500).json({message:'Failed to load activity log'}); }
}
