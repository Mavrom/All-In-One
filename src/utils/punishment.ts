import type { PunishmentType } from '#models/Punishment.js';

/** Ceza türlerinin kullanıcıya görünen Türkçe adları. */
export const PUNISHMENT_LABELS: Record<PunishmentType, string> = {
  ban: 'Ban',
  kick: 'Kick',
  mute: 'Mute',
  chatmute: 'Chat Mute',
  voicemute: 'Voice Mute',
  jail: 'Jail',
  warn: 'Uyarı',
};
