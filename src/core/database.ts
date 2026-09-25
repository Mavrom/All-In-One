import mongoose from 'mongoose';
import type { Logger } from 'pino';

/** Tüm botların paylaştığı MongoDB veritabanı adı. */
const DB_NAME = 'all-in-one';

/**
 * `uri` adresindeki MongoDB'ye bağlanır. Bağlanma, kopma ve hata olaylarını `logger` ile
 * kaydeder; süreci sonlandırmaz (`process.exit` çağırmaz).
 */
export async function connectDatabase(uri: string, logger: Logger): Promise<void> {
  mongoose.connection.on('connected', () => {
    logger.info('Veritabanına bağlanıldı');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('Veritabanı bağlantısı kesildi');
  });
  mongoose.connection.on('error', (error: unknown) => {
    logger.error({ err: error }, 'Veritabanı bağlantı hatası');
  });

  await mongoose.connect(uri, { dbName: DB_NAME });
}

/** Veritabanı bağlantısını kapatır. */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
