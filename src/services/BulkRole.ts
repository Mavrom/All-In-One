import type { Guild, GuildMember } from 'discord.js';
import { type BulkRoleFilter, type FilterMember, matchesFilter } from '#utils/bulkRoleFilter.js';

/** Toplu rolde yapılacak işlem. */
export type BulkAction = 'ver' | 'al';

/**
 * Hız ayarları. Discord rol değiştirme limitini sabit yayınlamaz; discord.js yanıt
 * başlıklarına göre istekleri zaten sıraya koyar. Bu değerler onun üstüne, limite yaslanmadan
 * ilerlemek için eklenen boşluklardır.
 */
export const PACE = {
  /** Bu sayıya kadar hedef ara vermeden işlenir. */
  directLimit: 25,
  startSize: 10,
  startPauseMs: 1000,
  minSize: 5,
  maxSize: 25,
  growStep: 5,
  minPauseMs: 500,
  maxPauseMs: 10_000,
  /** Art arda bu kadar hata gelirse işlem durur. */
  maxConsecutiveFailures: 5,
  /** Süre tahmini için istek başına varsayılan süre. */
  estimatePerRequestMs: 300,
} as const;

/** Grup büyüklüğü ve gruplar arası bekleme. */
export interface PaceState {
  size: number;
  pauseMs: number;
}

/**
 * Bir grup bittikten sonraki hızı hesaplar: grup sırasında rate limit uyarısı geldiyse grup
 * yarıya iner ve bekleme iki katına çıkar, gelmediyse grup büyür ve bekleme kısalır.
 */
export function nextPace(state: PaceState, rateLimited: boolean): PaceState {
  if (rateLimited) {
    return {
      size: Math.max(PACE.minSize, Math.floor(state.size / 2)),
      pauseMs: Math.min(PACE.maxPauseMs, state.pauseMs * 2),
    };
  }
  return {
    size: Math.min(PACE.maxSize, state.size + PACE.growStep),
    pauseMs: Math.max(PACE.minPauseMs, Math.round(state.pauseMs * 0.75)),
  };
}

/** `count` hedef için limit uyarısı gelmediği varsayımıyla tahmini süre (ms). */
export function estimateMs(count: number): number {
  let total = count * PACE.estimatePerRequestMs;
  if (count <= PACE.directLimit) return total;

  let pace: PaceState = { size: PACE.startSize, pauseMs: PACE.startPauseMs };
  let left = count - pace.size;
  while (left > 0) {
    total += pace.pauseMs;
    pace = nextPace(pace, false);
    left -= pace.size;
  }
  return total;
}

/** Bir `GuildMember`'ı filtre eşleştirmesinin beklediği biçime çevirir. */
export function toFilterMember(member: GuildMember): FilterMember {
  return {
    id: member.id,
    bot: member.user.bot,
    createdAt: member.user.createdTimestamp,
    joinedAt: member.joinedTimestamp,
    roleIds: member.roles.cache.filter((role) => role.id !== member.guild.id).map((r) => r.id),
    inVoice: member.voice.channelId !== null,
  };
}

/** {@link collectTargets} sonucu. */
export interface TargetSelection {
  /** İşlem uygulanacak üyeler. */
  targets: GuildMember[];
  /** Filtreye uyan ama rolü zaten olan (`ver`) veya olmayan (`al`) üye sayısı. */
  alreadyDone: number;
}

/**
 * Sunucu üyelerini çeker, filtreyi uygular ve işlemin gerçekten bir şey değiştireceği üyeleri
 * ayırır. `kişiler` filtresi varsa yalnızca o üyeler çekilir.
 */
export async function collectTargets(
  guild: Guild,
  roleId: string,
  action: BulkAction,
  filter: BulkRoleFilter,
  now = Date.now(),
): Promise<TargetSelection> {
  const members =
    filter.users !== null
      ? await guild.members.fetch({ user: filter.users })
      : await guild.members.fetch();

  const targets: GuildMember[] = [];
  let alreadyDone = 0;
  for (const member of members.values()) {
    if (!matchesFilter(toFilterMember(member), filter, now)) continue;
    const hasRole = member.roles.cache.has(roleId);
    if (hasRole === (action === 'ver')) {
      alreadyDone += 1;
      continue;
    }
    targets.push(member);
  }
  return { targets, alreadyDone };
}

/** İşlem sırasında anlık sayılar. */
export interface BulkProgress {
  total: number;
  done: number;
  ok: number;
  failed: number;
  /** İşlem sırasında sunucudan ayrılmış olanlar. */
  left: number;
}

/** İşlemin nasıl bittiği. */
export type BulkEnd = 'tamam' | 'durduruldu' | 'hata';

/** {@link runBulk} sonucu. */
export interface BulkResult extends BulkProgress {
  end: BulkEnd;
  /** `end === 'hata'` ise son hatanın mesajı. */
  error?: string;
  elapsedMs: number;
}

/** {@link runBulk} seçenekleri; Discord'a bağlı parçalar test edilebilirlik için dışarıdan verilir. */
export interface BulkRunOptions<T> {
  targets: readonly T[];
  apply(target: T): Promise<void>;
  /** Hata, hedefin sunucudan ayrılmış olmasından mı kaynaklanıyor. */
  isGone(error: unknown): boolean;
  /** Rol istekleri için rate limit uyarılarına abone olur; aboneliği bırakan fonksiyon döner. */
  onRateLimit(listener: () => void): () => void;
  signal: AbortSignal;
  onProgress?(progress: BulkProgress): void;
  sleep?(ms: number, signal: AbortSignal): Promise<void>;
  now?(): number;
}

/** `signal` iptal edilirse erken biten bekleme. */
export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

/**
 * Hedeflere sırayla işlem uygular. {@link PACE.directLimit} ve altında ara vermez; üstünde
 * gruplar hâlinde ilerler ve her gruptan sonra {@link nextPace} ile hızını ayarlar. Art arda
 * {@link PACE.maxConsecutiveFailures} hata gelirse veya `signal` iptal edilirse durur.
 */
export async function runBulk<T>(options: BulkRunOptions<T>): Promise<BulkResult> {
  const sleep = options.sleep ?? abortableSleep;
  const now = options.now ?? Date.now;
  const started = now();
  const total = options.targets.length;
  const progress: BulkProgress = { total, done: 0, ok: 0, failed: 0, left: 0 };

  let rateLimited = false;
  const unsubscribe = options.onRateLimit(() => {
    rateLimited = true;
  });

  const direct = total <= PACE.directLimit;
  let pace: PaceState = direct
    ? { size: total, pauseMs: 0 }
    : { size: PACE.startSize, pauseMs: PACE.startPauseMs };
  let inGroup = 0;
  let consecutiveFailures = 0;
  let end: BulkEnd = 'tamam';
  let lastError: string | undefined;

  try {
    for (const target of options.targets) {
      if (options.signal.aborted) {
        end = 'durduruldu';
        break;
      }

      if (!direct && inGroup === pace.size) {
        pace = nextPace(pace, rateLimited);
        rateLimited = false;
        inGroup = 0;
        await sleep(pace.pauseMs, options.signal);
        if (options.signal.aborted) {
          end = 'durduruldu';
          break;
        }
      }

      try {
        await options.apply(target);
        progress.ok += 1;
        consecutiveFailures = 0;
      } catch (error) {
        if (options.isGone(error)) {
          progress.left += 1;
        } else {
          progress.failed += 1;
          consecutiveFailures += 1;
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      progress.done += 1;
      inGroup += 1;
      options.onProgress?.({ ...progress });

      if (consecutiveFailures >= PACE.maxConsecutiveFailures) {
        end = 'hata';
        break;
      }
    }
  } finally {
    unsubscribe();
  }

  return {
    ...progress,
    end,
    ...(end === 'hata' && lastError !== undefined ? { error: lastError } : {}),
    elapsedMs: now() - started,
  };
}

/** Sunucu → çalışan toplu rol işleminin rol ID'si. Sunucu başına tek işlem çalışır. */
const activeJobs = new Map<string, string>();

/** Sunucuda başka toplu rol işlemi yoksa işlemi kaydeder ve `true` döner. */
export function tryStartJob(guildId: string, roleId: string): boolean {
  if (activeJobs.has(guildId)) return false;
  activeJobs.set(guildId, roleId);
  return true;
}

/** Sunucudaki toplu rol işleminin kaydını siler. */
export function endJob(guildId: string): void {
  activeJobs.delete(guildId);
}

/** Sunucuda şu an toplu olarak değiştirilen rolün ID'si (yoksa `null`). */
export function activeJobRole(guildId: string): string | null {
  return activeJobs.get(guildId) ?? null;
}
