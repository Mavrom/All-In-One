import path from 'node:path';
import type { Logger } from 'pino';
import pino from 'pino';
import type { Env } from './config.js';

export type { Logger } from 'pino';

/**
 * `name` (dosya/bot adı) için pino logger oluşturur: geliştirmede renkli, okunaklı konsol
 * çıktısı; yayında `logs/<name>.log` dosyasına yazar; testte sessizdir. Seviye `env.LOG_LEVEL`.
 */
export function createLogger(name: string, env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  if (env.NODE_ENV === 'test') {
    return pino({ name, level: 'silent' });
  }

  if (env.NODE_ENV === 'production') {
    return pino({
      name,
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino/file',
        options: {
          destination: path.join(process.cwd(), 'logs', `${name}.log`),
          mkdir: true,
        },
      },
    });
  }

  return pino({
    name,
    level: env.LOG_LEVEL,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  });
}
