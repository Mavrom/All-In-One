import mongoose from 'mongoose';
import type { Logger } from 'pino';

/** Tüm botların paylaştığı MongoDB veritabanı adı. */
const DB_NAME = 'all-in-one';

/** Bağlantı dinleyicilerinin daha önce kaydedilip kaydedilmediğini izler (tekrar bağlanmalarda çoğalmasınlar diye). */
let listenersRegistered = false;

/**
 * `uri` adresindeki MongoDB'ye bağlanır. Bağlanma, kopma ve hata olaylarını `logger` ile
 * kaydeder; süreci sonlandırmaz (`process.exit` çağırmaz). Dinleyiciler yalnızca ilk çağrıda
 * kaydedilir; böylece test ortamında (vitest watch) tekrarlanan çağrılar dinleyicileri
 * çoğaltmaz.
 */
export async function connectDatabase(uri: string, logger: Logger): Promise<void> {
  if (!listenersRegistered) {
    mongoose.connection.on('connected', () => {
      logger.info('Veritabanına bağlanıldı');
    });
    mongoose.connection.on('disconnected', () => {
      logger.warn('Veritabanı bağlantısı kesildi');
    });
    mongoose.connection.on('error', (error: unknown) => {
      logger.error({ err: error }, 'Veritabanı bağlantı hatası');
    });
    listenersRegistered = true;
  }

  await mongoose.connect(uri, { dbName: DB_NAME });
}

/** Veritabanı bağlantısını kapatır. */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
