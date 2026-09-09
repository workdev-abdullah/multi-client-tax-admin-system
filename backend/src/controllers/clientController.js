import Client from '../models/Client.js';

const allowedServices = new Set(['GST', 'INCOME_TAX', 'P_TAX', 'OTHERS']);

const STATE_CODES = new Map([
  ['jammu and kashmir','01'],['himachal pradesh','02'],['punjab','03'],['chandigarh','04'],
  ['uttarakhand','05'],['haryana','06'],['delhi','07'],['rajasthan','08'],
  ['uttar pradesh','09'],['bihar','10'],['sikkim','11'],['arunachal pradesh','12'],
  ['nagaland','13'],['manipur','14'],['mizoram','15'],['tripura','16'],['meghalaya','17'],
  ['assam','18'],['west bengal','19'],['jharkhand','20'],['odisha','21'],['chhattisgarh','22'],
  ['madhya pradesh','23'],['gujarat','24'],['dadra and nagar haveli and daman and diu','26'],
  ['maharashtra','27'],['andhra pradesh','37'],['karnataka','29'],['goa','30'],['lakshadweep','31'],
  ['kerala','32'],['tamil nadu','33'],['pondicherry','34'],['puducherry','34'],
  ['andaman and nicobar islands','35'],['telangana','36'],['ladakh','38']
]);

function normalizeStateCode(stateCode = '', gstin = '') {
  const code = String(stateCode || '').trim();
  if (/^\d{2}$/.test(code)) return code;
  const state = code.toLowerCase();
  if (STATE_CODES.has(state)) return STATE_CODES.get(state);
  const gst = String(gstin || '').trim();
  return /^\d{2}/.test(gst) ? gst.slice(0, 2) : '';
}

function cleanServices(services) {
  if (!Array.isArray(services)) return [];
  return [...new Set(services.filter((service) => allowedServices.has(service)))];
}

function normalizeClient(body = {}) {
  return {
    name: String(body.name || '').trim(),
    businessName: String(body.businessName || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    address: String(body.address || '').trim(),
    city: String(body.city || '').trim(),
    district: String(body.district || '').trim(),
    state: String(body.state || '').trim(),
    stateCode: normalizeStateCode(body.stateCode, body.gstin),
    pincode: String(body.pincode || '').trim(),
    panNumber: String(body.panNumber || '').trim().toUpperCase(),
    gstin: String(body.gstin || '').trim().toUpperCase(),
    services: cleanServices(body.services)
  };
}

function generateClientCode() {
  const time = Date.now().toString(36).slice(-6).toUpperCase();
  const rand = Math.floor(100 + Math.random() * 900);
  return `CL-${time}-${rand}`;
}

export async function listClients(req, res) {
  try {
    const { search = '', service = 'ALL', status = 'ACTIVE', page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const filter = {};
    if (status !== 'ALL') filter.status = status;
    if (service !== 'ALL' && allowedServices.has(service)) filter.services = service;

    const trimmedSearch = String(search).trim();
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: regex },
        { businessName: regex },
        { phone: regex },
        { gstin: regex },
        { panNumber: regex },
        { clientCode: regex }
      ];
    }

    const [items, total] = await Promise.all([
      Client.find(filter).sort({ createdAt: -1 }).skip((pageNumber - 1) * limitNumber).limit(limitNumber).lean(),
      Client.countDocuments(filter)
    ]);

    res.json({ items, pagination: { page: pageNumber, limit: limitNumber, total, pages: Math.ceil(total / limitNumber) } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load clients' });
  }
}

export async function getClient(req, res) {
  try {
    const client = await Client.findById(req.params.id).lean();
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ client });
  } catch {
    res.status(400).json({ message: 'Invalid client id' });
  }
}

export async function createClient(req, res) {
  try {
    const data = normalizeClient(req.body);
    if (!data.name) return res.status(400).json({ message: 'Client name is required' });
    if (!data.services.length) return res.status(400).json({ message: 'Select at least one service' });

    const client = await Client.create({ ...data, clientCode: generateClientCode() });
    res.status(201).json({ client });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create client' });
  }
}

export async function updateClient(req, res) {
  try {
    const data = normalizeClient(req.body);
    if (!data.name) return res.status(400).json({ message: 'Client name is required' });
    if (!data.services.length) return res.status(400).json({ message: 'Select at least one service' });

    const client = await Client.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ client });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update client' });
  }
}

export async function toggleClientStatus(req, res) {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    client.status = client.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await client.save();
    res.json({ client });
  } catch {
    res.status(400).json({ message: 'Invalid client id' });
  }
}
