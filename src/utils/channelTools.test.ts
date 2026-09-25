import { describe, expect, it } from 'vitest';
import {
  BULK_DELETE_MAX_AGE_MS,
  hasLink,
  type PurgeCandidate,
  selectForPurge,
  slowmodeSeconds,
} from './channelTools.js';

const NOW = 1_800_000_000_000;

function msg(id: string, ageMs: number, extra: Partial<PurgeCandidate> = {}) {
  return { id, createdTimestamp: NOW - ageMs, pinned: false, ...extra };
}

describe('selectForPurge', () => {
  it('en fazla amount kadar mesaj seçer', () => {
    const messages = [msg('1', 0), msg('2', 0), msg('3', 0)];
    expect(selectForPurge(messages, 2, undefined, NOW).map((m) => m.id)).toEqual(['1', '2']);
  });

  it('sabitlenmiş ve 14 günden eski mesajları atlar', () => {
    const messages = [
      msg('1', 0, { pinned: true }),
      msg('2', BULK_DELETE_MAX_AGE_MS),
      msg('3', 1000),
    ];
    expect(selectForPurge(messages, 10, undefined, NOW).map((m) => m.id)).toEqual(['3']);
  });

  it('yalnızca predicate e uyanları sayar', () => {
    const messages = [msg('1', 0), msg('2', 0), msg('3', 0), msg('4', 0)];
    const even = (m: PurgeCandidate) => Number(m.id) % 2 === 0;
    expect(selectForPurge(messages, 1, even, NOW).map((m) => m.id)).toEqual(['2']);
  });
});

describe('hasLink', () => {
  it('bağlantı ve davetleri yakalar', () => {
    expect(hasLink('bak https://ornek.com')).toBe(true);
    expect(hasLink('www.ornek.com')).toBe(true);
    expect(hasLink('gel discord.gg/abc')).toBe(true);
    expect(hasLink('discord.com/invite/abc')).toBe(true);
  });

  it('düz metni yakalamaz', () => {
    expect(hasLink('merhaba dünya. nasılsın')).toBe(false);
  });
});

describe('slowmodeSeconds', () => {
  it('kapatma girdileri 0 döner', () => {
    expect(slowmodeSeconds('0')).toBe(0);
    expect(slowmodeSeconds('KAPAT')).toBe(0);
    expect(slowmodeSeconds('kapalı')).toBe(0);
  });

  it('süreyi saniyeye çevirir', () => {
    expect(slowmodeSeconds('10sn')).toBe(10);
    expect(slowmodeSeconds('2dk')).toBe(120);
    expect(slowmodeSeconds('6sa')).toBe(21600);
  });

  it('geçersiz veya 6 saati aşan süreler null döner', () => {
    expect(slowmodeSeconds('abc')).toBeNull();
    expect(slowmodeSeconds('7sa')).toBeNull();
  });
});
