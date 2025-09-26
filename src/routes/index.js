import express from 'express';

import { endpoints } from '../shared/constants/endpoints.js';
import v1Router from './v1.js';

const router = express.Router();

router.use(endpoints.V1, v1Router);

export default router;
