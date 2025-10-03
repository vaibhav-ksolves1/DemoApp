import winston from 'winston';

const { combine, timestamp, colorize, printf, errors } = winston.format;

// Custom log format
const logFormat = printf(({ timestamp, level, message, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `[${timestamp}] ${level}: ${stack || message} ${metaString}`;
});

const createLevelTransport = (level, filename) =>
  new winston.transports.File({
    level,
    filename,
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  });

const logger = winston.createLogger({
  level: 'debug', // minimum log level
  format: combine(errors({ stack: true }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    createLevelTransport('info', 'logs/info.log'),
    createLevelTransport('warn', 'logs/warn.log'),
    createLevelTransport('debug', 'logs/debug.log'),
    createLevelTransport('error', 'logs/error.log'),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

export default logger;
