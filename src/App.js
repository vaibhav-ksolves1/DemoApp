import express from 'express';
import routes from './routes/index.js';
import {errorMiddleware} from './shared/errors/index.js';
import logger from './shared/logger/index.js';
import { endpoints } from './shared/constants/index.js';

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
