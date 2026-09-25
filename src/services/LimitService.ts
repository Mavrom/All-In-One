import type { PunishmentType } from '#models/Punishment.js';
import { Punishment } from '#models/Punishment.js';

/** Saatlik ceza limitine tabi ceza türleri. */
export type LimitedType = 'ban' | 'kick' | 'jail';

/** Limitle sınırlı ceza türlerinin listesi. */
export const LIMITED_TYPES: readonly LimitedType[] = ['ban', 'kick', 'jail'];

/**
 * Bir yetkilinin, `windowMs` kayan penceresi içinde o guild'de o türde uyguladığı ceza
 * sayısını döner. Kayıt durumundan bağımsız tüm kayıtlar sayılır — iptal edilmiş (`revoked`)
 * kayıtlar dahil — kötüye kullanımı (verip hemen iptal etmeyi) önlemek içindir.
 */
export async function countRecent(input: {
  guildId: string;
  staffId: string;
  type: PunishmentType;
  windowMs: number;
  now?: Date;
}): Promise<number> {
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - input.windowMs);

  return Punishment.countDocuments({
    guildId: input.guildId,
    staffId: input.staffId,
    type: input.type,
    createdAt: { $gte: since },
  });
}

/**
 * `max` sınırına göre yeni ceza(lar)ın (`incoming`, varsayılan 1) uygulanıp
 * uygulanamayacağını denetler. `max === 0` limitsiz demektir ve her zaman izin verilir.
 */
export async function checkLimit(input: {
  guildId: string;
  staffId: string;
  type: PunishmentType;
  max: number;
  windowMs: number;
  incoming?: number;
  now?: Date;
}): Promise<{ allowed: boolean; used: number; max: number }> {
  const { guildId, staffId, type, max, windowMs, now } = input;
  const incoming = input.incoming ?? 1;
  const used = await countRecent({ guildId, staffId, type, windowMs, now });

  if (max === 0) {
    return { allowed: true, used, max };
  }

  return { allowed: used + incoming <= max, used, max };
}
