import { Router } from 'express';
import { getAllLogs } from '../controllers/logController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getAllLogs);

export default router;
