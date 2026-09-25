import { describe, expect, it } from 'vitest';
import { encodeDuration, formatDuration, MAX_TIMEOUT_MS, parseDuration } from './duration.js';

describe('parseDuration', () => {
  it('tekil birimleri ms cinsinden çözer', () => {
    expect(parseDuration('1g')).toBe(86_400_000);
    expect(parseDuration('30dk')).toBe(1_800_000);
    expect(parseDuration('2sa')).toBe(7_200_000);
    expect(parseDuration('45sn')).toBe(45_000);
    expect(parseDuration('1hf')).toBe(604_800_000);
  });

  it('birleşik süreleri toplar', () => {
    expect(parseDuration('1g12sa')).toBe(129_600_000);
  });

  it('büyük/küçük harf duyarsızdır', () => {
    expect(parseDuration('1G')).toBe(86_400_000);
  });

  it('geçersiz girdilerde null döner', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('10')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('1x')).toBeNull();
    expect(parseDuration('0dk')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('birden fazla birimi Türkçe olarak biçimlendirir', () => {
    expect(formatDuration(90_061_000)).toBe('1 gün 1 saat 1 dakika 1 saniye');
  });

  it('tek birimi biçimlendirir', () => {
    expect(formatDuration(3_600_000)).toBe('1 saat');
  });
});

describe('MAX_TIMEOUT_MS', () => {
  it('28 gündür', () => {
    expect(MAX_TIMEOUT_MS).toBe(28 * 24 * 60 * 60 * 1000);
  });
});

describe('encodeDuration', () => {
  it('ms değerini kısa süre biçimine çevirir', () => {
    expect(encodeDuration(5_400_000)).toBe('1sa30dk');
    expect(encodeDuration(3_600_000)).toBe('1sa');
    expect(encodeDuration(691_200_000)).toBe('1hf1g');
  });

  it('parseDuration ile tersinirdir', () => {
    for (const ms of [1000, 60_000, 5_400_000, 90_061_000, 604_800_000]) {
      expect(parseDuration(encodeDuration(ms))).toBe(ms);
    }
  });
});
