import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { ensureCanPunish } from '#services/TargetService.js';
import { punishmentDone } from '#utils/replies.js';

/** `/ban` ve `.ban` (alias `.yasakla`): bir kullanıcıyı sunucudan yasaklar. */
export default defineCommand({
  name: 'ban',
  aliases: ['yasakla'],
  description: 'Bir kullanıcıyı sunucudan yasaklar.',
  level: Level.High,
  args: {
    kullanici: arg.user({ description: 'Yasaklanacak kullanıcı' }),
    sure: arg.duration({ description: 'Ban süresi (örn. 1g, 30dk)', optional: true }),
    sebep: arg.text({ description: 'Ban sebebi', optional: true }),
  },
  async run(ctx, args) {
    const { user } = await ensureCanPunish(ctx, args.kullanici);
    const record = await mod().punishments.punish({
      type: 'ban',
      userId: args.kullanici,
      staffId: ctx.user.id,
      staffLevel: ctx.level,
      reason: args.sebep,
      durationMs: args.sure ?? null,
    });
    await ctx.reply({ embeds: [punishmentDone(record, user)] });
  },
});
