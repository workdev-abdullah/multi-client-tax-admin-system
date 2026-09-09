import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { createClient, getClient, listClients, toggleClientStatus, updateClient } from '../controllers/clientController.js';

const router = Router();
router.use(requireAdmin);
router.get('/', listClients);
router.post('/', createClient);
router.get('/:id', getClient);
router.put('/:id', updateClient);
router.patch('/:id/status', toggleClientStatus);

export default router;
