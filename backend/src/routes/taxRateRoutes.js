import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { createTaxRate, listTaxRates, toggleTaxRate } from '../controllers/taxRateController.js';

const router = Router();
router.use(requireAdmin);
router.get('/', listTaxRates);
router.post('/', createTaxRate);
router.patch('/:id/toggle', toggleTaxRate);
export default router;
