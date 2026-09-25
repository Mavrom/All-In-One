import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '#core/testing.js';
import { Setting } from '#models/Setting.js';
import { SettingsService } from './SettingsService.js';

useTestDatabase();

describe('SettingsService', () => {
  it('override yoksa varsayılanı döner', async () => {
    const service = new SettingsService({
      guildId: 'g1',
      scope: 'moderasyon',
      defaults: { 'limit.ban': 10 },
    });
    await service.load();

    expect(service.get('limit.ban')).toBe(10);
    expect(service.has('limit.ban')).toBe(true);
    expect(service.isOverridden('limit.ban')).toBe(false);
    expect(service.get('yok')).toBeUndefined();
    expect(service.has('yok')).toBe(false);
  });

  it('set sonrası override döner ve veritabanına yazılır', async () => {
    const service = new SettingsService({
      guildId: 'g2',
      scope: 'moderasyon',
      defaults: { 'limit.ban': 10 },
    });
    await service.load();

    await service.set('limit.ban', 5, 'staff1');

    expect(service.get('limit.ban')).toBe(5);
    expect(service.isOverridden('limit.ban')).toBe(true);

    const doc = await Setting.findOne({
      guildId: 'g2',
      scope: 'moderasyon',
      key: 'limit.ban',
    }).lean();
    expect(doc?.value).toBe(5);
    expect(doc?.updatedBy).toBe('staff1');
  });

  it('yeni bir örnek load() ile override i veritabanından okur', async () => {
    const first = new SettingsService({
      guildId: 'g3',
      scope: 'moderasyon',
      defaults: { 'limit.ban': 10 },
    });
    await first.load();
    await first.set('limit.ban', 7);

    const second = new SettingsService({
      guildId: 'g3',
      scope: 'moderasyon',
      defaults: { 'limit.ban': 10 },
    });
    await second.load();

    expect(second.get('limit.ban')).toBe(7);
  });

  it('override null olsa bile override döner, varsayılana düşmez', async () => {
    const service = new SettingsService({
      guildId: 'g4',
      scope: 'genel',
      defaults: { 'rol.cezali': 'varsayilan-rol' },
    });
    await service.load();
    await service.set('rol.cezali', null);

    expect(service.get('rol.cezali')).toBeNull();
    expect(service.isOverridden('rol.cezali')).toBe(true);
  });

  it('reset varsayılana döner ve veritabanı kaydını siler', async () => {
    const service = new SettingsService({
      guildId: 'g5',
      scope: 'moderasyon',
      defaults: { 'limit.ban': 10 },
    });
    await service.load();
    await service.set('limit.ban', 3);
    expect(service.get('limit.ban')).toBe(3);

    await service.reset('limit.ban');

    expect(service.get('limit.ban')).toBe(10);
    expect(service.isOverridden('limit.ban')).toBe(false);

    const doc = await Setting.findOne({ guildId: 'g5', scope: 'moderasyon', key: 'limit.ban' });
    expect(doc).toBeNull();
  });

  it('farklı scope birbirini görmez', async () => {
    const modService = new SettingsService({ guildId: 'g6', scope: 'moderasyon', defaults: {} });
    await modService.load();
    await modService.set('prefix', '!');

    const genelService = new SettingsService({ guildId: 'g6', scope: 'genel', defaults: {} });
    await genelService.load();

    expect(genelService.get('prefix')).toBeUndefined();
    expect(genelService.isOverridden('prefix')).toBe(false);
  });

  it('entries() varsayılan ve override anahtarlarının birleşimini anahtara göre sıralı döner', async () => {
    const service = new SettingsService({
      guildId: 'g7',
      scope: 'moderasyon',
      defaults: { 'limit.ban': 10, 'limit.kick': 10 },
    });
    await service.load();
    await service.set('limit.jail', 20);
    await service.set('limit.ban', 5);

    expect(service.entries()).toEqual([
      { key: 'limit.ban', value: 5, overridden: true },
      { key: 'limit.jail', value: 20, overridden: true },
      { key: 'limit.kick', value: 10, overridden: false },
    ]);
  });
});
