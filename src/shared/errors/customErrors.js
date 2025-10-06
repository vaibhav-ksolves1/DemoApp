export class AuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = 401;
  }
}

export class ClientError extends Error {
  constructor(message = 'Bad request') {
    super(message);
    this.name = 'ClientError';
    this.statusCode = 400;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ServerError extends Error {
  constructor(message = 'Internal server error') {
    console.log('q');
    super(message);
    this.name = 'ServerError';
    this.statusCode = 500;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SQLError extends Error {
  constructor(message = 'Database error') {
    super(message);
    this.name = 'SQLError';
    this.statusCode = 500;
    Error.captureStackTrace(this, this.constructor);
  }
}
