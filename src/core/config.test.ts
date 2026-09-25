import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { genelSchema, loadEnv, loadJsonConfig, snowflake } from './config.js';
import { ConfigError } from './errors.js';

describe('snowflake', () => {
  it('17-20 haneli sayıları kabul eder', () => {
    expect(snowflake.safeParse('123456789012345678').success).toBe(true);
    expect(snowflake.safeParse('12345678901234567').success).toBe(true);
  });

  it('kısa, uzun veya sayı olmayan değerleri reddeder', () => {
    expect(snowflake.safeParse('1234567890123456').success).toBe(false);
    expect(snowflake.safeParse('123456789012345678901').success).toBe(false);
    expect(snowflake.safeParse('abc').success).toBe(false);
    expect(snowflake.safeParse('').success).toBe(false);
  });
});

describe('loadEnv', () => {
  const validSource = {
    MONGODB_URI: 'mongodb://localhost:27017/test',
    DEVELOPER_IDS: '123456789012345678, 234567890123456789,, ',
    NODE_ENV: 'production',
    LOG_LEVEL: 'debug',
    MODERASYON_TOKEN: 'gercek-token',
  };

  it('geçerli env üzerinden token okur ve DEVELOPER_IDS listesini ayrıştırır', () => {
    const env = loadEnv(validSource, 'MODERASYON_TOKEN');
    expect(env.MONGODB_URI).toBe('mongodb://localhost:27017/test');
    expect(env.DEVELOPER_IDS).toEqual(['123456789012345678', '234567890123456789']);
    expect(env.NODE_ENV).toBe('production');
    expect(env.LOG_LEVEL).toBe('debug');
    expect(env.token).toBe('gercek-token');
  });

  it('tokenKey verilmeden çağrıldığında token okumaya çalışmaz', () => {
    const env = loadEnv(validSource);
    expect(env).not.toHaveProperty('token');
  });

  it('tokenKey verildiğinde dönen tipte token zorunlu alan olarak yer alır', () => {
    const env = loadEnv(validSource, 'MODERASYON_TOKEN');
    // Derleme zamanı kontrolü: token burada `string`, `string | undefined` değil.
    const token: string = env.token;
    expect(token).toBe('gercek-token');
  });

  it('tokenKey verilmiş ama değişken eksikse ConfigError fırlatır', () => {
    const { MODERASYON_TOKEN, ...rest } = validSource;
    expect(() => loadEnv(rest, 'MODERASYON_TOKEN')).toThrow(ConfigError);
    expect(() => loadEnv(rest, 'MODERASYON_TOKEN')).toThrow(/\.env geçersiz/);
  });

  it('tokenKey verilmiş ama değişken boşsa ConfigError fırlatır', () => {
    expect(() => loadEnv({ ...validSource, MODERASYON_TOKEN: '' }, 'MODERASYON_TOKEN')).toThrow(
      ConfigError,
    );
  });

  it('NODE_ENV ve LOG_LEVEL varsayılan değerlere sahiptir', () => {
    const { NODE_ENV, LOG_LEVEL, ...rest } = validSource;
    const env = loadEnv(rest);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('MONGODB_URI eksikse ConfigError fırlatır ve .env adını içerir', () => {
    const { MONGODB_URI, ...rest } = validSource;
    try {
      loadEnv(rest);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toMatch(/^\.env geçersiz:/);
    }
  });

  it('DEVELOPER_IDS içinde geçersiz bir kimlik varsa ConfigError fırlatır', () => {
    expect(() => loadEnv({ ...validSource, DEVELOPER_IDS: 'abc' })).toThrow(ConfigError);
  });

  it('DEVELOPER_IDS boşsa boş dizi döner', () => {
    const { DEVELOPER_IDS, ...rest } = validSource;
    const env = loadEnv(rest);
    expect(env.DEVELOPER_IDS).toEqual([]);
  });
});

describe('loadJsonConfig', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'aio-config-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('geçerli JSON dosyasını şemaya göre ayrıştırır', () => {
    const file = path.join(dir, 'genel.json');
    writeFileSync(
      file,
      JSON.stringify({
        sunucuId: '123456789012345678',
        yetkiRolleri: { dusuk: '', orta: '234567890123456789', yuksek: '' },
      }),
    );

    const config = loadJsonConfig(file, genelSchema);
    expect(config).toEqual({
      sunucuId: '123456789012345678',
      yetkiRolleri: { dusuk: null, orta: '234567890123456789', yuksek: null },
    });
  });

  it('dosya yoksa ConfigError fırlatır ve dosya adını mesajda belirtir', () => {
    const file = path.join(dir, 'genel.json');
    try {
      loadJsonConfig(file, genelSchema);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toContain(file);
      expect((error as Error).message).toContain('bulunamadı');
    }
  });

  it('dosya yerine dizin verilirse ConfigError fırlatır ve "okunamadı" belirtir', () => {
    try {
      loadJsonConfig(dir, genelSchema);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toContain(dir);
      expect((error as Error).message).toContain('okunamadı');
    }
  });

  it('geçersiz JSON içeriğinde ConfigError fırlatır ve dosyayı belirtir', () => {
    const file = path.join(dir, 'moderasyon.json');
    writeFileSync(file, '{ geçersiz json');

    try {
      loadJsonConfig(file, genelSchema);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toContain(file);
    }
  });

  it('şema doğrulaması başarısız olursa ConfigError fırlatır ve dosyayı belirtir', () => {
    const file = path.join(dir, 'genel.json');
    writeFileSync(
      file,
      JSON.stringify({ sunucuId: '', yetkiRolleri: { dusuk: '', orta: '', yuksek: '' } }),
    );

    try {
      loadJsonConfig(file, genelSchema);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toContain(file);
      expect((error as Error).message).toContain('geçersiz:');
    }
  });
});

describe('genelSchema', () => {
  it('boş rol ID lerini null a çevirir', () => {
    const result = genelSchema.parse({
      sunucuId: '123456789012345678',
      yetkiRolleri: { dusuk: '', orta: '', yuksek: '' },
    });
    expect(result.yetkiRolleri).toEqual({ dusuk: null, orta: null, yuksek: null });
  });

  it('boş sunucuId reddedilir', () => {
    const result = genelSchema.safeParse({
      sunucuId: '',
      yetkiRolleri: { dusuk: '', orta: '', yuksek: '' },
    });
    expect(result.success).toBe(false);
  });
});
