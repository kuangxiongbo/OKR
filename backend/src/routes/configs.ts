import { Router } from 'express';
import { getWeComConfig, saveWeComConfig, getSSOConfig, saveSSOConfig, getAIConfig, saveAIConfig } from '../controllers/configController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/wecom', getWeComConfig);
router.post('/wecom', saveWeComConfig);
router.get('/sso', getSSOConfig);
router.post('/sso', saveSSOConfig);
router.get('/ai', getAIConfig);
router.post('/ai', saveAIConfig);

export default router;
