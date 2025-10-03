import express from 'express';
import RegistrationController from '../controllers/registrationController.js';

const router = express.Router();
const controller = new RegistrationController();

// POST /api/v1/registrations/register
router.post('/', controller.register.bind(controller));

// GET /api/v1/registrations/failed
router.get('/failed', controller.getFailedRegistrations.bind(controller));

// DELETE /api/v1/registrations/failed
router.delete('/failed', controller.deleteFailedRegistration.bind(controller));

export default router;
