import TaxRate from '../models/TaxRate.js';

const DEFAULT_TAX_RATES = [
  { name: '5%', totalRate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5 },
  { name: '12%', totalRate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12 },
  { name: '18%', totalRate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18 },
  { name: '40%', totalRate: 40, cgstRate: 20, sgstRate: 20, igstRate: 40 }
];

export async function ensureDefaultTaxRates() {
  const count = await TaxRate.countDocuments();
  if (count > 0) return;
  await TaxRate.insertMany(DEFAULT_TAX_RATES);
}

export async function listTaxRates(req, res) {
  try {
    await ensureDefaultTaxRates();
    const rates = await TaxRate.find().sort({ totalRate: 1, name: 1 }).lean();
    const serialized = rates.map((r) => ({ ...r, totalRate: Number(r.totalRate.toString()), cgstRate: Number(r.cgstRate.toString()), sgstRate: Number(r.sgstRate.toString()), igstRate: Number(r.igstRate.toString()) }));
    res.json({ rates: serialized });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load tax rates' });
  }
}

export async function createTaxRate(req, res) {
  try {
    const name = String(req.body.name || '').trim();
    const totalRate = Number(req.body.totalRate);
    const cgstRate = Number(req.body.cgstRate);
    const sgstRate = Number(req.body.sgstRate);
    const igstRate = Number(req.body.igstRate);
    const notes = String(req.body.notes || '').trim();

    if (!name) return res.status(400).json({ message: 'Tax rate name is required' });
    if (![totalRate, cgstRate, sgstRate, igstRate].every((n) => Number.isFinite(n) && n >= 0)) {
      return res.status(400).json({ message: 'Enter valid tax rates' });
    }

    const rate = await TaxRate.create({ name, totalRate, cgstRate, sgstRate, igstRate, notes });
    res.status(201).json({ rate });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'A tax rate with this name already exists' });
    console.error(error);
    res.status(500).json({ message: 'Failed to create tax rate' });
  }
}

export async function toggleTaxRate(req, res) {
  try {
    const rate = await TaxRate.findById(req.params.id);
    if (!rate) return res.status(404).json({ message: 'Tax rate not found' });
    rate.isActive = !rate.isActive;
    await rate.save();
    res.json({ rate });
  } catch {
    res.status(400).json({ message: 'Invalid tax rate id' });
  }
}
