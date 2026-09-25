import type { EmbedBuilder, User } from 'discord.js';
import type { PunishmentRecord } from '#models/Punishment.js';
import { embed } from '#utils/embed.js';
import { PUNISHMENT_LABELS } from '#utils/punishment.js';

/** Genel amaçlı başarı embed'i (✅ önekli açıklama). */
export function success(text: string): EmbedBuilder {
  return embed('success').setDescription(`✅ ${text}`);
}

/** Bir ceza verildiğinde kullanıcıya gösterilecek embed: özet, sebep ve (varsa) bitiş. */
export function punishmentDone(record: PunishmentRecord, user: User): EmbedBuilder {
  const label = PUNISHMENT_LABELS[record.type];
  const result = success(
    `**${user.tag}** kullanıcısına **${label}** cezası verildi. (#${record.caseId})`,
  ).addFields({ name: 'Sebep', value: record.reason });

  if (record.expiresAt) {
    const unix = Math.floor(record.expiresAt.getTime() / 1000);
    result.addFields({ name: 'Bitiş', value: `<t:${unix}:R>` });
  }

  return result;
}

/** Bir ceza kaldırıldığında kullanıcıya gösterilecek embed. */
export function revokeDone(record: PunishmentRecord, user: User): EmbedBuilder {
  const label = PUNISHMENT_LABELS[record.type];
  return success(
    `**${user.tag}** kullanıcısının **${label}** cezası kaldırıldı. (#${record.caseId})`,
  );
}
