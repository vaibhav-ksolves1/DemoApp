import winston from 'winston';
import fs from 'fs';

// ensure logs folder exists
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

const { combine, timestamp, colorize, printf, errors } = winston.format;

// Custom log format
const logFormat = printf(({ timestamp, level, message, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `[${timestamp}] ${level}: ${stack || message} ${metaString}`;
});

// reusable file transport for each level
const createLevelTransport = (level, filename) =>
  new winston.transports.File({
    level,
    filename,
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  });

const logger = winston.createLogger({
  level: 'debug', // capture all logs
  format: combine(errors({ stack: true }), logFormat),
  transports: [
    // Console transport for all levels
    new winston.transports.Console({
      level: 'debug', // log everything to console
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),

    // File transports for each level
    createLevelTransport('debug', 'logs/debug.log'),
    createLevelTransport('info', 'logs/info.log'),
    createLevelTransport('warn', 'logs/warn.log'),
    createLevelTransport('error', 'logs/error.log'),
  ],

  // Exception and rejection handlers log to both file and console
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
    new winston.transports.Console({ format: combine(colorize(), logFormat) }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
    new winston.transports.Console({ format: combine(colorize(), logFormat) }),
  ],
});

export default logger;
