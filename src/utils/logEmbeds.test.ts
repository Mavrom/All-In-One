import type { EmbedBuilder, MessageCreateOptions } from 'discord.js';
import { describe, expect, it } from 'vitest';
import type { CommandRunInfo } from '#core/types.js';
import type { PunishmentRecord } from '#models/Punishment.js';
import type { LogChannelKey } from '#services/LogService.js';
import { commandLogEmbed, logPunishmentEvent } from './logEmbeds.js';

function makeRecord(overrides?: Partial<PunishmentRecord>): PunishmentRecord {
  return {
    caseId: 42,
    guildId: 'g1',
    type: 'ban',
    userId: 'u1',
    staffId: 's1',
    reason: 'kurallara aykırı',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: null,
    status: 'active',
    revoked: null,
    source: 'command',
    savedRoles: [],
    ...overrides,
  };
}

class FakeLogService {
  sent: Array<{ key: LogChannelKey; payload: MessageCreateOptions }> = [];

  async send(key: LogChannelKey, payload: MessageCreateOptions): Promise<void> {
    this.sent.push({ key, payload });
  }
}

function firstEmbedJson(logs: FakeLogService) {
  const payload = logs.sent[0]?.payload;
  const first = payload?.embeds?.[0] as EmbedBuilder;
  return first.toJSON();
}

describe('commandLogEmbed', () => {
  it('slash komut için "/" öneki ile başlık üretir', () => {
    const info: CommandRunInfo = {
      command: 'ban',
      userId: 'u1',
      channelId: 'c1',
      args: { kullanici: 'u2', sebep: 'spam' },
      success: true,
      isSlash: true,
    };
    const json = commandLogEmbed(info).toJSON();
    expect(json.title).toBe('/ban');
  });

  it('prefix komut ve alt komut için "." öneki ve alt komut adıyla başlık üretir', () => {
    const info: CommandRunInfo = {
      command: 'ayar',
      sub: 'limit',
      userId: 'u1',
      channelId: 'c1',
      args: {},
      success: true,
      isSlash: false,
    };
    const json = commandLogEmbed(info).toJSON();
    expect(json.title).toBe('.ayar limit');
  });

  it('Kullanan ve Kanal alanlarını doğru biçimde doldurur', () => {
    const info: CommandRunInfo = {
      command: 'kick',
      userId: 'u1',
      channelId: 'c1',
      args: {},
      success: true,
      isSlash: true,
    };
    const json = commandLogEmbed(info).toJSON();
    expect(json.fields).toEqual(
      expect.arrayContaining([
        { name: 'Kullanan', value: '<@u1>' },
        { name: 'Kanal', value: '<#c1>' },
      ]),
    );
  });

  it('argümanları biçimlendirir: diziler virgülle birleştirilir, undefined atlanır', () => {
    const info: CommandRunInfo = {
      command: 'massban',
      userId: 'u1',
      channelId: 'c1',
      args: { kullanicilar: ['1', '2'], sebep: undefined, sure: 5000 },
      success: true,
      isSlash: true,
    };
    const json = commandLogEmbed(info).toJSON();
    const argsField = json.fields?.find((f) => f.name === 'Argümanlar');
    expect(argsField?.value).toBe('kullanicilar: 1, 2\nsure: 5000');
  });

  it('argüman yoksa Argümanlar alanında em-dash gösterir', () => {
    const info: CommandRunInfo = {
      command: 'banlist',
      userId: 'u1',
      channelId: 'c1',
      args: {},
      success: true,
      isSlash: true,
    };
    const json = commandLogEmbed(info).toJSON();
    const argsField = json.fields?.find((f) => f.name === 'Argümanlar');
    expect(argsField?.value).toBe('—');
  });

  it('başarısız komutlarda Hata alanı ekler', () => {
    const info: CommandRunInfo = {
      command: 'ban',
      userId: 'u1',
      channelId: 'c1',
      args: {},
      success: false,
      error: 'Kullanıcı bulunamadı.',
      isSlash: true,
    };
    const json = commandLogEmbed(info).toJSON();
    const errorField = json.fields?.find((f) => f.name === 'Hata');
    expect(errorField?.value).toBe('Kullanıcı bulunamadı.');
  });

  it('başarılı komutlarda Hata alanı eklemez', () => {
    const info: CommandRunInfo = {
      command: 'ban',
      userId: 'u1',
      channelId: 'c1',
      args: {},
      success: true,
      isSlash: true,
    };
    const json = commandLogEmbed(info).toJSON();
    expect(json.fields?.find((f) => f.name === 'Hata')).toBeUndefined();
  });
});

describe('logPunishmentEvent', () => {
  it('punish olayını cezaLog kanalına, "{label} verildi" başlığıyla gönderir', async () => {
    const logs = new FakeLogService();
    const record = makeRecord();
    await logPunishmentEvent(logs, { kind: 'punish', record });

    expect(logs.sent).toHaveLength(1);
    expect(logs.sent[0]?.key).toBe('cezaLog');
    expect(firstEmbedJson(logs).title).toBe('Ban verildi');
  });

  it('revoke olayında "{label} kaldırıldı" başlığı kullanır', async () => {
    const logs = new FakeLogService();
    await logPunishmentEvent(logs, { kind: 'revoke', record: makeRecord({ type: 'kick' }) });
    expect(firstEmbedJson(logs).title).toBe('Kick kaldırıldı');
  });

  it('expire olayında "{label} süresi doldu" başlığı kullanır', async () => {
    const logs = new FakeLogService();
    await logPunishmentEvent(logs, { kind: 'expire', record: makeRecord({ type: 'jail' }) });
    expect(firstEmbedJson(logs).title).toBe('Jail süresi doldu');
  });

  it('limit olayını Türkçe süre ve kullanım oranıyla gönderir', async () => {
    const logs = new FakeLogService();
    await logPunishmentEvent(logs, {
      kind: 'limit',
      staffId: 's1',
      type: 'ban',
      used: 10,
      max: 10,
      windowMs: 3_600_000,
    });

    expect(logs.sent[0]?.key).toBe('cezaLog');
    const json = firstEmbedJson(logs);
    expect(json.title).toBe('Limit aşıldı');
    expect(json.description).toBe('<@s1> 1 saat içindeki Ban limitine ulaştı (10/10).');
  });

  it('clear olayında kullanıcı, sayı, yetkili ve sebebi gösterir', async () => {
    const logs = new FakeLogService();
    await logPunishmentEvent(logs, {
      kind: 'clear',
      userId: 'u1',
      staffId: 's1',
      count: 3,
      reason: 'temiz sayfa',
    });

    const json = firstEmbedJson(logs);
    expect(json.title).toBe('Sicil temizlendi');
    expect(json.description).toBe(
      '<@u1> kullanıcısının 3 kaydı <@s1> tarafından iptal edildi.\nSebep: temiz sayfa',
    );
  });

  it('evade olayında cezanın yeniden uygulandığını belirtir', async () => {
    const logs = new FakeLogService();
    const record = makeRecord({ type: 'jail' });
    await logPunishmentEvent(logs, { kind: 'evade', record });

    const json = firstEmbedJson(logs);
    expect(json.title).toBe('Cezadan kaçma girişimi');
    expect(json.description).toContain('<@u1> sunucuya tekrar girdi, cezası yeniden uygulandı.');
  });
});
