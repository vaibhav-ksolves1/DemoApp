import { sendErrorResponse } from '../shared/utils/index.js';
import {
  AuthError,
  ClientError,
  ServerError,
  SQLError,
} from '../shared/errors/customErrors.js';
import { httpCodes, messages } from '../shared/constants/index.js';
export default function errorMiddleware(err, req, res, next) {
  let statusCode = httpCodes.INTERNAL_SERVER_ERROR;
  let message = messages.ERROR.INTERNAL_SERVER_ERROR;
  let errorType = 'ServerError';
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
    message = messages.ERROR.DUPLICATE_ENTRY;
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
