import express from 'express';
import authenticateJWT from '../middlewares/authenticateJWT.js';
import roleMiddleware from '../middlewares/roleMiddleware.js';
import EmployeeController from '../controllers/employeeController.js';
import {
  validateEmployeeCreate,
  validateEmployeeUpdate,
  validateSpecialtyCreate,
  validateSpecialtyUpdate
} from '../middlewares/validationMiddleware.js';

const router = express.Router();

// GET /employees - Listar todos os funcionários (owner, manager)
router.get('/', authenticateJWT, roleMiddleware(['owner', 'manager']), EmployeeController.list);

// GET /employees/:id - Detalhe de funcionário (owner, manager, employee dono do próprio id)
router.get('/:id', authenticateJWT, EmployeeController.detail);

// POST /employees - Criar funcionário (owner, manager)
router.post('/', authenticateJWT, roleMiddleware(['owner', 'manager']), validateEmployeeCreate, EmployeeController.create);

// PUT /employees/:id - Atualizar funcionário (owner, manager)
router.put('/:id', authenticateJWT, roleMiddleware(['owner', 'manager']), validateEmployeeUpdate, EmployeeController.update);

// DELETE /employees/:id - Remover funcionário (owner)
router.delete('/:id', authenticateJWT, roleMiddleware(['owner']), EmployeeController.remove);

// GET /employees/:id/specialties - Listar especialidades (owner, manager, employee dono do próprio id)
router.get('/:id/specialties', authenticateJWT, EmployeeController.listSpecialties);

// POST /employees/:id/specialties - Adicionar especialidade (owner, manager)
router.post('/:id/specialties', authenticateJWT, roleMiddleware(['owner', 'manager']), validateSpecialtyCreate, EmployeeController.addSpecialty);

// PUT /employees/:id/specialties/:specialtyId - Atualizar especialidade (owner, manager)
router.put('/:id/specialties/:specialtyId', authenticateJWT, roleMiddleware(['owner', 'manager']), validateSpecialtyUpdate, EmployeeController.updateSpecialty);

// DELETE /employees/:id/specialties/:specialtyId - Remover especialidade (owner, manager)
router.delete('/:id/specialties/:specialtyId', authenticateJWT, roleMiddleware(['owner', 'manager']), EmployeeController.removeSpecialty);

// GET /employees/:id/performance - Performance do funcionário (owner, manager, employee dono do próprio id)
router.get('/:id/performance', authenticateJWT, EmployeeController.performance);

// GET /employees/:id/commissions - Comissões do funcionário (owner, manager, employee dono do próprio id)
router.get('/:id/commissions', authenticateJWT, EmployeeController.commissions);

// GET /employees/:id/schedule - Agenda do funcionário (owner, manager, employee dono do próprio id)
router.get('/:id/schedule', authenticateJWT, EmployeeController.schedule);

export default router;
