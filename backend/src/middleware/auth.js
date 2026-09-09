import jwt from 'jsonwebtoken';

export function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ message: 'Admin authentication required' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'ADMIN') return res.status(403).json({ message: 'Admin access only' });

    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
