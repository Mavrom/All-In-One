import type { EmbedBuilder } from 'discord.js';
import type { PunishmentRecord, PunishmentType } from '#models/Punishment.js';
import { embed } from './embed.js';
import { truncate } from './text.js';

/** Ceza türlerinin kullanıcıya görünen Türkçe adları. */
export const PUNISHMENT_LABELS: Record<PunishmentType, string> = {
  ban: 'Ban',
  kick: 'Kick',
  mute: 'Mute',
  chatmute: 'Chat Mute',
  voicemute: 'Voice Mute',
  jail: 'Jail',
  warn: 'Uyarı',
};

/**
 * Bir ceza kaydının kullanıcıya görünen durum etiketini döner: iptal edilmişse
 * "İptal edildi"; kick türü durumundan bağımsız "Tamamlandı"; süresi dolmuşsa
 * "Süresi doldu"; aksi halde "Aktif".
 */
export function statusLabel(record: PunishmentRecord): string {
  if (record.status === 'revoked') return 'İptal edildi';
  if (record.type === 'kick') return 'Tamamlandı';
  if (record.status === 'expired') return 'Süresi doldu';
  return 'Aktif';
}

/**
 * Sicil/liste görünümlerinde kullanılan tek satırlık ceza özeti üretir:
 * `` `#152` • Ban • <t:UNIX:d> • Aktif — Sebep ``. İptal edilmiş kayıtlarda satırın
 * tamamı üstü çizili (`~~ ~~`) gösterilir; sebep en fazla 60 karaktere kesilir.
 */
export function punishmentLine(record: PunishmentRecord): string {
  const unix = Math.floor(record.createdAt.getTime() / 1000);
  const reason = truncate(record.reason, 60);
  const line =
    `\`#${record.caseId}\` • ${PUNISHMENT_LABELS[record.type]} • <t:${unix}:d> • ` +
    `${statusLabel(record)} — ${reason}`;

  return record.status === 'revoked' ? `~~${line}~~` : line;
}

/**
 * Bir ceza kaydı için ayrıntılı embed üretir (`sicil`, `case`, `ceza-log` gibi yerlerde
 * kullanılır): kullanıcı, yetkili, sebep, süreli ise bitiş, durum, Discord kaynaklıysa
 * kaynak notu ve iptal edilmişse iptal bilgisi.
 */
export function punishmentEmbed(record: PunishmentRecord, title: string): EmbedBuilder {
  const fields: { name: string; value: string }[] = [
    { name: 'Kullanıcı', value: `<@${record.userId}> (${record.userId})` },
    { name: 'Yetkili', value: `<@${record.staffId}>` },
    { name: 'Sebep', value: record.reason },
  ];

  if (record.expiresAt) {
    const unix = Math.floor(record.expiresAt.getTime() / 1000);
    fields.push({ name: 'Bitiş', value: `<t:${unix}:f> (<t:${unix}:R>)` });
  }

  fields.push({ name: 'Durum', value: statusLabel(record) });

  if (record.source === 'discord') {
    fields.push({ name: 'Kaynak', value: 'Discord (sağ tık)' });
  }

  if (record.revoked) {
    const unix = Math.floor(record.revoked.at.getTime() / 1000);
    fields.push({
      name: 'İptal',
      value: `<@${record.revoked.by}> • <t:${unix}:f> • ${record.revoked.reason}`,
    });
  }

  return embed('punish')
    .setTitle(title)
    .addFields(fields)
    .setFooter({ text: `Ceza #${record.caseId}` });
}
