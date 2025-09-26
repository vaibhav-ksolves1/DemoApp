import { sendErrorResponse } from '../shared/utils/index.js';
import {
  AuthError,
  ClientError,
  ServerError,
  SQLError,
} from '../shared/errors/customErrors.js';

export default function errorMiddleware(err, req, res, next) {
  let statusCode = 500;
  let message = 'Internal server error';
  let errorType = 'ServerError';

  console.log(err)
  if (
    err instanceof AuthError ||
    err instanceof ClientError ||
    err instanceof ServerError ||
    err instanceof SQLError
  ) {
    statusCode = err.statusCode;
    message = err.message;
    errorType = err.name;
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = 'Duplicate entry detected';
    errorType = 'SequelizeUniqueConstraintError';
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = err.errors.map(e => e.message).join(', ');
    errorType = 'SequelizeValidationError';
  }

  return sendErrorResponse({
    response: res,
    errorMessage: message,
    errorType,
    statusCode,
  });
}
