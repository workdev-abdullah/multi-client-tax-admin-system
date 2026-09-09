import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');

  const existing = await Admin.findOne({ email });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, 12);
  return Admin.create({ email, passwordHash, role: 'ADMIN' });
}

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const admin = await ensureAdmin();
    if (!admin.isActive || admin.email !== email.toLowerCase()) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { sub: admin._id.toString(), email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, admin: { id: admin._id, email: admin.email, role: admin.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Login failed' });
  }
}

export function me(req, res) {
  res.json({ admin: req.admin });
}
