import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startExpiryScheduler } from './ExpiryScheduler.js';

function createLogger() {
  return { warn: vi.fn(), error: vi.fn() };
}

describe('startExpiryScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('başlar başlamaz hemen bir kez çalışır', () => {
    const expireDue = vi.fn().mockResolvedValue({ expired: 0, failed: [] });
    const logger = createLogger();

    const stop = startExpiryScheduler({ service: { expireDue }, logger, intervalMs: 1000 });

    expect(expireDue).toHaveBeenCalledTimes(1);
    stop();
  });

  it('belirtilen aralıkla tekrar çalışır', async () => {
    const expireDue = vi.fn().mockResolvedValue({ expired: 0, failed: [] });
    const logger = createLogger();

    const stop = startExpiryScheduler({ service: { expireDue }, logger, intervalMs: 1000 });
    expect(expireDue).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(expireDue).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(expireDue).toHaveBeenCalledTimes(3);

    stop();
  });

  it('önceki tur bitmeden yeni tur atlanır', async () => {
    let releaseFirst: (() => void) | undefined;
    const expireDue = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve({ expired: 0, failed: [] });
          }),
      )
      .mockResolvedValue({ expired: 0, failed: [] });
    const logger = createLogger();

    const stop = startExpiryScheduler({ service: { expireDue }, logger, intervalMs: 1000 });
    expect(expireDue).toHaveBeenCalledTimes(1);

    // İlk tur hâlâ sürüyor: bir sonraki interval'da yeni tur atlanmalı.
    await vi.advanceTimersByTimeAsync(1000);
    expect(expireDue).toHaveBeenCalledTimes(1);

    releaseFirst?.();
    await vi.advanceTimersByTimeAsync(0);

    // İlk tur bitti: bir sonraki interval normal çalışmalı.
    await vi.advanceTimersByTimeAsync(1000);
    expect(expireDue).toHaveBeenCalledTimes(2);

    stop();
  });

  it('hata fırlatılmaz, logger.error ile loglanır', async () => {
    const error = new Error('patlama');
    const expireDue = vi.fn().mockRejectedValue(error);
    const logger = createLogger();

    expect(() =>
      startExpiryScheduler({ service: { expireDue }, logger, intervalMs: 1000 }),
    ).not.toThrow();

    await vi.advanceTimersByTimeAsync(0);

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('başarısız kayıtlar logger.warn ile loglanır', async () => {
    const expireDue = vi
      .fn()
      .mockResolvedValue({ expired: 1, failed: [{ caseId: 42, error: new Error('x') }] });
    const logger = createLogger();

    startExpiryScheduler({ service: { expireDue }, logger, intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(0);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[0]).toMatchObject({ caseId: 42 });
  });

  it('stop() sonrasında yeni tur çalışmaz', async () => {
    const expireDue = vi.fn().mockResolvedValue({ expired: 0, failed: [] });
    const logger = createLogger();

    const stop = startExpiryScheduler({ service: { expireDue }, logger, intervalMs: 1000 });
    expect(expireDue).toHaveBeenCalledTimes(1);

    stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(expireDue).toHaveBeenCalledTimes(1);
  });
});
