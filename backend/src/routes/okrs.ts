import { Router } from 'express';
import {
  getAllOKRs,
  getOKRById,
  createOKR,
  updateOKR,
  deleteOKR,
  updateOKRStatus,
  approveOKR,
  archiveOKR,
  moveOKRPriority,
  mergeOKRs
} from '../controllers/okrController';
import { importOKRByAI } from '../controllers/aiImportController';
import { authenticate } from '../middleware/auth';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

router.get('/', getAllOKRs);
router.post('/import/ai', importOKRByAI);
router.get('/:id', getOKRById);
router.post('/', createOKR);
router.put('/:id', updateOKR);
router.patch('/:id/status', updateOKRStatus);
router.post('/:id/approve', approveOKR);
router.post('/:id/archive', archiveOKR);
router.delete('/:id', deleteOKR);
router.post('/:id/move', moveOKRPriority);
router.post('/merge', mergeOKRs);

export default router;
