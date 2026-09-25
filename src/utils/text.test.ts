import { describe, expect, it } from 'vitest';
import { foldTurkish, trLower, truncate } from './text.js';

describe('trLower', () => {
  it('Türkçe büyük harfleri doğru küçültür', () => {
    expect(trLower('UYARI')).toBe('uyarı');
    expect(trLower('İSİM')).toBe('isim');
  });
});

describe('foldTurkish', () => {
  it('Türkçe karakterleri ASCII karşılıklarına çevirir', () => {
    expect(foldTurkish('uyarı şöğüç')).toBe('uyari soguc');
    expect(foldTurkish('İŞÇİ')).toBe('ISCI');
  });
});

describe('truncate', () => {
  it('uzun metni … ile keser, kısa metne dokunmaz', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abc', 4)).toBe('abc');
  });
});
