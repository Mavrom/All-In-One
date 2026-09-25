import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { ensureCanPunish } from '#services/TargetService.js';
import { punishmentDone } from '#utils/replies.js';

/** `/kick` ve `.kick` (alias `.at`): bir kullanıcıyı sunucudan atar. */
export default defineCommand({
  name: 'kick',
  aliases: ['at'],
  description: 'Bir kullanıcıyı sunucudan atar.',
  level: Level.Mid,
  args: {
    kullanici: arg.user({ description: 'Atılacak kullanıcı' }),
    sebep: arg.text({ description: 'Kick sebebi', optional: true }),
  },
  async run(ctx, args) {
    const { user } = await ensureCanPunish(ctx, args.kullanici);
    const record = await mod().punishments.punish({
      type: 'kick',
      userId: args.kullanici,
      staffId: ctx.user.id,
      staffLevel: ctx.level,
      reason: args.sebep,
      durationMs: null,
    });
    await ctx.reply({ embeds: [punishmentDone(record, user)] });
  },
});
