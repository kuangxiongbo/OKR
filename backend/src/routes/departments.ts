import { Router } from 'express';
import { getAllDepartments, createDepartment, deleteDepartment, updateDepartment } from '../controllers/departmentController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getAllDepartments);
router.post('/', createDepartment);
router.put('/:name', updateDepartment);
router.delete('/:name', deleteDepartment);

export default router;
