// src/shared/constants/messages.js

export const messages = {
  APP: {
    SUCCESS: 'success',
    ERROR: 'error',
    SUCCESS_RESULT: 'Operation completed successfully',
    SERVER_ERROR: 'Something went wrong on the server',
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Unauthorized access',
    BAD_REQUEST: 'Invalid request parameters',
    CONFLICT: 'Resource already exists',
  },

  USER: {
    CREATED: 'User successfully created',
    UPDATED: 'User updated successfully',
    DELETED: 'User deleted successfully',
    NOT_FOUND: 'User not found',
  },

  REGISTRATION: {
    CREATED: 'Registration completed successfully',
    ALREADY_EXISTS: 'Email is already registered',
  },

  DB: {
    CONNECTION_FAILED: 'Database connection failed',
    QUERY_ERROR: 'Database query error',
  },

  EMAIL: {
    SENT: 'Email sent successfully',
    FAILED: 'Failed to send email',
  },
};
