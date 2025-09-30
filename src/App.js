import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import routes from './routes/index.js';
import { errorMiddleware } from './shared/errors/index.js';
import logger from './shared/logger/index.js';
import { endpoints } from './shared/constants/index.js';

import './services/scheduler/trialReminder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class App {
  constructor({ port }) {
    this.port = port;
    this.app = express();
    this._configureMiddleware();
    this._configureRoutes();
    this._configureErrorHandling();
  }

  _configureMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Set EJS as view engine
    this.app.set('view engine', 'ejs');

    // Set views directory
    this.app.set('views', path.join(__dirname, 'shared/templates/email'));

    // Serve static files (icons, css, etc.)
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  _configureRoutes() {
    this.app.use(endpoints.ROOT, routes);
  }

  _configureErrorHandling() {
    this.app.use(errorMiddleware);
  }

  start() {
    this.app.listen(this.port, () => {
      logger.info(`Server running on  http://localhost:${this.port}`);
    });
  }
}
