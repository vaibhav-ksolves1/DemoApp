// src/shared/constants/messages.js

export const messages = {
  APP: {
    SUCCESS: 'success',
    ERROR: 'error',
    SERVER_ERROR: 'Something went wrong on the server',
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Unauthorized access',
    BAD_REQUEST: 'Invalid request parameters',
    CONFLICT: 'Resource already exists',
  },

  DB: {
    CONNECTION_FAILED: 'Database connection failed',
    QUERY_ERROR: 'Database query error',
  },

  EMAIL: {
    SENT: 'Email sent successfully',
    FAILED: 'Failed to send email',
  },

  ERROR: {
    INTERNAL_SERVER_ERROR: 'Internal server error',
    VALIDATION_ERROR: 'Validation error',
    AUTHENTICATION_ERROR: 'Authentication error',
    AUTHORIZATION_ERROR: 'Authorization error',
    RESOURCE_NOT_FOUND: 'Resource not found',
    DUPLICATE_ENTRY: 'Duplicate entry detected',
  },
};
