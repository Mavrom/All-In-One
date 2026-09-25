import type { LogService } from '#services/LogService.js';
import type { PunishmentService } from '#services/PunishmentService.js';

/** `moderasyon` botunun `onReady` içinde kurulan paylaşılan servisleri. */
export interface ModServices {
  punishments: PunishmentService;
  logs: LogService;
}

let services: ModServices | undefined;

/** Paylaşılan servisleri kurar; `onReady` içinde bir kez çağrılmalıdır. */
export function setModServices(s: ModServices): void {
  services = s;
}

/** Kurulu servisleri döner; henüz kurulmadıysa hata fırlatır. */
export function mod(): ModServices {
  if (!services) {
    throw new Error('Moderasyon servisleri henüz hazır değil');
  }
  return services;
}
