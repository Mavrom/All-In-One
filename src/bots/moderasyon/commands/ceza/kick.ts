import { arg } from '#core/commands/args.js';
import { defineCommand } from '#core/commands/define.js';
import { Level } from '#services/PermissionService.js';
import { mod } from '../../services.js';
import { ensureCanPunish } from '../../target.js';
import { punishmentDone } from '../../ui.js';

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
