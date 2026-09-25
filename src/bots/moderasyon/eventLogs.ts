import { AuditLogEvent, type EmbedBuilder } from 'discord.js';
import { embed } from '#utils/embed.js';
import { truncate } from '#utils/text.js';

/** Bir üyenin ses durumunun loglamayla ilgili kısmı. */
export interface VoiceSnapshot {
  channelId: string | null;
  serverMute: boolean;
  serverDeaf: boolean;
}

/** İki ses durumu arasındaki değişiklikleri `ses-log` satırlarına çevirir. */
export function voiceChangeLines(
  userId: string,
  before: VoiceSnapshot,
  after: VoiceSnapshot,
): string[] {
  const user = `<@${userId}>`;
  const lines: string[] = [];

  if (before.channelId !== after.channelId) {
    if (!before.channelId && after.channelId) {
      lines.push(`🔊 ${user} <#${after.channelId}> kanalına girdi`);
    } else if (before.channelId && !after.channelId) {
      lines.push(`🔇 ${user} <#${before.channelId}> kanalından çıktı`);
    } else {
      lines.push(`🔁 ${user} <#${before.channelId}> → <#${after.channelId}>`);
    }
  }

  // Kanaldan çıkarken susturma bilgisi sıfırlanır; bunu ayrı bir değişiklik olarak yazma.
  if (after.channelId) {
    if (before.serverMute !== after.serverMute) {
      lines.push(`🔈 ${user} sunucu susturması ${after.serverMute ? 'açıldı' : 'kapatıldı'}`);
    }
    if (before.serverDeaf !== after.serverDeaf) {
      lines.push(`🎧 ${user} sunucu sağırlaştırması ${after.serverDeaf ? 'açıldı' : 'kapatıldı'}`);
    }
  }

  return lines;
}

function authorField(authorId: string | null, authorTag: string | null): string {
  return authorId ? `<@${authorId}> (${authorTag ?? authorId})` : 'Bilinmiyor';
}

function contentOrMissing(content: string | null): string {
  return content ? truncate(content, 1024) : 'İçerik alınamadı';
}

/** `mesaj-log` için silinen mesaj embed'i. */
export function messageDeleteEmbed(input: {
  authorId: string | null;
  authorTag: string | null;
  channelId: string;
  content: string | null;
  attachments: string[];
}): EmbedBuilder {
  const result = embed('error')
    .setTitle('Mesaj silindi')
    .addFields(
      { name: 'Yazan', value: authorField(input.authorId, input.authorTag), inline: true },
      { name: 'Kanal', value: `<#${input.channelId}>`, inline: true },
      { name: 'İçerik', value: contentOrMissing(input.content) },
    );
  if (input.attachments.length > 0) {
    result.addFields({ name: 'Ekler', value: truncate(input.attachments.join('\n'), 1024) });
  }
  return result;
}

/** `mesaj-log` için düzenlenen mesaj embed'i. */
export function messageUpdateEmbed(input: {
  authorId: string;
  authorTag: string;
  channelId: string;
  url: string;
  before: string | null;
  after: string;
}): EmbedBuilder {
  return embed('warning')
    .setTitle('Mesaj düzenlendi')
    .addFields(
      { name: 'Yazan', value: authorField(input.authorId, input.authorTag), inline: true },
      { name: 'Kanal', value: `<#${input.channelId}>`, inline: true },
      { name: 'Eski', value: contentOrMissing(input.before) },
      { name: 'Yeni', value: contentOrMissing(input.after) },
      { name: 'Bağlantı', value: `[Mesaja git](${input.url})` },
    );
}

/** Audit log kaydının ceza sistemine karşılığı. */
export type AuditAction =
  | { kind: 'punish'; type: 'ban' | 'kick' | 'mute'; durationMs?: number }
  | { kind: 'revoke'; type: 'ban' | 'mute' }
  | null;

/** Discord arayüzünden yapılan ban/kick/timeout işlemlerini ceza aksiyonuna çevirir. */
export function auditAction(
  entry: {
    action: AuditLogEvent;
    changes: ReadonlyArray<{ key: string; old?: unknown; new?: unknown }>;
  },
  now: Date = new Date(),
): AuditAction {
  switch (entry.action) {
    case AuditLogEvent.MemberBanAdd:
      return { kind: 'punish', type: 'ban' };
    case AuditLogEvent.MemberBanRemove:
      return { kind: 'revoke', type: 'ban' };
    case AuditLogEvent.MemberKick:
      return { kind: 'punish', type: 'kick' };
    case AuditLogEvent.MemberUpdate: {
      const change = entry.changes.find((c) => c.key === 'communication_disabled_until');
      if (!change) return null;
      const until = typeof change.new === 'string' ? Date.parse(change.new) : Number.NaN;
      if (!Number.isNaN(until) && until > now.getTime()) {
        return { kind: 'punish', type: 'mute', durationMs: until - now.getTime() };
      }
      return { kind: 'revoke', type: 'mute' };
    }
    default:
      return null;
  }
}
