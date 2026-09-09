import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import productRoutes from './routes/productRoutes.js';
import taxRateRoutes from './routes/taxRateRoutes.js';
import { ensureDefaultTaxRates } from './controllers/taxRateController.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import summaryRoutes from './routes/summaryRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(helmet());
app.use(rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false}));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tax-rates', taxRateRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File is too large. Maximum size is 10 MB.' });
  if (err?.message === 'Only PDF, JPG, PNG or WEBP files are allowed') return res.status(400).json({ message: err.message });
  res.status(500).json({ message: 'Internal server error' });
});

connectDB()
  .then(async () => {
    await ensureDefaultTaxRates();
    app.listen(port, () => console.log(`🚀 Backend running on http://localhost:${port}`));
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  });
