import { Router } from 'express';
import { getAllWorkflows, createWorkflow, deleteWorkflow } from '../controllers/workflowController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getAllWorkflows);
router.post('/', createWorkflow);
router.delete('/:targetRole', deleteWorkflow);

export default router;
