// src/logger.ts

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger, format, transports } from 'winston';

const logDirectory = process.env.LOG_DIR ?? 'logs';

if (!existsSync(logDirectory)) {
  mkdirSync(logDirectory, { recursive: true });
}

const logLevel = process.env.LOG_LEVEL ?? 'info';

export const logger = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...rest }) => {
          const restString = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
          return `${timestamp as string} [${level}]: ${message}${restString}`;
        })
      )
    }),
    new transports.File({ filename: join(logDirectory, 'bot.log') })
  ],
  exceptionHandlers: [
    new transports.File({ filename: join(logDirectory, 'exceptions.log') })
  ]
});








