import mongoose from 'mongoose';
const schema=new mongoose.Schema({adminId:String,action:String,entity:String,entityId:String,metadata:Object},{timestamps:true}); schema.index({createdAt:-1}); export default mongoose.model('AuditLog',schema);
