import express from 'express';
import RegistrationController from '../controllers/registrationController.js';

const router = express.Router();
const controller = new RegistrationController();

// POST /api/v1/registrations/register
router.post('/', controller.register.bind(controller));

// GET /api/v1/registrations/:id
router.get('/:id', controller.getUser.bind(controller));

export default router;
