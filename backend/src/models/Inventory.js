import mongoose from 'mongoose';
const schema=new mongoose.Schema({clientId:{type:mongoose.Schema.Types.ObjectId,ref:'Client',required:true,index:true},productId:{type:mongoose.Schema.Types.ObjectId,ref:'Product',required:true},quantity:{type:Number,default:0,min:0},lowStockThreshold:{type:Number,default:0,min:0}},{timestamps:true});
schema.index({clientId:1,productId:1},{unique:true}); schema.index({clientId:1,quantity:1}); export default mongoose.model('Inventory',schema);
