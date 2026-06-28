import { Router } from 'express';
import multer from 'multer';
import * as specsController from '../controllers/specsController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// In-memory upload, 1 MB cap — we only read text out of it.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
});

router.use(requireAuth);

router.get('/', specsController.list);
router.post('/', upload.single('file'), specsController.create);
router.get('/:id', specsController.get);
router.put('/:id', upload.single('file'), specsController.update);
router.delete('/:id', specsController.remove);
router.post('/:id/review', specsController.review);
router.post('/:id/rewrite', specsController.rewrite);
router.get('/:id/export', specsController.exportMarkdown);
router.get('/:id/export-spec', specsController.exportRewrite);

export default router;
