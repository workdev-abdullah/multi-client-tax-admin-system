import Product from '../models/Product.js';
import TaxRate from '../models/TaxRate.js';
import Client from '../models/Client.js';

function normalize(body = {}) {
  return {
    description: String(body.description || '').trim(),
    hsnSac: String(body.hsnSac || '').trim().toUpperCase(),
    rate: Number(body.rate),
    unit: String(body.unit || 'Pcs').trim(),
    taxRateId: String(body.taxRateId || '').trim()
  };
}

function serializeProduct(product) {
  return {
    ...product,
    rate: product?.rate != null ? Number(product.rate.toString()) : 0,
    taxRateId: product?.taxRateId
      ? {
          ...product.taxRateId,
          totalRate: product.taxRateId.totalRate != null ? Number(product.taxRateId.totalRate.toString()) : 0,
          cgstRate: product.taxRateId.cgstRate != null ? Number(product.taxRateId.cgstRate.toString()) : 0,
          sgstRate: product.taxRateId.sgstRate != null ? Number(product.taxRateId.sgstRate.toString()) : 0,
          igstRate: product.taxRateId.igstRate != null ? Number(product.taxRateId.igstRate.toString()) : 0
        }
      : null
  };
}

export async function listProducts(req, res) {
  try {
    const { search = '', status = 'ACTIVE' } = req.query;
    const filter = { clientId: req.query.clientId };
    if (!filter.clientId) return res.status(400).json({ message: 'Client is required' });
    if (status !== 'ALL') filter.isActive = status === 'ACTIVE';

    const trimmedSearch = String(search).trim();
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ description: regex }, { hsnSac: regex }];
    }

    const products = await Product.find(filter)
      .populate({ path: 'taxRateId', select: 'name totalRate cgstRate sgstRate igstRate isActive' })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ products: products.map(serializeProduct) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load products' });
  }
}

export async function createProduct(req, res) {
  try {
    const data = normalize(req.body);
    if (!req.body.clientId) return res.status(400).json({ message: 'Client is required' });
    data.clientId = req.body.clientId;
    const client = await Client.findOne({ _id: data.clientId, status: 'ACTIVE' }).select('_id');
    if (!client) return res.status(400).json({ message: 'Active client not found' });
    if (!data.description) return res.status(400).json({ message: 'Product description is required' });
    if (!data.hsnSac) return res.status(400).json({ message: 'HSN/SAC is required' });
    if (!Number.isFinite(data.rate) || data.rate < 0) return res.status(400).json({ message: 'Enter a valid rate' });
    if (!data.unit) return res.status(400).json({ message: 'Unit is required' });

    const taxRate = await TaxRate.findById(data.taxRateId).select('_id isActive');
    if (!taxRate) return res.status(400).json({ message: 'Please select a valid tax rate' });
    if (!taxRate.isActive) return res.status(400).json({ message: 'Selected tax rate is inactive' });

    const product = await Product.create(data);
    await product.populate({ path: 'taxRateId', select: 'name totalRate cgstRate sgstRate igstRate isActive' });
    res.status(201).json({ product: product.toJSON() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create product' });
  }
}

export async function updateProduct(req, res) {
  try {
    const data = normalize(req.body);
    if (!data.description) return res.status(400).json({ message: 'Product description is required' });
    if (!data.hsnSac) return res.status(400).json({ message: 'HSN/SAC is required' });
    if (!Number.isFinite(data.rate) || data.rate < 0) return res.status(400).json({ message: 'Enter a valid rate' });
    if (!data.unit) return res.status(400).json({ message: 'Unit is required' });

    const taxRate = await TaxRate.findById(data.taxRateId).select('_id isActive');
    if (!taxRate) return res.status(400).json({ message: 'Please select a valid tax rate' });
    if (!taxRate.isActive) return res.status(400).json({ message: 'Selected tax rate is inactive' });

    const product = await Product.findOneAndUpdate({ _id: req.params.id, clientId: data.clientId }, data, { new: true, runValidators: true })
      .populate({ path: 'taxRateId', select: 'name totalRate cgstRate sgstRate igstRate isActive' });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ product: product.toJSON() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update product' });
  }
}

export async function toggleProductStatus(req, res) {
  try {
    const product = await Product.findOne({ _id: req.params.id, clientId: req.body.clientId || req.query.clientId });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    product.isActive = !product.isActive;
    await product.save();
    res.json({ product: product.toJSON() });
  } catch {
    res.status(400).json({ message: 'Invalid product id' });
  }
}
