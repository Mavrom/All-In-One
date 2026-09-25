import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { connectDatabase, disconnectDatabase } from './database.js';
import { createLogger } from './logger.js';

/**
 * Testler için bellek içi bir MongoDB sunucusu kurar ve bağlanır (`beforeAll`), her testten
 * sonra tüm koleksiyonları temizler (`afterEach`), sonunda bağlantıyı ve sunucuyu kapatır
 * (`afterAll`). Çağıran test dosyasının en üst seviyesinde bir kez çağrılmalıdır.
 */
export function useTestDatabase(): void {
  let server: MongoMemoryServer;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    const logger = createLogger('test', { NODE_ENV: 'test', LOG_LEVEL: 'silent' });
    await connectDatabase(server.getUri(), logger);
  });

  afterEach(async () => {
    for (const collection of Object.values(mongoose.connection.collections)) {
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
    await server.stop();
  });
}
