import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import Client from '../models/Client.js';
import Product from '../models/Product.js';
import Invoice from '../models/Invoice.js';
import mongoose from 'mongoose';

const router = Router();
router.get('/', requireAdmin, async (req, res) => {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    if (!mongoose.isValidObjectId(clientId)) return res.status(400).json({ message: 'Invalid client' });
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const invoiceFilter = { clientId: clientObjectId, status: 'ISSUED' };
    const [client, products, invoices, lowStockRows, totals] = await Promise.all([
      Client.findOne({ _id: clientId, status: 'ACTIVE' }).select('_id').lean(),
      Product.countDocuments({ clientId, isActive: true }),
      Invoice.countDocuments(invoiceFilter),
      Product.aggregate([
        { $match: { clientId: clientObjectId, isActive: true } },
        { $lookup: {
          from: 'inventories',
          let: { productId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$clientId', clientObjectId] },
              { $eq: ['$productId', '$$productId'] }
            ] } } },
            { $limit: 1 }
          ],
          as: 'stock'
        } },
        { $set: {
          quantity: { $ifNull: [{ $arrayElemAt: ['$stock.quantity', 0] }, 0] },
          threshold: { $ifNull: [{ $arrayElemAt: ['$stock.lowStockThreshold', 0] }, 0] }
        } },
        { $match: { $expr: { $lte: ['$quantity', '$threshold'] } } },
        { $count: 'count' }
      ]),
      Invoice.aggregate([
        { $match: invoiceFilter },
        { $group: { _id: null, sales: { $sum: { $toDouble: '$grandTotal' } }, taxable: { $sum: { $toDouble: '$taxableTotal' } }, cgst: { $sum: { $toDouble: '$cgstTotal' } }, sgst: { $sum: { $toDouble: '$sgstTotal' } }, igst: { $sum: { $toDouble: '$igstTotal' } } } }
      ])
    ]);
    if (!client) return res.status(404).json({ message: 'Active client not found' });
    const t = totals[0] || {};
    res.json({ stats: { clients: 1, products, invoices, lowStock: Number(lowStockRows[0]?.count || 0), sales: Number(t.sales || 0), taxable: Number(t.taxable || 0), cgst: Number(t.cgst || 0), sgst: Number(t.sgst || 0), igst: Number(t.igst || 0) } });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Failed to load dashboard' }); }
});
export default router;
