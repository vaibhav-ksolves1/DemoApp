import dotenv from 'dotenv';
dotenv.config();

import App from './App.js';
import { config } from './shared/configs/index.js';

const application = new App({ port: config.app.port });
application.start();
