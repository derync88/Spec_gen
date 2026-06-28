import { Router } from 'express';
import * as catalogueController from '../controllers/catalogueController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', catalogueController.get);
router.post('/match', catalogueController.match);

export default router;
