import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${stack ?? message}${metaStr}`;
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: combine(
      colorize({ all: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      logFormat,
    ),
    silent: env.NODE_ENV === 'test',
  }),
];

if (env.NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'nexus-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
    }),
    new DailyRotateFile({
      dirname: path.join(process.cwd(), 'logs'),
      filename: 'nexus-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
    }),
  );
}

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports,
});
