import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { punishAndReply } from '#services/PunishCommands.js';

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
    await punishAndReply(ctx, 'ban', args.kullanici, {
      durationMs: args.sure ?? null,
      reason: args.sebep,
    });
  },
});
