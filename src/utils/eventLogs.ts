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

/** Bu süreden yeni hesaplar üye logunda uyarıyla işaretlenir (7 gün). */
export const NEW_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000;

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** `üye-log` için sunucuya katılma embed'i; yeni hesaplar işaretlenir. */
export function memberJoinEmbed(
  input: { userId: string; tag: string; createdAt: Date; memberCount: number },
  now: Date = new Date(),
): EmbedBuilder {
  const isNew = now.getTime() - input.createdAt.getTime() < NEW_ACCOUNT_MS;
  const created = unixSeconds(input.createdAt);
  return embed(isNew ? 'warning' : 'success')
    .setTitle('Üye katıldı')
    .addFields(
      { name: 'Üye', value: `<@${input.userId}> (${input.tag})` },
      {
        name: 'Hesap oluşturma',
        value: `<t:${created}:f> (<t:${created}:R>)${isNew ? '\n⚠️ Yeni hesap' : ''}`,
      },
      { name: 'Üye sayısı', value: String(input.memberCount), inline: true },
    );
}

/** `üye-log` için sunucudan ayrılma embed'i: katılma zamanı ve sahip olduğu roller. */
export function memberLeaveEmbed(input: {
  userId: string;
  tag: string;
  joinedAt: Date | null;
  roleIds: string[];
}): EmbedBuilder {
  const joined = input.joinedAt ? `<t:${unixSeconds(input.joinedAt)}:R>` : 'Bilinmiyor';
  const roles = input.roleIds.length > 0 ? input.roleIds.map((id) => `<@&${id}>`).join(' ') : '—';
  return embed('error')
    .setTitle('Üye ayrıldı')
    .addFields(
      { name: 'Üye', value: `<@${input.userId}> (${input.tag})` },
      { name: 'Katılmıştı', value: joined, inline: true },
      { name: 'Roller', value: truncate(roles, 1024) },
    );
}

/** Bir üyenin loglamayla ilgili sunucu içi durumu. */
export interface MemberSnapshot {
  nickname: string | null;
  roleIds: string[];
}

/** İki üye durumu arasındaki takma ad ve rol değişikliklerini `üye-log` satırlarına çevirir. */
export function memberChangeLines(
  userId: string,
  before: MemberSnapshot,
  after: MemberSnapshot,
): string[] {
  const user = `<@${userId}>`;
  const lines: string[] = [];

  if (before.nickname !== after.nickname) {
    lines.push(`✏️ ${user} takma adı: ${before.nickname ?? '—'} → ${after.nickname ?? '—'}`);
  }

  const beforeRoles = new Set(before.roleIds);
  const afterRoles = new Set(after.roleIds);
  const added = after.roleIds.filter((id) => !beforeRoles.has(id));
  const removed = before.roleIds.filter((id) => !afterRoles.has(id));
  if (added.length > 0) {
    lines.push(`➕ ${user} rol verildi: ${added.map((id) => `<@&${id}>`).join(' ')}`);
  }
  if (removed.length > 0) {
    lines.push(`➖ ${user} rol alındı: ${removed.map((id) => `<@&${id}>`).join(' ')}`);
  }

  return lines;
}

/** Kullanıcı adı ve görünen ad değişikliklerini `üye-log` satırlarına çevirir. */
export function userChangeLines(
  userId: string,
  before: { username: string; globalName: string | null },
  after: { username: string; globalName: string | null },
): string[] {
  const user = `<@${userId}>`;
  const lines: string[] = [];
  if (before.username !== after.username) {
    lines.push(`🏷️ ${user} kullanıcı adı: ${before.username} → ${after.username}`);
  }
  if (before.globalName !== after.globalName) {
    lines.push(`🏷️ ${user} görünen ad: ${before.globalName ?? '—'} → ${after.globalName ?? '—'}`);
  }
  return lines;
}
