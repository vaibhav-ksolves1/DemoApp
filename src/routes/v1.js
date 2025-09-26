import express from 'express';
import { endpoints } from '../shared/constants/endpoints.js';
import logger from '../shared/logger/index.js';

// import route handlers
import healthRoutes from './health.js';
import registrationRoutes from './registration.js';

const v1Router = express.Router();

v1Router.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.originalUrl}`); // logs method and URL
  next();
});
// Health check
v1Router.use(endpoints.HEALTH, healthRoutes);

// Registration
v1Router.use(endpoints.REGISTRATION, registrationRoutes);

export default v1Router;
