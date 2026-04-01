import { Router } from 'express';
import { getAllGradeConfigs, saveAllGradeConfigs } from '../controllers/gradeConfigController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getAllGradeConfigs);
router.post('/', saveAllGradeConfigs);

export default router;
