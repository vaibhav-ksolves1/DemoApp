import database from './database/database.cjs';

const app = { port: process.env.APP_PORT || 3000 };

export const config = {
  database,
  app,
};
