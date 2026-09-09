import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { requireAdmin } from '../middleware/auth.js';
import { getDocument, listClientDocuments, uploadDocument } from '../controllers/documentController.js';

const router = Router();
const uploadDir = path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    cb(allowed.has(file.mimetype) ? null : new Error('Only PDF, JPG, PNG or WEBP files are allowed'), allowed.has(file.mimetype));
  }
});

router.use(requireAdmin);
router.get('/client/:clientId', listClientDocuments);
router.get('/:id', getDocument);
router.post('/client/:clientId', upload.single('file'), uploadDocument);

export default router;
