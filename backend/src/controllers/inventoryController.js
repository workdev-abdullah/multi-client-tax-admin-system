import Inventory from '../models/Inventory.js';
import StockMovement from '../models/StockMovement.js';
import Product from '../models/Product.js';
import { audit } from '../services/audit.js';

const toNumber = (value) => Number(value?.toString?.() ?? value ?? 0);

export async function listInventory(req, res) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const products = await Product.find({ clientId, isActive: true }).select('description hsnSac unit rate isActive').sort({ description: 1 }).lean();
    const inventory = await Inventory.find({ clientId }).lean();
    const byProduct = new Map(inventory.map((row) => [String(row.productId), row]));

    const items = products.map((product) => {
      const row = byProduct.get(String(product._id));
      const rate = toNumber(product.rate);
      const quantity = toNumber(row?.quantity);
      const safeProduct = {
        ...product,
        rate
      };
      return {
        _id: row?._id || `virtual-${product._id}`,
        productId: safeProduct,
        quantity,
        rate,
        stockValue: quantity * rate,
        lowStockThreshold: toNumber(row?.lowStockThreshold),
        updatedAt: row?.updatedAt || null
      };
    });

    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load inventory' });
  }
}

export async function stockIn(req, res) {
  const mongoose = (await import('mongoose')).default;
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const { clientId, productId, quantity, notes = '', reference = '' } = req.body;
      if (!clientId) throw new Error('Client is required');
      const q = Number(quantity);
      if (!productId || !Number.isFinite(q) || q <= 0) throw new Error('Product and positive quantity are required');
      const product = await Product.findOne({ _id: productId, clientId }).session(session);
      if (!product || !product.isActive) throw new Error('Active product not found');
      const inventory = await Inventory.findOneAndUpdate(
        { clientId, productId },
        { $inc: { quantity: q } },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
      );
      const previousBalance = Number(inventory.quantity || 0) - q;
      const newBalance = Number(inventory.quantity || 0);
      await StockMovement.create([{ clientId, productId, type: 'STOCK_IN', quantity: q, previousBalance, newBalance, reference, notes, createdBy: req.admin?.email || '' }], { session });
      result = inventory;
      await audit(req, 'STOCK_IN', 'Inventory', inventory._id, { productId, quantity: q, previousBalance, newBalance });
    });
    res.status(201).json({ inventory: result });
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message || 'Failed to add stock' });
  } finally {
    await session.endSession();
  }
}

export async function setOpening(req, res) {
  try {
    const { clientId, productId, quantity, lowStockThreshold, notes = '' } = req.body;
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const q = Number(quantity);
    const threshold = Number(lowStockThreshold || 0);
    if (!productId || !Number.isFinite(q) || q < 0 || !Number.isFinite(threshold) || threshold < 0) {
      return res.status(400).json({ message: 'Valid product, quantity and low-stock threshold are required' });
    }

    const product = await Product.findOne({ _id: productId, clientId });
    if (!product || !product.isActive) return res.status(404).json({ message: 'Active product not found' });

    let inventory = await Inventory.findOne({ clientId, productId });
    if (!inventory) {
      inventory = await Inventory.create({ clientId, productId, quantity: q, lowStockThreshold: threshold });
      await StockMovement.create({
        clientId,
        productId,
        type: 'OPENING',
        quantity: q,
        previousBalance: 0,
        newBalance: q,
        notes,
        createdBy: req.admin?.email || ''
      });
    } else {
      const previousBalance = Number(inventory.quantity || 0);
      inventory.quantity = q;
      inventory.lowStockThreshold = threshold;
      await inventory.save();
      if (q !== previousBalance) {
        await StockMovement.create({
          clientId,
          productId,
          type: q > previousBalance ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          quantity: Math.abs(q - previousBalance),
          previousBalance,
          newBalance: q,
          notes,
          createdBy: req.admin?.email || ''
        });
      }
    }

    inventory.lowStockThreshold = threshold;
    await inventory.save();
    await audit(req, 'SET_OPENING_STOCK', 'Inventory', inventory._id, { productId, quantity: q, lowStockThreshold: threshold });
    res.json({ inventory });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to set stock' });
  }
}

export async function history(req, res) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const items = await StockMovement.find({ clientId }).populate('productId', 'description unit hsnSac').sort({ createdAt: -1 }).limit(500).lean();
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load stock history' });
  }
}
