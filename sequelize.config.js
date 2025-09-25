// sequelize.config.js
import dotenv from 'dotenv';

dotenv.config();

export default {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'postgres',
    modelsPath: 'src/infrastructure/db/models',
  },

  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_PROD_NAME,
    host: process.env.DB_HOST,
    dialect: 'postgres',
    modelsPath: 'src/infrastructure/db/models',
  },
};
