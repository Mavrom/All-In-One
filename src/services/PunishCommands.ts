import type { CommandContext } from '#core/types.js';
import type { PunishmentType } from '#models/Punishment.js';
import { punishmentDone, revokeDone } from '#utils/replies.js';
import { mod } from './ModServices.js';
import { ensureCanPunish } from './TargetService.js';

/**
 * Ceza komutlarının ortak akışı: hedefi denetler, cezayı `PunishmentService` ile verir ve
 * komut kanalına onay embed'i gönderir.
 */
export async function punishAndReply(
  ctx: CommandContext,
  type: PunishmentType,
  userId: string,
  opts: { durationMs?: number | null; reason?: string },
): Promise<void> {
  const { user } = await ensureCanPunish(ctx, userId);
  const record = await mod().punishments.punish({
    type,
    userId,
    staffId: ctx.user.id,
    staffLevel: ctx.level,
    reason: opts.reason,
    durationMs: opts.durationMs ?? null,
  });
  await ctx.reply({ embeds: [punishmentDone(record, user)] });
}

/** Ceza kaldırma komutlarının ortak akışı: kullanıcının aktif `type` cezasını iptal eder. */
export async function revokeAndReply(
  ctx: CommandContext,
  type: PunishmentType,
  userId: string,
  reason: string | undefined,
): Promise<void> {
  const record = await mod().punishments.revoke({ userId, type }, ctx.user.id, reason);
  const user = await ctx.bot.client.users.fetch(userId).catch(() => null);
  await ctx.reply({ embeds: [revokeDone(record, user?.tag ?? userId)] });
}
