import Client from '../models/Client.js';
import Product from '../models/Product.js';
import Invoice from '../models/Invoice.js';
import Inventory from '../models/Inventory.js';
import mongoose from 'mongoose';
export async function summary(req,res){try{const clientId=String(req.query.clientId||'').trim();if(!clientId)return res.status(400).json({message:'Client is required'});if(!mongoose.isValidObjectId(clientId))return res.status(400).json({message:'Invalid client'});const clientObjectId=new mongoose.Types.ObjectId(clientId);const {from,to}=req.query;const date={};if(from)date.$gte=new Date(from);if(to)date.$lte=new Date(`${to}T23:59:59`);const f={clientId:clientObjectId,status:'ISSUED',...(Object.keys(date).length?{invoiceDate:date}:{})};const [client,products,invoices,sales,stock,low]=await Promise.all([Client.findById(clientId).select('status').lean(),Product.countDocuments({clientId,isActive:true}),Invoice.countDocuments(f),Invoice.aggregate([{$match:f},{$group:{_id:null,sales:{$sum:{$toDouble:'$grandTotal'}},taxable:{$sum:{$toDouble:'$taxableTotal'}},cgst:{$sum:{$toDouble:'$cgstTotal'}},sgst:{$sum:{$toDouble:'$sgstTotal'}},igst:{$sum:{$toDouble:'$igstTotal'}}}}]),Inventory.aggregate([{$match:{clientId:clientObjectId}},{$lookup:{from:'products',localField:'productId',foreignField:'_id',as:'p'}},{$unwind:'$p'},{$project:{value:{$multiply:['$quantity',{$toDouble:'$p.rate'}]},quantity:1,threshold:'$lowStockThreshold'}}]),Product.aggregate([
  {$match:{clientId:clientObjectId,isActive:true}},
  {$lookup:{from:'inventories',let:{product:'$_id'},pipeline:[{$match:{$expr:{$and:[{$eq:['$productId','$$product']},{$eq:['$clientId',clientObjectId]}]}}},{$limit:1}],as:'stock'}},
  {$set:{qty:{$ifNull:[{$arrayElemAt:['$stock.quantity',0]},0]},threshold:{$ifNull:[{$arrayElemAt:['$stock.lowStockThreshold',0]},0]}}},
  {$match:{$expr:{$lte:['$qty','$threshold']}}},
  {$count:'count'}
])]);const s=sales[0]||{};res.json({summary:{clients:client?.status==='ACTIVE'?1:0,products,invoices,sales:s.sales||0,taxable:s.taxable||0,cgst:s.cgst||0,sgst:s.sgst||0,igst:s.igst||0,stockValue:stock.reduce((a,x)=>a+(x.value||0),0),lowStock:Number(low?.[0]?.count||0)}});}catch(e){console.error(e);res.status(500).json({message:'Failed to load summary'});}}
