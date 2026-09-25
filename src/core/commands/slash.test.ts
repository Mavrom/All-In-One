import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  InteractionContextType,
} from 'discord.js';
import { describe, expect, it } from 'vitest';
import { arg } from './args.js';
import { defineCommand } from './define.js';
import { buildSlash, hashCommands, readSlashArgs, type SlashOptionReader } from './slash.js';

const banCommand = defineCommand({
  name: 'ban',
  description: 'Kullanıcıyı sunucudan yasaklar',
  level: 3,
  args: {
    kullanici: arg.user({ description: 'Hedef kullanıcı' }),
    sure: arg.duration({ description: 'Süre', optional: true }),
    sebep: arg.text({ description: 'Sebep', optional: true }),
  },
});

describe('buildSlash', () => {
  it('ban için doğru JSON gövdesini üretir', () => {
    const body = buildSlash(banCommand);

    expect(body.name).toBe('ban');
    expect(body.type).toBe(ApplicationCommandType.ChatInput);
    expect(body.default_member_permissions).toBe('0');
    expect(body.contexts).toEqual([InteractionContextType.Guild]);
    expect(body.options).toHaveLength(3);

    const [first, second, third] = body.options ?? [];
    expect(first).toMatchObject({
      name: 'kullanici',
      type: ApplicationCommandOptionType.User,
      required: true,
    });
    expect(second).toMatchObject({
      name: 'sure',
      type: ApplicationCommandOptionType.String,
      required: false,
    });
    expect(third).toMatchObject({
      name: 'sebep',
      type: ApplicationCommandOptionType.String,
      required: false,
    });
  });

  it('number seçenekleri için min/max ve integer tipini uygular', () => {
    const command = defineCommand({
      name: 'ornek',
      description: 'Örnek',
      level: 1,
      args: {
        sayi: arg.number({ description: 'Sayı', integer: true, min: 1, max: 10 }),
      },
    });

    const body = buildSlash(command);
    expect(body.options?.[0]).toMatchObject({
      type: ApplicationCommandOptionType.Integer,
      min_value: 1,
      max_value: 10,
    });
  });

  it('string choices seçeneklerini choices dizisine çevirir', () => {
    const command = defineCommand({
      name: 'ornek',
      description: 'Örnek',
      level: 1,
      args: {
        tur: arg.string({ description: 'Tür', choices: ['ban', 'jail'] }),
      },
    });

    const body = buildSlash(command);
    expect(body.options?.[0]).toMatchObject({
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: 'ban', value: 'ban' },
        { name: 'jail', value: 'jail' },
      ],
    });
  });

  it('zorunlu seçenek opsiyonelden sonra gelirse hata fırlatır', () => {
    const command = defineCommand({
      name: 'ornek',
      description: 'Örnek',
      level: 1,
      args: {
        sebep: arg.text({ description: 'Sebep', optional: true }),
        kullanici: arg.user({ description: 'Kullanıcı' }),
      },
    });

    expect(() => buildSlash(command)).toThrow(
      'ornek: zorunlu seçenekler opsiyonellerden önce gelmeli',
    );
  });

  it('alt komutları Subcommand seçeneği olarak üretir', () => {
    const command = defineCommand({
      name: 'ayar',
      description: 'Ayarlar',
      level: 4,
      subcommands: {
        limit: {
          name: 'limit',
          description: 'Ceza limiti ayarlar',
          args: {
            tur: arg.string({ description: 'Tür', choices: ['ban', 'jail'] }),
            sayi: arg.number({ description: 'Sayı', integer: true }),
          },
        },
        prefix: {
          name: 'prefix',
          description: 'Prefix değiştirir',
          args: {
            prefix: arg.string({ description: 'Yeni prefix' }),
          },
        },
      },
    });

    const body = buildSlash(command);
    expect(body.options).toHaveLength(2);
    expect(body.options?.[0]).toMatchObject({
      name: 'limit',
      type: ApplicationCommandOptionType.Subcommand,
    });
    expect(body.options?.[0]?.options).toHaveLength(2);
  });

  it('var olmayan bir alt komutu işaret eden defaultSubcommand hata fırlatır', () => {
    const command = defineCommand({
      name: 'ayar',
      description: 'Ayarlar',
      level: 4,
      defaultSubcommand: 'yok',
      subcommands: {
        limit: {
          name: 'limit',
          description: 'Ceza limiti ayarlar',
        },
      },
    });

    expect(() => buildSlash(command)).toThrow('ayar: defaultSubcommand "yok" bulunamadı');
  });

  it('geçersiz slash adı için hata fırlatır', () => {
    const command = defineCommand({
      name: 'ornek',
      description: 'Örnek',
      level: 1,
      args: {
        'geçersiz ad!': arg.text({ description: 'x' }),
      },
    });

    expect(() => buildSlash(command)).toThrow(/Geçersiz slash adı/);
  });
});

describe('readSlashArgs', () => {
  function makeReader(values: Partial<Record<string, unknown>>): SlashOptionReader {
    return {
      getUser: (name) => (values[name] ? { id: values[name] as string } : null),
      getRole: (name) => (values[name] ? { id: values[name] as string } : null),
      getChannel: (name) => (values[name] ? { id: values[name] as string } : null),
      getString: (name) => (values[name] !== undefined ? (values[name] as string) : null),
      getNumber: (name) => (values[name] !== undefined ? (values[name] as number) : null),
      getInteger: (name) => (values[name] !== undefined ? (values[name] as number) : null),
    };
  }

  it('user, duration ve text değerlerini okur', () => {
    const reader = makeReader({
      kullanici: '123456789012345678',
      sure: '7g',
      sebep: 'reklam',
    });
    const values = readSlashArgs(reader, {
      kullanici: arg.user({ description: 'x' }),
      sure: arg.duration({ description: 'x', optional: true }),
      sebep: arg.text({ description: 'x', optional: true }),
    });
    expect(values).toEqual({
      kullanici: '123456789012345678',
      sure: 604_800_000,
      sebep: 'reklam',
    });
  });

  it('eksik opsiyonel değerler için undefined döner', () => {
    const reader = makeReader({ kullanici: '123456789012345678' });
    const values = readSlashArgs(reader, {
      kullanici: arg.user({ description: 'x' }),
      sure: arg.duration({ description: 'x', optional: true }),
    });
    expect(values).toEqual({ kullanici: '123456789012345678', sure: undefined });
  });

  it('geçersiz süre için hata fırlatır', () => {
    const reader = makeReader({ sure: 'abc' });
    expect(() => readSlashArgs(reader, { sure: arg.duration({ description: 'x' }) })).toThrow(
      'Geçersiz süre: abc',
    );
  });

  it('users listesini metinden ID olarak çıkarır', () => {
    const reader = makeReader({ kullanicilar: '<@123456789012345678> 234567890123456789' });
    const values = readSlashArgs(reader, {
      kullanicilar: arg.users({ description: 'x' }),
    });
    expect(values).toEqual({ kullanicilar: ['123456789012345678', '234567890123456789'] });
  });

  it('zorunlu users için hiç ID bulunamazsa hata fırlatır', () => {
    const reader = makeReader({ kullanicilar: 'boşluk' });
    expect(() => readSlashArgs(reader, { kullanicilar: arg.users({ description: 'x' }) })).toThrow(
      'Geçersiz kullanıcı listesi',
    );
  });
});

describe('hashCommands', () => {
  it('aynı içerik için deterministik aynı hash üretir', () => {
    const bodies = [buildSlash(banCommand)];
    expect(hashCommands(bodies)).toBe(hashCommands(bodies));
    expect(hashCommands(bodies)).toBe(hashCommands([buildSlash(banCommand)]));
  });

  it('farklı içerik için farklı hash üretir', () => {
    const other = defineCommand({ name: 'kick', description: 'Atar', level: 2 });
    expect(hashCommands([buildSlash(banCommand)])).not.toBe(hashCommands([buildSlash(other)]));
  });

  it('sha256 hex uzunluğunda döner', () => {
    expect(hashCommands([])).toMatch(/^[0-9a-f]{64}$/);
  });
});
