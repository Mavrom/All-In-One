import { AuditLogEvent } from 'discord.js';
import { describe, expect, it } from 'vitest';
import {
  auditAction,
  messageDeleteEmbed,
  messageUpdateEmbed,
  type VoiceSnapshot,
  voiceChangeLines,
} from './eventLogs.js';

const idle: VoiceSnapshot = { channelId: null, serverMute: false, serverDeaf: false };
const inA: VoiceSnapshot = { channelId: 'A', serverMute: false, serverDeaf: false };

describe('voiceChangeLines', () => {
  it('giriş, çıkış ve taşınmayı yazar', () => {
    expect(voiceChangeLines('u', idle, inA)).toEqual(['🔊 <@u> <#A> kanalına girdi']);
    expect(voiceChangeLines('u', inA, idle)).toEqual(['🔇 <@u> <#A> kanalından çıktı']);
    expect(voiceChangeLines('u', inA, { ...inA, channelId: 'B' })).toEqual(['🔁 <@u> <#A> → <#B>']);
  });

  it('sunucu susturma ve sağırlaştırma değişikliklerini yazar', () => {
    expect(voiceChangeLines('u', inA, { ...inA, serverMute: true, serverDeaf: true })).toEqual([
      '🔈 <@u> sunucu susturması açıldı',
      '🎧 <@u> sunucu sağırlaştırması açıldı',
    ]);
    expect(voiceChangeLines('u', { ...inA, serverMute: true }, inA)).toEqual([
      '🔈 <@u> sunucu susturması kapatıldı',
    ]);
  });

  it('değişiklik yoksa boş döner', () => {
    expect(voiceChangeLines('u', inA, inA)).toEqual([]);
  });
});

describe('messageDeleteEmbed', () => {
  it('içerik ve ekleri gösterir', () => {
    const json = messageDeleteEmbed({
      authorId: '1',
      authorTag: 'berk',
      channelId: 'C',
      content: 'merhaba',
      attachments: ['resim.png'],
    }).toJSON();
    expect(json.title).toBe('Mesaj silindi');
    expect(json.fields).toEqual([
      { name: 'Yazan', value: '<@1> (berk)', inline: true },
      { name: 'Kanal', value: '<#C>', inline: true },
      { name: 'İçerik', value: 'merhaba' },
      { name: 'Ekler', value: 'resim.png' },
    ]);
  });

  it('içerik yoksa ve yazan bilinmiyorsa bunu belirtir', () => {
    const json = messageDeleteEmbed({
      authorId: null,
      authorTag: null,
      channelId: 'C',
      content: null,
      attachments: [],
    }).toJSON();
    expect(json.fields?.[0]?.value).toBe('Bilinmiyor');
    expect(json.fields?.[2]?.value).toBe('İçerik alınamadı');
    expect(json.fields).toHaveLength(3);
  });
});

describe('messageUpdateEmbed', () => {
  it('eski ve yeni hali gösterir', () => {
    const json = messageUpdateEmbed({
      authorId: '1',
      authorTag: 'berk',
      channelId: 'C',
      url: 'https://discord.com/x',
      before: null,
      after: 'yeni',
    }).toJSON();
    expect(json.title).toBe('Mesaj düzenlendi');
    expect(json.fields?.map((f) => f.value)).toEqual([
      '<@1> (berk)',
      '<#C>',
      'İçerik alınamadı',
      'yeni',
      '[Mesaja git](https://discord.com/x)',
    ]);
  });
});

describe('auditAction', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('ban, unban ve kick olaylarını eşler', () => {
    expect(auditAction({ action: AuditLogEvent.MemberBanAdd, changes: [] })).toEqual({
      kind: 'punish',
      type: 'ban',
    });
    expect(auditAction({ action: AuditLogEvent.MemberBanRemove, changes: [] })).toEqual({
      kind: 'revoke',
      type: 'ban',
    });
    expect(auditAction({ action: AuditLogEvent.MemberKick, changes: [] })).toEqual({
      kind: 'punish',
      type: 'kick',
    });
  });

  it('timeout verilmesini ve kaldırılmasını eşler', () => {
    const until = '2026-01-01T01:00:00Z';
    expect(
      auditAction(
        {
          action: AuditLogEvent.MemberUpdate,
          changes: [{ key: 'communication_disabled_until', new: until }],
        },
        now,
      ),
    ).toEqual({ kind: 'punish', type: 'mute', durationMs: 3_600_000 });
    expect(
      auditAction(
        {
          action: AuditLogEvent.MemberUpdate,
          changes: [{ key: 'communication_disabled_until', old: until }],
        },
        now,
      ),
    ).toEqual({ kind: 'revoke', type: 'mute' });
  });

  it('ilgisiz olaylarda null döner', () => {
    expect(
      auditAction({ action: AuditLogEvent.MemberUpdate, changes: [{ key: 'nick', new: 'x' }] }),
    ).toBeNull();
    expect(auditAction({ action: AuditLogEvent.ChannelCreate, changes: [] })).toBeNull();
  });
});
