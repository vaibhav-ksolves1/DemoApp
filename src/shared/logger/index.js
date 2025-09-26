import winston from 'winston';

const logger = winston.createLogger({
  level: 'info', // default log level
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(), // logs to console
    new winston.transports.File({ filename: 'logs/app.log' }), // logs to file
  ],
});

// If not in production, also log stack traces for debugging
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({ format: winston.format.simple() })
  );
}

export default logger;
