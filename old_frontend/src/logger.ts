// logger.ts
import pino from 'pino';

// In dev, we can use `pino-pretty` for a more readable output
// In production, we might want JSON logs or a different transport
const logger = pino({
  // Only use pino-pretty locally
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }),
  // Optional: set minimum log level (default is 'info')
  level: 'trace'
});

export default logger;