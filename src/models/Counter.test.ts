import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '#core/testing.js';
import { nextSequence } from './Counter.js';

useTestDatabase();

describe('nextSequence', () => {
  it('aynı isim için ardışık sayılar döner', async () => {
    expect(await nextSequence('case')).toBe(1);
    expect(await nextSequence('case')).toBe(2);
    expect(await nextSequence('case')).toBe(3);
  });

  it('20 paralel çağrı 1-20 arası tekrarsız değerler üretir', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => nextSequence('parallel')));
    const sorted = [...results].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('farklı isimler birbirinden bağımsız sayılır', async () => {
    expect(await nextSequence('a')).toBe(1);
    expect(await nextSequence('b')).toBe(1);
    expect(await nextSequence('a')).toBe(2);
  });
});
