import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { ConfigError } from './errors.js';

/** Config dosyalarının bulunduğu klasör (`<proje kökü>/config`). */
export const CONFIG_DIR = path.resolve(process.cwd(), 'config');

/** Discord snowflake kimliği (17-20 haneli sayı). */
export const snowflake: z.ZodString = z.string().regex(/^\d{17,20}$/, 'geçerli bir kimlik değil');

/** Boş string'i `null`'a çeviren, dolu ise snowflake doğrulaması yapan alan. */
const optionalSnowflake = z
  .union([z.literal(''), snowflake])
  .transform((value) => (value === '' ? null : value));

const developerIdsSchema = z
  .string()
  .optional()
  .default('')
  .transform((value, ctx) => {
    const ids = value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    for (const id of ids) {
      if (!snowflake.safeParse(id).success) {
        ctx.addIssue({
          code: 'custom',
          message: `DEVELOPER_IDS içindeki "${id}" geçerli bir kimlik değil`,
        });
        return z.NEVER;
      }
    }

    return ids;
  });

/** `.env` dosyasındaki ortak değişkenlerin şeması (`token` hariç, ayrıca okunur). */
export const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI zorunludur'),
  DEVELOPER_IDS: developerIdsSchema,
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().min(1).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/** `config/genel.json` şeması; tüm botların ortak kullandığı sunucu ve yetki rolü ayarları. */
export const genelSchema = z.object({
  sunucuId: snowflake,
  yetkiRolleri: z.object({
    dusuk: optionalSnowflake,
    orta: optionalSnowflake,
    yuksek: optionalSnowflake,
  }),
});

export type GenelConfig = z.infer<typeof genelSchema>;

/**
 * `.env` değişkenlerini doğrular. `tokenKey` verilirse o değişkeni `token` olarak okur
 * ve eksik/boşsa `ConfigError` fırlatır; verilmezse dönen değerde `token` alanı bulunmaz.
 */
export function loadEnv(source?: NodeJS.ProcessEnv): Env;
export function loadEnv(
  source: NodeJS.ProcessEnv | undefined,
  tokenKey: string,
): Env & { token: string };
export function loadEnv(
  source: NodeJS.ProcessEnv = process.env,
  tokenKey?: string,
): Env & { token?: string } {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new ConfigError(`.env geçersiz:\n${z.prettifyError(result.error)}`);
  }

  if (tokenKey === undefined) {
    return result.data;
  }

  const token = source[tokenKey];
  if (token === undefined || token.length === 0) {
    throw new ConfigError(`.env geçersiz: ${tokenKey} zorunludur`);
  }

  return { ...result.data, token };
}

/**
 * `file` yolundaki (mutlak değilse `CONFIG_DIR`'a göre) JSON dosyasını okuyup `schema` ile
 * doğrular. Dosya yoksa, JSON geçersizse veya şemaya uymuyorsa dosya adını içeren `ConfigError`
 * fırlatır.
 */
export function loadJsonConfig<S extends z.ZodType>(file: string, schema: S): z.infer<S> {
  const filePath = path.isAbsolute(file) ? file : path.join(CONFIG_DIR, file);
  const displayName = path.isAbsolute(file) ? file : `config/${file}`;

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new ConfigError(`${displayName} bulunamadı`);
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`${displayName} okunamadı: ${reason}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`${displayName} geçersiz JSON: ${reason}`);
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new ConfigError(`${displayName} geçersiz:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
