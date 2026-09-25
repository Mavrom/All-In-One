import { EmbedBuilder } from 'discord.js';

/** Embed kullanım amacına göre renkler. */
export const COLORS = {
  success: 0x2ecc71,
  error: 0xe74c3c,
  info: 0x3498db,
  warning: 0xf39c12,
  punish: 0xe67e22,
} as const;

/** `kind`'e göre renklendirilmiş, zaman damgalı boş bir `EmbedBuilder` döner. */
export function embed(kind: keyof typeof COLORS): EmbedBuilder {
  return new EmbedBuilder().setColor(COLORS[kind]).setTimestamp();
}
