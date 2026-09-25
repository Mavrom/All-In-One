import type { EmbedBuilder } from 'discord.js';
import type { CommandRunInfo } from '#core/types.js';
import type { LogService } from '#services/LogService.js';
import type { PunishmentEvent } from '#services/PunishmentService.js';
import { formatDuration } from '#utils/duration.js';
import { embed } from '#utils/embed.js';
import { PUNISHMENT_LABELS, punishmentEmbed, punishmentLine } from '#utils/punishment.js';
import { truncate } from '#utils/text.js';

const MAX_ARGS_LENGTH = 1000;

function buildPunishmentEmbed(event: PunishmentEvent): EmbedBuilder {
  switch (event.kind) {
    case 'punish':
      return punishmentEmbed(event.record, `${PUNISHMENT_LABELS[event.record.type]} verildi`);
    case 'revoke':
      return punishmentEmbed(event.record, `${PUNISHMENT_LABELS[event.record.type]} kaldırıldı`);
    case 'expire':
      return punishmentEmbed(event.record, `${PUNISHMENT_LABELS[event.record.type]} süresi doldu`);
    case 'clear':
      return embed('warning')
        .setTitle('Sicil temizlendi')
        .setDescription(
          `<@${event.userId}> kullanıcısının ${event.count} kaydı <@${event.staffId}> ` +
            `tarafından iptal edildi.\nSebep: ${event.reason}`,
        );
    case 'limit':
      return embed('error')
        .setTitle('Limit aşıldı')
        .setDescription(
          `<@${event.staffId}> ${formatDuration(event.windowMs)} içindeki ` +
            `${PUNISHMENT_LABELS[event.type]} limitine ulaştı (${event.used}/${event.max}).`,
        );
    case 'evade':
      return embed('warning')
        .setTitle('Cezadan kaçma girişimi')
        .setDescription(
          `<@${event.record.userId}> sunucuya tekrar girdi, cezası yeniden uygulandı.\n` +
            punishmentLine(event.record),
        );
  }
}

/**
 * Bir `PunishmentService` olayını `ceza-log` kanalına yazar. Olay türüne göre farklı bir embed
 * biçimi kullanılır (bkz. Task 13 kontrolcü kararları); gönderim `LogService.send` üzerinden
 * yapılır ve bu yüzden asla hata fırlatmaz.
 */
export async function logPunishmentEvent(
  logs: Pick<LogService, 'send'>,
  event: PunishmentEvent,
): Promise<void> {
  await logs.send('cezaLog', { embeds: [buildPunishmentEmbed(event)] });
}

function formatArgs(args: Record<string, unknown>): string {
  const lines = Object.entries(args)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);

  if (lines.length === 0) return '—';
  return truncate(lines.join('\n'), MAX_ARGS_LENGTH);
}

/**
 * Bir komut çalıştırma bilgisini `komut-log` kanalı için embed'e çevirir: başlık `/komut` veya
 * `.komut` (alt komut varsa eklenir), Kullanan/Kanal/Argümanlar alanları ve komut başarısız
 * olduysa bir Hata alanı.
 */
export function commandLogEmbed(info: CommandRunInfo): EmbedBuilder {
  const prefix = info.isSlash ? '/' : '.';
  const title =
    info.sub !== undefined ? `${prefix}${info.command} ${info.sub}` : `${prefix}${info.command}`;

  const result = embed(info.success ? 'info' : 'error')
    .setTitle(title)
    .addFields(
      { name: 'Kullanan', value: `<@${info.userId}>` },
      { name: 'Kanal', value: `<#${info.channelId}>` },
      { name: 'Argümanlar', value: formatArgs(info.args) },
    );

  if (!info.success) {
    result.addFields({ name: 'Hata', value: info.error ?? 'Bilinmeyen hata' });
  }

  return result;
}
