import { describe, expect, it } from 'vitest';
import { loadJsonConfig } from '#core/config.js';
import { botDefaults, moderasyonSchema } from './moderasyonConfig.js';

describe('moderasyonSchema', () => {
  it('config/moderasyon.json dosyasının şeklini kabul eder', () => {
    const config = loadJsonConfig('moderasyon.json', moderasyonSchema);
    expect(config.prefix).toBe('.');
    expect(config.limitler).toEqual({ pencere: '1sa', ban: 10, kick: 10, jail: 20 });
    expect(config.kademeler).toEqual({});
  });

  it('geçersiz pencere süresini reddeder', () => {
    const result = moderasyonSchema.safeParse({
      prefix: '.',
      limitler: { pencere: 'gecersiz', ban: 10, kick: 10, jail: 20 },
      kademeler: {},
    });
    expect(result.success).toBe(false);
  });

  it('negatif limiti reddeder', () => {
    const result = moderasyonSchema.safeParse({
      prefix: '.',
      limitler: { pencere: '1sa', ban: -1, kick: 10, jail: 20 },
      kademeler: {},
    });
    expect(result.success).toBe(false);
  });

  it('kademe olarak 4 değerini reddeder (yalnızca 1-3 geçerli)', () => {
    const result = moderasyonSchema.safeParse({
      prefix: '.',
      limitler: { pencere: '1sa', ban: 10, kick: 10, jail: 20 },
      kademeler: { ban: 4 },
    });
    expect(result.success).toBe(false);
  });

  it('kademeler verilmezse boş nesneye varsayılır', () => {
    const result = moderasyonSchema.parse({
      prefix: '.',
      limitler: { pencere: '1sa', ban: 10, kick: 10, jail: 20 },
    });
    expect(result.kademeler).toEqual({});
  });
});

describe('botDefaults', () => {
  it('config değerlerini ayar anahtarlarına düzleştirir', () => {
    const defaults = botDefaults({
      prefix: '.',
      limitler: { pencere: '1sa', ban: 10, kick: 10, jail: 20 },
      kademeler: { ban: 3, kick: 2 },
    });
    expect(defaults).toEqual({
      prefix: '.',
      'limit.pencere': '1sa',
      'limit.ban': 10,
      'limit.kick': 10,
      'limit.jail': 20,
      'otorol.uye': null,
      'otorol.bot': null,
      'kademe.ban': 3,
      'kademe.kick': 2,
    });
  });

  it('kademeler boşsa kademe anahtarı üretmez', () => {
    const defaults = botDefaults({
      prefix: '!',
      limitler: { pencere: '2sa', ban: 0, kick: 0, jail: 0 },
      kademeler: {},
    });
    expect(defaults).toEqual({
      prefix: '!',
      'limit.pencere': '2sa',
      'limit.ban': 0,
      'limit.kick': 0,
      'limit.jail': 0,
      'otorol.uye': null,
      'otorol.bot': null,
    });
  });
});
