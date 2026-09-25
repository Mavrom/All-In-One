import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { punishAndReply } from '#services/PunishCommands.js';

/** `/mute` ve `.mute` (alias `.sustur`): Discord zaman aşımı (timeout) uygular; süre zorunludur. */
export default defineCommand({
  name: 'mute',
  aliases: ['sustur'],
  description: 'Bir kullanıcıya Discord zaman aşımı uygular.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Susturulacak kullanıcı' }),
    sure: arg.duration({ description: 'Süre (en fazla 28g, örn. 10dk)' }),
    sebep: arg.text({ description: 'Ceza sebebi', optional: true }),
  },
  async run(ctx, args) {
    await punishAndReply(ctx, 'mute', args.kullanici, {
      durationMs: args.sure,
      reason: args.sebep,
    });
  },
});
