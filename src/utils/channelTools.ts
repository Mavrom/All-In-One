import { parseDuration } from './duration.js';
import { trLower } from './text.js';

/** Discord'un toplu silebildiği en eski mesaj yaşı (14 gün, ms). */
export const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Discord yavaş mod üst sınırı (6 saat, saniye). */
export const MAX_SLOWMODE_SECONDS = 6 * 60 * 60;

const LINK_RE = /(https?:\/\/|www\.|discord\.gg\/|discord(?:app)?\.com\/invite\/)\S+/i;

/** Metinde bağlantı veya Discord daveti var mı. */
export function hasLink(content: string): boolean {
  return LINK_RE.test(content);
}

/** Silme adayı bir mesajın, seçim için gereken kısmı. */
export interface PurgeCandidate {
  id: string;
  createdTimestamp: number;
  pinned: boolean;
}

/**
 * Yeniden eskiye sıralı mesajlardan silinecekleri seçer: sabitlenmiş ve 14 günden eski
 * mesajlar atlanır, `predicate`'e uyanlardan en fazla `amount` tanesi alınır.
 */
export function selectForPurge<T extends PurgeCandidate>(
  messages: T[],
  amount: number,
  predicate: (message: T) => boolean = () => true,
  now: number = Date.now(),
): T[] {
  const selected: T[] = [];
  for (const message of messages) {
    if (selected.length >= amount) break;
    if (message.pinned) continue;
    if (now - message.createdTimestamp >= BULK_DELETE_MAX_AGE_MS) continue;
    if (predicate(message)) selected.push(message);
  }
  return selected;
}

/**
 * `slowmode` girdisini saniyeye çevirir: `0`, `kapat` veya `kapalı` yavaş modu kapatır (0).
 * Geçersiz, 1 saniyeden kısa veya 6 saati aşan süreler için `null` döner.
 */
export function slowmodeSeconds(input: string): number | null {
  const normalized = trLower(input.trim());
  if (normalized === '0' || normalized === 'kapat' || normalized === 'kapalı') return 0;

  const ms = parseDuration(normalized);
  if (ms === null) return null;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 1 || seconds > MAX_SLOWMODE_SECONDS) return null;
  return seconds;
}
