import { describe, expect, it } from 'vitest';
import { Level } from '#services/PermissionService.js';
import { defineCommand } from './define.js';
import { findCommand, requiredLevel, selectSubcommand } from './dispatcher.js';

describe('requiredLevel', () => {
  it('Owner komutları için ayar override olsa bile her zaman Owner döner', () => {
    const def = { name: 'ayar', level: Level.Owner };
    const settings = { get: <T>(): T | undefined => Level.Low as unknown as T };
    expect(requiredLevel(def, settings)).toBe(Level.Owner);
  });

  it('kademe.<ad> override tanımlıysa onu kullanır', () => {
    const def = { name: 'kick', level: Level.Mid };
    const settings = {
      get: <T>(key: string): T | undefined =>
        key === 'kademe.kick' ? (Level.High as unknown as T) : undefined,
    };
    expect(requiredLevel(def, settings)).toBe(Level.High);
  });

  it('override yoksa komutun kendi kademesine düşer', () => {
    const def = { name: 'kick', level: Level.Mid };
    const settings = { get: <T>(): T | undefined => undefined };
    expect(requiredLevel(def, settings)).toBe(Level.Mid);
  });
});

describe('findCommand', () => {
  const uyariCommand = defineCommand({
    name: 'uyarı',
    aliases: ['uyari'],
    description: 'Kullanıcıyı uyarır',
    level: Level.Low,
  });
  const registry = new Map([[uyariCommand.name, uyariCommand]]);

  it('Türkçe büyük harfli girişi bulur (UYARI)', () => {
    expect(findCommand(registry, 'UYARI')).toBe(uyariCommand);
  });

  it('ASCII alias ile bulur (uyari → uyarı)', () => {
    expect(findCommand(registry, 'uyari')).toBe(uyariCommand);
  });

  it('bilinmeyen komut için undefined döner', () => {
    expect(findCommand(registry, 'yoktur')).toBeUndefined();
  });
});

describe('selectSubcommand', () => {
  const ayarCommand = defineCommand({
    name: 'ayar',
    description: 'Ayarlar',
    level: Level.Owner,
    defaultSubcommand: 'goster',
    subcommands: {
      goster: { name: 'goster', description: 'Tüm ayarları gösterir' },
      sıfırla: { name: 'sıfırla', description: 'Bir ayarı varsayılana döndürür' },
    },
  });

  it('komutun alt komutu yoksa tüm tokenleri olduğu gibi döner', () => {
    const banCommand = defineCommand({ name: 'ban', description: 'Ban', level: Level.High });
    expect(selectSubcommand(banCommand, ['123456789012345678', '7g'])).toEqual({
      ok: true,
      rest: ['123456789012345678', '7g'],
    });
  });

  it('ilk token bir alt komutla eşleşirse onu ve kalanını döner', () => {
    expect(selectSubcommand(ayarCommand, ['goster'])).toEqual({
      ok: true,
      sub: 'goster',
      rest: [],
    });
  });

  it('Türkçe katlanmış eşleşme: "sifirla" → "sıfırla"', () => {
    expect(selectSubcommand(ayarCommand, ['sifirla', 'prefix'])).toEqual({
      ok: true,
      sub: 'sıfırla',
      rest: ['prefix'],
    });
  });

  it('token verilmediğinde defaultSubcommand kullanılır', () => {
    expect(selectSubcommand(ayarCommand, [])).toEqual({ ok: true, sub: 'goster', rest: [] });
  });

  it('geçersiz alt komut için kullanılabilirleri listeleyen hata döner', () => {
    expect(selectSubcommand(ayarCommand, ['xyz'])).toEqual({
      ok: false,
      error: 'Geçersiz alt komut. Kullanılabilir: goster, sıfırla',
    });
  });
});
