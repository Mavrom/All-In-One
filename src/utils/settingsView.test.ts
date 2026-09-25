import { describe, expect, it } from 'vitest';
import { formatSettingValue, isResettableKey } from './settingsView.js';

describe('isResettableKey', () => {
  it('prefix, limit, kademe ve yetki anahtarları sıfırlanabilir', () => {
    for (const key of ['prefix', 'limit.ban', 'limit.pencere', 'kademe.kick', 'yetki.orta']) {
      expect(isResettableKey(key)).toBe(true);
    }
  });

  it('kurulum ID leri ve iç anahtarlar sıfırlanamaz', () => {
    for (const key of ['rol.cezali', 'kanal.cezaLog', 'kategori.log', '_slashHash', 'yok']) {
      expect(isResettableKey(key)).toBe(false);
    }
  });
});

describe('formatSettingValue', () => {
  it('boş değerleri tire ile gösterir', () => {
    expect(formatSettingValue('yetki.orta', null)).toBe('—');
    expect(formatSettingValue('yetki.orta', '')).toBe('—');
  });

  it('rol ve kanal ID lerini etiketler, diğerlerini kod olarak yazar', () => {
    expect(formatSettingValue('yetki.orta', '1')).toBe('<@&1>');
    expect(formatSettingValue('rol.cezali', '2')).toBe('<@&2>');
    expect(formatSettingValue('kanal.sesLog', '3')).toBe('<#3>');
    expect(formatSettingValue('kategori.log', '4')).toBe('<#4>');
    expect(formatSettingValue('limit.ban', 5)).toBe('`5`');
  });
});
