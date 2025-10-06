// shared/utils/responseHandler.js
import { isEmpty } from 'lodash-es';
import { httpCodes, messages } from '../constants/index.js';

/**
 * Send a standardized success response
 * @param {Object} params
 * @param {import('express').Response} params.response - Express response object
 * @param {string} [params.responseMessage] - Optional success message
 * @param {any} [params.responseData] - Optional data to return
 * @param {number} [params.statusCode=httpCodes.OK] - HTTP status code
 * @param {number} [params.count] - Optional total count (for lists)
 */
export const sendSuccessResponse = ({
  response,
  responseMessage,
  responseData = null,
  statusCode = httpCodes.OK,
  count,
}) => {
  const json = {
    status: messages.APP.SUCCESS,
    message: responseMessage || messages.APP.SUCCESS_RESULT,
  };

  if (!isEmpty(responseData)) json.data = responseData;

  if (count !== undefined) json.count = count;

  return response.status(statusCode).json(json);
};

/**
 * Send a standardized error response
 * @param {Object} params
 * @param {import('express').Response} params.response - Express response object
 * @param {string} [params.errorMessage] - Optional error message
 * @param {number} [params.statusCode=httpCodes.INTERNAL_SERVER_ERROR] - HTTP status code
 */
export const sendErrorResponse = ({
  response,
  errorMessage,
  errorType = 'Error',
  statusCode = httpCodes.INTERNAL_SERVER_ERROR,
}) => {
  return response.status(statusCode).json({
    status: messages.APP.ERROR,
    type: errorType, // 🔑 New field
    message: errorMessage || messages.APP.SERVER_ERROR,
  });
};

export const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
