import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { punishAndReply } from '#services/PunishCommands.js';

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
    await punishAndReply(ctx, 'kick', args.kullanici, { durationMs: null, reason: args.sebep });
  },
});
