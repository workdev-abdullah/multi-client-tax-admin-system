import mongoose from 'mongoose';
const schema=new mongoose.Schema({clientId:{type:mongoose.Schema.Types.ObjectId,ref:'Client',required:true,index:true},financialYear:{type:String,required:true},prefix:{type:String,default:'INV'},nextNumber:{type:Number,default:1,min:1}},{timestamps:true});
schema.index({clientId:1,financialYear:1},{unique:true});
export default mongoose.model('InvoiceSequence',schema);
