import 'dotenv/config'; // loads .env automatically
import express from 'express';

import sequelize from '../../infrastructure/db/database.js';
import RegistrationRepositorySequelize from '../../infrastructure/repositories/RegistrationRepositorySequelize.js';
import TerraformService from '../../infrastructure/terraform/TerraformService.js';
import MailService from '../../infrastructure/mail/MailService.js';
import RegisterUser from '../../application/RegisterUser.js';
import routesFactory from './routes.js';

const app = express();
app.use(express.json());

// Initialize dependencies
const registrationRepo = new RegistrationRepositorySequelize();
const terraformService = new TerraformService();
const mailService = new MailService();

const registerUser = new RegisterUser(
  registrationRepo,
  terraformService,
  mailService
);

// Mount versioned routes
app.use('/api/v1', routesFactory(registerUser));

app.listen(process.env.PORT || 3000, () => console.log('Server running...'));
