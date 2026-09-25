import { trLower } from './text.js';

/** Discord timeout üst sınırı (28 gün, ms). */
export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

type Unit = 'sn' | 'dk' | 'sa' | 'g' | 'hf';

const UNIT_MS: Record<Unit, number> = {
  sn: 1000,
  dk: 60 * 1000,
  sa: 60 * 60 * 1000,
  g: 24 * 60 * 60 * 1000,
  hf: 7 * 24 * 60 * 60 * 1000,
};

const UNIT_LABEL: Record<Exclude<Unit, 'hf'>, string> = {
  g: 'gün',
  sa: 'saat',
  dk: 'dakika',
  sn: 'saniye',
};

const DURATION_RE = /^(?:(\d+)(sn|dk|sa|g|hf))+$/;
const TOKEN_RE = /(\d+)(sn|dk|sa|g|hf)/g;

function isUnit(value: string): value is Unit {
  return value === 'sn' || value === 'dk' || value === 'sa' || value === 'g' || value === 'hf';
}

/**
 * Türkçe süre metnini (`"1g12sa"`, `"30dk"` gibi) milisaniyeye çevirir.
 * Geçersiz biçim veya sıfır süre için `null` döner.
 */
export function parseDuration(input: string): number | null {
  const normalized = trLower(input);
  if (!DURATION_RE.test(normalized)) return null;

  let totalMs = 0;
  for (const match of normalized.matchAll(TOKEN_RE)) {
    const amountStr = match[1];
    const unit = match[2];
    if (amountStr === undefined || unit === undefined || !isUnit(unit)) return null;
    const amount = Number(amountStr);
    totalMs += amount * UNIT_MS[unit];
  }

  return totalMs > 0 ? totalMs : null;
}

/** Milisaniye cinsinden süreyi Türkçe okunabilir biçime çevirir (`"1 gün 2 saat"`). */
export function formatDuration(ms: number): string {
  let remaining = ms;
  const parts: string[] = [];

  for (const unit of ['g', 'sa', 'dk', 'sn'] as const) {
    const unitMs = UNIT_MS[unit];
    const value = Math.floor(remaining / unitMs);
    if (value > 0) {
      parts.push(`${value} ${UNIT_LABEL[unit]}`);
      remaining -= value * unitMs;
    }
  }

  return parts.join(' ');
}
