import { describe, expect, it, vi } from 'vitest';
import {
  activeJobRole,
  type BulkRunOptions,
  endJob,
  estimateMs,
  nextPace,
  PACE,
  runBulk,
  tryStartJob,
} from './BulkRole.js';

class GoneError extends Error {}

function options(
  targets: number[],
  overrides: Partial<BulkRunOptions<number>> = {},
): BulkRunOptions<number> & { sleeps: number[] } {
  const sleeps: number[] = [];
  return {
    targets,
    apply: async () => {},
    isGone: (error) => error instanceof GoneError,
    onRateLimit: () => () => {},
    signal: new AbortController().signal,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    now: () => 0,
    sleeps,
    ...overrides,
  };
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe('nextPace', () => {
  it('uyarı yoksa grubu büyütür, beklemeyi kısaltır; sınırları aşmaz', () => {
    expect(nextPace({ size: 10, pauseMs: 1000 }, false)).toEqual({ size: 15, pauseMs: 750 });
    expect(nextPace({ size: 25, pauseMs: 500 }, false)).toEqual({ size: 25, pauseMs: 500 });
  });

  it('uyarı varsa grubu yarıya indirir, beklemeyi ikiye katlar; sınırları aşmaz', () => {
    expect(nextPace({ size: 20, pauseMs: 1000 }, true)).toEqual({ size: 10, pauseMs: 2000 });
    expect(nextPace({ size: 5, pauseMs: 8000 }, true)).toEqual({ size: 5, pauseMs: 10_000 });
  });
});

describe('estimateMs', () => {
  it('küçük işlemlerde yalnızca istek süresini sayar', () => {
    expect(estimateMs(20)).toBe(20 * PACE.estimatePerRequestMs);
  });

  it('büyük işlemlerde gruplar arası beklemeyi ekler', () => {
    expect(estimateMs(100)).toBeGreaterThan(100 * PACE.estimatePerRequestMs);
  });
});

describe('runBulk', () => {
  it('25 ve altında ara vermeden hepsini uygular', async () => {
    const opts = options(range(25));
    const result = await runBulk(opts);
    expect(result).toMatchObject({ total: 25, done: 25, ok: 25, end: 'tamam' });
    expect(opts.sleeps).toEqual([]);
  });

  it('25 üstünde gruplar arasında bekler ve hızlanır', async () => {
    const opts = options(range(60));
    const result = await runBulk(opts);
    expect(result.ok).toBe(60);
    // 10 → 15 → 20 → 25 kişilik gruplar: 10 + 15 + 20 + 15 = 60, üç bekleme.
    expect(opts.sleeps).toEqual([750, 563, 500]);
  });

  it('rate limit uyarısında yavaşlar', async () => {
    let fire = (): void => {};
    const opts = options(range(30), {
      onRateLimit: (listener) => {
        fire = listener;
        return () => {};
      },
      apply: async (n) => {
        if (n === 3) fire();
      },
    });
    await runBulk(opts);
    // İlk grupta uyarı geldi: 10 → 5 kişi, 1000 → 2000 ms.
    expect(opts.sleeps[0]).toBe(2000);
  });

  it('ayrılmış üyeleri hata saymaz', async () => {
    const opts = options(range(3), {
      apply: async (n) => {
        if (n === 1) throw new GoneError();
      },
    });
    expect(await runBulk(opts)).toMatchObject({ ok: 2, left: 1, failed: 0, end: 'tamam' });
  });

  it('art arda 5 hatada durur', async () => {
    const apply = vi.fn(async () => {
      throw new Error('Missing Permissions');
    });
    const result = await runBulk(options(range(10), { apply }));
    expect(result).toMatchObject({ failed: 5, done: 5, end: 'hata', error: 'Missing Permissions' });
    expect(apply).toHaveBeenCalledTimes(5);
  });

  it('iptal edilince durur ve aboneliği bırakır', async () => {
    const controller = new AbortController();
    const unsubscribe = vi.fn();
    const opts = options(range(10), {
      signal: controller.signal,
      onRateLimit: () => unsubscribe,
      apply: async (n) => {
        if (n === 2) controller.abort();
      },
    });
    const result = await runBulk(opts);
    expect(result).toMatchObject({ done: 3, end: 'durduruldu' });
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

describe('aktif işlem kaydı', () => {
  it('sunucu başına tek işleme izin verir', () => {
    expect(tryStartJob('g', 'r1')).toBe(true);
    expect(tryStartJob('g', 'r2')).toBe(false);
    expect(activeJobRole('g')).toBe('r1');
    endJob('g');
    expect(activeJobRole('g')).toBeNull();
  });
});
