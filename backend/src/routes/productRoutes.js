import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { createProduct, listProducts, toggleProductStatus, updateProduct } from '../controllers/productController.js';

const router = Router();
router.use(requireAdmin);
router.get('/', listProducts);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id/status', toggleProductStatus);
export default router;
