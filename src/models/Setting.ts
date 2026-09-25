import type { Model } from 'mongoose';
import { model, Schema } from 'mongoose';

/** Veritabanında saklanan dinamik bir ayar değeri. */
export interface SettingRecord {
  guildId: string;
  scope: string;
  key: string;
  value: unknown;
  updatedBy: string | null;
  updatedAt: Date;
}

const settingSchema = new Schema<SettingRecord>(
  {
    guildId: { type: String, required: true },
    scope: { type: String, required: true },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed },
    updatedBy: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

settingSchema.index({ guildId: 1, scope: 1, key: 1 }, { unique: true });

/** `.ayar` ile değiştirilen ve kurulum/logkur ile oluşan dinamik ayar değerlerini tutar. */
export const Setting: Model<SettingRecord> = model<SettingRecord>('Setting', settingSchema);
