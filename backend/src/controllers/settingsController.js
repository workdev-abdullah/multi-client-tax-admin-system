import Settings from "../models/Settings.js";
import { audit } from "../services/audit.js";
export async function getSettings(req, res) {
  try {
    const clientId = req.query.clientId || req.body.clientId;
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    let s = await Settings.findOne({ clientId });
    if (!s) s = await Settings.create({ clientId });
    res.json({ settings: s });
  } catch (e) {
    res.status(500).json({ message: "Failed to load settings" });
  }
}
export async function updateSettings(req, res) {
  try {
    const clientId = req.body.clientId;
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    let s = await Settings.findOne({ clientId });
    if (!s) s = new Settings({ clientId });
    const allowed = [
      "businessName",
      "address",
      "city",
      "district",
      "state",
      "stateCode",
      "pincode",
      "phone",
      "email",
      "gstin",
      "pan",
      "logoPath",
      "signaturePath",
      "invoicePrefix",
      "financialYear",
      "startingSequence",
      "paymentTerms",
      "declaration",
      "roundOff",
    ];
    for (const k of allowed) if (req.body[k] !== undefined) s[k] = req.body[k];
    await s.save();
    await audit(req, "UPDATE", "Settings", s._id);
    res.json({ settings: s });
  } catch (e) {
    res.status(500).json({ message: "Failed to save settings" });
  }
}
