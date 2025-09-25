import express from 'express';
import RegistrationController from './RegistrationController.js';

const router = express.Router();

export default registerUser => {
  const controller = new RegistrationController(registerUser);

  // Routes
  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  router.post('/register', controller.register.bind(controller));

  return router;
};
