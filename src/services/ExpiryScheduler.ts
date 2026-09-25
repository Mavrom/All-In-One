import type { Logger } from 'pino';
import type { PunishmentService } from './PunishmentService.js';

/** `startExpiryScheduler` çağrısına verilen bağımlılıklar. */
export interface ExpirySchedulerDeps {
  service: Pick<PunishmentService, 'expireDue'>;
  /** Tur aralığı (ms), varsayılan 30 saniye. */
  intervalMs?: number;
  logger: Pick<Logger, 'warn' | 'error'>;
}

const DEFAULT_INTERVAL_MS = 30_000;

/**
 * Süresi dolan cezaları düzenli aralıklarla sonlandırır: açılışta hemen bir kez, ardından
 * `intervalMs` aralıklarla çalışır. Önceki tur bitmeden yeni bir tur başlatılmaz (üst üste
 * binme engellenir). Beklenmeyen hatalar `logger.error`, tek tek başarısız kayıtlar
 * `logger.warn` ile loglanır; hiçbir durumda dışarı fırlatılmaz. Döndürülen `stop()`
 * zamanlayıcıyı durdurur.
 */
export function startExpiryScheduler(deps: ExpirySchedulerDeps): () => void {
  const { service, logger } = deps;
  const intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS;

  let running = false;
  let stopped = false;

  async function tick(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const result = await service.expireDue();
      for (const failure of result.failed) {
        logger.warn({ caseId: failure.caseId, err: failure.error }, 'Ceza sonlandırılamadı');
      }
    } catch (error) {
      logger.error({ err: error }, 'Ceza zamanlayıcısı turu hata ile sonuçlandı');
    } finally {
      running = false;
    }
  }

  void tick();

  const timer = setInterval(() => {
    if (stopped) return;
    void tick();
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
