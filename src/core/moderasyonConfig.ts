import { z } from 'zod';
import { parseDuration } from '#utils/duration.js';
import { trLower } from '#utils/text.js';

/**
 * `config/moderasyon.json` şeması: prefix, saatlik ceza limitleri (kayan pencere) ve komut
 * bazlı kademe geçersiz kılmaları (`kademeler`, kod varsayılanı `{}`).
 */
export const moderasyonSchema = z.object({
  prefix: z.string().min(1).max(5),
  limitler: z.object({
    pencere: z.string().refine((v) => parseDuration(v) !== null, 'Geçersiz süre (örn. 1sa)'),
    ban: z.number().int().min(0),
    kick: z.number().int().min(0),
    jail: z.number().int().min(0),
  }),
  kademeler: z.record(z.string(), z.union([z.literal(1), z.literal(2), z.literal(3)])).default({}),
});

export type ModerasyonConfig = z.infer<typeof moderasyonSchema>;

/**
 * `moderasyon` botunun `Settings` kapsamı için kod varsayılanlarını üretir: prefix, limit
 * ayarları (`limit.pencere`, `limit.ban`, `limit.kick`, `limit.jail`), otorol rolleri
 * (`otorol.uye`, `otorol.bot`; `.otorol` ile ayarlanır) ve `kademeler`
 * haritasındaki her komut için Türkçe küçük harfli bir `kademe.<komut>` anahtarı.
 */
export function botDefaults(cfg: ModerasyonConfig): Record<string, unknown> {
  const defaults: Record<string, unknown> = {
    prefix: cfg.prefix,
    'limit.pencere': cfg.limitler.pencere,
    'limit.ban': cfg.limitler.ban,
    'limit.kick': cfg.limitler.kick,
    'limit.jail': cfg.limitler.jail,
    'otorol.uye': null,
    'otorol.bot': null,
  };

  for (const [command, level] of Object.entries(cfg.kademeler)) {
    defaults[`kademe.${trLower(command)}`] = level;
  }

  return defaults;
}
