import { Router } from 'express';
import { getAllCustomRoles, createCustomRole, updateCustomRole, deleteCustomRole } from '../controllers/customRoleController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getAllCustomRoles);
router.post('/', createCustomRole);
router.put('/:value', updateCustomRole);
router.delete('/:value', deleteCustomRole);

export default router;
