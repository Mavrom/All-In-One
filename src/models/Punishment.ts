import type { Model } from 'mongoose';
import { model, Schema } from 'mongoose';

/** Ceza türleri. */
export type PunishmentType = 'ban' | 'kick' | 'mute' | 'chatmute' | 'voicemute' | 'jail' | 'warn';

/** Ceza kaydının durumu. */
export type PunishmentStatus = 'active' | 'expired' | 'revoked';

/** Cezanın kim tarafından oluşturulduğu: komutla mı, yoksa Discord üzerinden mi. */
export type PunishmentSource = 'command' | 'discord';

/** Discord üzerinde etkisi süregelebilen (aktif kalabilen) ceza türleri. */
export const ONGOING_TYPES: readonly PunishmentType[] = [
  'ban',
  'mute',
  'chatmute',
  'voicemute',
  'jail',
];

/** Bir cezanın iptal bilgisi. */
export interface RevokedInfo {
  by: string;
  at: Date;
  reason: string;
}

/** Bir ceza kaydının tüm alanları. */
export interface PunishmentRecord {
  caseId: number;
  guildId: string;
  type: PunishmentType;
  userId: string;
  staffId: string;
  reason: string;
  createdAt: Date;
  expiresAt: Date | null;
  status: PunishmentStatus;
  revoked: RevokedInfo | null;
  source: PunishmentSource;
  savedRoles: string[];
}

const revokedSchema = new Schema<RevokedInfo>(
  {
    by: { type: String, required: true },
    at: { type: Date, required: true },
    reason: { type: String, required: true },
  },
  { _id: false },
);

const punishmentSchema = new Schema<PunishmentRecord>(
  {
    caseId: { type: Number, required: true, unique: true },
    guildId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['ban', 'kick', 'mute', 'chatmute', 'voicemute', 'jail', 'warn'],
    },
    userId: { type: String, required: true },
    staffId: { type: String, required: true },
    reason: { type: String, default: 'Sebep belirtilmedi' },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    status: { type: String, required: true, enum: ['active', 'expired', 'revoked'] },
    revoked: { type: revokedSchema, default: null },
    source: { type: String, enum: ['command', 'discord'], default: 'command' },
    savedRoles: { type: [String], default: [] },
  },
  { timestamps: false },
);

punishmentSchema.index({ userId: 1, status: 1 });
punishmentSchema.index({ staffId: 1, type: 1, createdAt: -1 });
punishmentSchema.index({ status: 1, expiresAt: 1 });

/** Ceza kayıtlarını tutan koleksiyon; kayıt asla silinmez, iptal `status: 'revoked'` ile işlenir. */
export const Punishment: Model<PunishmentRecord> = model<PunishmentRecord>(
  'Punishment',
  punishmentSchema,
);
