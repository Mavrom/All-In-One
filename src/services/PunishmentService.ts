import { UserError } from '#core/errors.js';
import { nextSequence } from '#models/Counter.js';
import type { PunishmentRecord, PunishmentStatus, PunishmentType } from '#models/Punishment.js';
import { ONGOING_TYPES, Punishment } from '#models/Punishment.js';
import type { Level } from '#services/PermissionService.js';
import { Level as LevelEnum } from '#services/PermissionService.js';
import { formatDuration, MAX_TIMEOUT_MS } from '#utils/duration.js';
import { PUNISHMENT_LABELS } from '#utils/punishment.js';
import type { LimitedType } from './LimitService.js';
import { checkLimit, LIMITED_TYPES } from './LimitService.js';

/** `PunishmentActions.apply` çağrısına verilen seçenekler. */
export interface ApplyOptions {
  durationMs: number | null;
  reason: string;
}

/**
 * Discord'a bağımlı işlemlerin soyutlandığı arayüz; `PunishmentService` bu arayüz üzerinden
 * çalışır, böylece testlerde gerçek Discord'a ihtiyaç duyulmaz.
 */
export interface PunishmentActions {
  /** Kullanıcıya DM gönderir; DM kapalıysa (veya başka bir sebeple) sessizce yutulmalıdır. */
  notify(userId: string, text: string): Promise<void>;
  /** Cezayı Discord üzerinde uygular; hata fırlatırsa kayıt oluşturulmaz. */
  apply(
    type: PunishmentType,
    userId: string,
    opts: ApplyOptions,
  ): Promise<{ savedRoles?: string[] }>;
  /** Cezayı Discord üzerinde geri alır. */
  revoke(record: PunishmentRecord): Promise<void>;
  /** Çık-gir korumasında cezayı tekrar uygular. */
  reapply(record: PunishmentRecord): Promise<void>;
}

/** `PunishmentService` tarafından yayınlanan olaylar (log servisi vb. bunları dinler). */
export type PunishmentEvent =
  | { kind: 'punish'; record: PunishmentRecord }
  | { kind: 'revoke'; record: PunishmentRecord }
  | { kind: 'expire'; record: PunishmentRecord }
  | { kind: 'clear'; userId: string; staffId: string; count: number; reason: string }
  | {
      kind: 'limit';
      staffId: string;
      type: LimitedType;
      used: number;
      max: number;
      windowMs: number;
    }
  | { kind: 'evade'; record: PunishmentRecord };

/** `PunishmentService.punish` çağrısına verilen girdi. */
export interface PunishInput {
  type: PunishmentType;
  userId: string;
  staffId: string;
  staffLevel: Level;
  reason?: string;
  durationMs?: number | null;
  source?: 'command' | 'discord';
}

/** `PunishmentService` yapıcısına verilen bağımlılıklar. */
export interface PunishmentServiceDeps {
  guildId: string;
  guildName: string;
  actions: PunishmentActions;
  limits: (type: LimitedType) => { max: number; windowMs: number };
  /** Sözleşme: hata fırlatmamalı; log servisi burada hataları kendi içinde yutar. */
  onEvent?: (event: PunishmentEvent) => Promise<void> | void;
}

const DEFAULT_REASON = 'Sebep belirtilmedi';

function normalizeReason(reason: string | undefined): string {
  return reason !== undefined && reason.trim() !== '' ? reason : DEFAULT_REASON;
}

function isOngoingType(type: PunishmentType): boolean {
  return ONGOING_TYPES.includes(type);
}

function isLimitedType(type: PunishmentType): type is LimitedType {
  return (LIMITED_TYPES as readonly PunishmentType[]).includes(type);
}

/**
 * Ceza verme, iptal etme, süre dolumu ve çık-gir koruması dahil tüm ceza mantığını içerir.
 * Discord'dan tamamen bağımsızdır; gerçek Discord etkisi `PunishmentActions` üzerinden gelir.
 */
export class PunishmentService {
  private readonly guildId: string;
  private readonly guildName: string;
  private readonly actions: PunishmentActions;
  private readonly limitsFn: (type: LimitedType) => { max: number; windowMs: number };
  private readonly onEvent?: (event: PunishmentEvent) => Promise<void> | void;

  constructor(deps: PunishmentServiceDeps) {
    this.guildId = deps.guildId;
    this.guildName = deps.guildName;
    this.actions = deps.actions;
    this.limitsFn = deps.limits;
    this.onEvent = deps.onEvent;
  }

  private async emit(event: PunishmentEvent): Promise<void> {
    await this.onEvent?.(event);
  }

  /** Bir kullanıcının bir türdeki aktif kaydını döner (yoksa `null`). */
  async findActive(userId: string, type: PunishmentType): Promise<PunishmentRecord | null> {
    return Punishment.findOne({
      guildId: this.guildId,
      userId,
      type,
      status: 'active',
    }).lean();
  }

  /** `caseId` numaralı kaydı döner (yoksa `null`). */
  async findCase(caseId: number): Promise<PunishmentRecord | null> {
    return Punishment.findOne({ guildId: this.guildId, caseId }).lean();
  }

  /** Bir türdeki tüm aktif kayıtları en yeniden eskiye doğru döner. */
  async listActive(type: PunishmentType): Promise<PunishmentRecord[]> {
    return Punishment.find({ guildId: this.guildId, type, status: 'active' })
      .sort({ caseId: -1 })
      .lean();
  }

  /**
   * `staffId`'nin `type` için limitini denetler; aşıldıysa `limit` olayı yayınlayıp
   * `UserError` fırlatır. Limitsiz türler ve Sahip kademesi için sessizce geçer.
   */
  async assertLimit(
    staffId: string,
    staffLevel: Level,
    type: PunishmentType,
    incoming = 1,
  ): Promise<void> {
    if (staffLevel === LevelEnum.Owner || !isLimitedType(type)) return;

    const { max, windowMs } = this.limitsFn(type);
    if (max === 0) return;

    const result = await checkLimit({
      guildId: this.guildId,
      staffId,
      type,
      max,
      windowMs,
      incoming,
    });

    if (!result.allowed) {
      await this.emit({
        kind: 'limit',
        staffId,
        type,
        used: result.used,
        max: result.max,
        windowMs,
      });
      throw new UserError(
        `${formatDuration(windowMs)} içindeki ${PUNISHMENT_LABELS[type]} limitine ulaştın ` +
          `(${result.used}/${result.max}).`,
      );
    }
  }

  private async createRecord(input: {
    type: PunishmentType;
    userId: string;
    staffId: string;
    reason: string;
    durationMs: number | null;
    source: 'command' | 'discord';
    savedRoles: string[];
  }): Promise<PunishmentRecord> {
    const caseId = await nextSequence('case');
    const now = new Date();
    const status: PunishmentStatus = input.type === 'kick' ? 'expired' : 'active';
    const expiresAt = input.durationMs !== null ? new Date(now.getTime() + input.durationMs) : null;

    const doc = await Punishment.create({
      caseId,
      guildId: this.guildId,
      type: input.type,
      userId: input.userId,
      staffId: input.staffId,
      reason: input.reason,
      createdAt: now,
      expiresAt,
      status,
      revoked: null,
      source: input.source,
      savedRoles: input.savedRoles,
    });

    return doc.toObject();
  }

  /** Bir kullanıcıya ceza verir; kurallar için Task 11 kontrolcü kararlarına bakınız. */
  async punish(input: PunishInput): Promise<PunishmentRecord> {
    const { type, userId, staffId, staffLevel } = input;
    const source = input.source ?? 'command';
    const reason = normalizeReason(input.reason);
    const durationMs = type === 'kick' || type === 'warn' ? null : (input.durationMs ?? null);

    if (type === 'mute') {
      if (durationMs === null) {
        throw new UserError('Mute için süre gerekli.');
      }
      if (durationMs > MAX_TIMEOUT_MS) {
        throw new UserError('Mute en fazla 28 gün olabilir.');
      }
    }

    const ongoing = isOngoingType(type);

    if (source === 'discord') {
      if (ongoing) {
        const active = await this.findActive(userId, type);
        if (active) return active;
      }

      const record = await this.createRecord({
        type,
        userId,
        staffId,
        reason,
        durationMs,
        source,
        savedRoles: [],
      });
      await this.emit({ kind: 'punish', record });
      return record;
    }

    if (ongoing) {
      const active = await this.findActive(userId, type);
      if (active) {
        throw new UserError(
          `Bu kullanıcının zaten aktif bir ${PUNISHMENT_LABELS[type]} cezası var (#${active.caseId}).`,
        );
      }
    }

    await this.assertLimit(staffId, staffLevel, type, 1);

    const isBanOrKick = type === 'ban' || type === 'kick';
    const durationSuffix = durationMs !== null ? `\nSüre: ${formatDuration(durationMs)}` : '';

    if (isBanOrKick) {
      const text =
        `**${this.guildName}** sunucusundan ${PUNISHMENT_LABELS[type]} cezası aldın.\n` +
        `Sebep: ${reason}${durationSuffix}`;
      await this.actions.notify(userId, text);
    }

    const applyResult = await this.actions.apply(type, userId, { durationMs, reason });

    const record = await this.createRecord({
      type,
      userId,
      staffId,
      reason,
      durationMs,
      source,
      savedRoles: applyResult.savedRoles ?? [],
    });

    if (!isBanOrKick) {
      const text =
        `**${this.guildName}** sunucusunda ${PUNISHMENT_LABELS[type]} cezası aldın (#${record.caseId}).\n` +
        `Sebep: ${reason}${durationSuffix}`;
      await this.actions.notify(userId, text);
    }

    await this.emit({ kind: 'punish', record });
    return record;
  }

  /** Bir cezayı `caseId` veya `userId`+`type` ile iptal eder. */
  async revoke(
    target: { caseId: number } | { userId: string; type: PunishmentType },
    staffId: string,
    reason?: string,
    opts?: { skipAction?: boolean },
  ): Promise<PunishmentRecord> {
    const record =
      'caseId' in target
        ? await Punishment.findOne({ guildId: this.guildId, caseId: target.caseId })
        : await Punishment.findOne({
            guildId: this.guildId,
            userId: target.userId,
            type: target.type,
            status: 'active',
          });

    if (!record) {
      if ('caseId' in target) {
        throw new UserError(`#${target.caseId} numaralı ceza bulunamadı.`);
      }
      throw new UserError(
        `Bu kullanıcının aktif bir ${PUNISHMENT_LABELS[target.type]} cezası yok.`,
      );
    }

    if (record.status === 'revoked') {
      throw new UserError(`#${record.caseId} zaten iptal edilmiş.`);
    }

    if (record.status === 'active' && isOngoingType(record.type) && !opts?.skipAction) {
      await this.actions.revoke(record.toObject());
    }

    record.status = 'revoked';
    record.revoked = { by: staffId, at: new Date(), reason: normalizeReason(reason) };
    await record.save();

    const plain = record.toObject();
    await this.emit({ kind: 'revoke', record: plain });
    return plain;
  }

  /** Bir kullanıcının iptal edilmemiş tüm kayıtlarını iptal eder; iptal edilen sayıyı döner. */
  async revokeAll(userId: string, staffId: string, reason?: string): Promise<number> {
    const finalReason = normalizeReason(reason);
    const records = await Punishment.find({
      guildId: this.guildId,
      userId,
      status: { $ne: 'revoked' },
    });
    const now = new Date();

    for (const record of records) {
      if (record.status === 'active' && isOngoingType(record.type)) {
        await this.actions.revoke(record.toObject());
      }
      record.status = 'revoked';
      record.revoked = { by: staffId, at: now, reason: finalReason };
      await record.save();
    }

    await this.emit({ kind: 'clear', userId, staffId, count: records.length, reason: finalReason });
    return records.length;
  }

  /** Süresi dolan bir cezayı sonlandırır: Discord tarafını geri alır (mute hariç), kaydı günceller. */
  async expire(record: PunishmentRecord): Promise<void> {
    if (record.type !== 'mute') {
      await this.actions.revoke(record);
    }

    await Punishment.updateOne(
      { guildId: this.guildId, caseId: record.caseId },
      { $set: { status: 'expired' } },
    );

    await this.emit({ kind: 'expire', record: { ...record, status: 'expired' } });
  }

  /**
   * Süresi geçmiş tüm aktif kayıtları sonlandırır; her kayıt bağımsız işlenir, biri hata
   * verirse diğerleri etkilenmez.
   */
  async expireDue(
    now: Date = new Date(),
  ): Promise<{ expired: number; failed: Array<{ caseId: number; error: unknown }> }> {
    const due = await Punishment.find({
      guildId: this.guildId,
      status: 'active',
      expiresAt: { $ne: null, $lte: now },
    }).lean();

    let expired = 0;
    const failed: Array<{ caseId: number; error: unknown }> = [];

    for (const record of due) {
      try {
        await this.expire(record);
        expired += 1;
      } catch (error) {
        failed.push({ caseId: record.caseId, error });
      }
    }

    return { expired, failed };
  }

  /**
   * Bir kullanıcı sunucuya tekrar girdiğinde aktif chatmute/voicemute/jail cezalarını
   * yeniden uygular ve her biri için `evade` olayı yayınlar.
   */
  async handleRejoin(userId: string): Promise<PunishmentRecord[]> {
    const types: PunishmentType[] = ['chatmute', 'voicemute', 'jail'];
    const records = await Punishment.find({
      guildId: this.guildId,
      userId,
      type: { $in: types },
      status: 'active',
    }).lean();

    for (const record of records) {
      await this.actions.reapply(record);
      await this.emit({ kind: 'evade', record });
    }

    return records;
  }
}
