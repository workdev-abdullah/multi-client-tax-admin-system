import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { invoicePdf, clientsPdf, productsPdf, inventoryPdf, clientsExcel, productsExcel, inventoryExcel, invoicesExcel, stockHistoryExcel, stockHistoryPdf, summaryPdf, summaryExcel } from '../controllers/reportController.js';

const r = Router();
r.use(requireAdmin);
r.get('/invoice/:id/pdf', invoicePdf);
r.get('/summary.pdf', summaryPdf);
r.get('/clients.pdf', clientsPdf);
r.get('/products.pdf', productsPdf);
r.get('/inventory.pdf', inventoryPdf);
r.get('/summary.xlsx', summaryExcel);
r.get('/clients.xlsx', clientsExcel);
r.get('/products.xlsx', productsExcel);
r.get('/invoices.xlsx', invoicesExcel);
r.get('/inventory.xlsx', inventoryExcel);
r.get('/stock-history.xlsx', stockHistoryExcel);
r.get('/stock-history.pdf', stockHistoryPdf);
export default r;
