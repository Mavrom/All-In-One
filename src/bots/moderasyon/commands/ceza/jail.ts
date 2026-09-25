import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { punishAndReply } from '#services/PunishCommands.js';

/** `/jail` ve `.jail` (alias `.cezalı`): kullanıcının rollerini alıp kaydeder ve `Cezalı` rolünü verir. */
export default defineCommand({
  name: 'jail',
  aliases: ['cezalı'],
  description: 'Bir kullanıcıyı cezalıya atar.',
  level: Level.Mid,
  args: {
    kullanici: arg.user({ description: 'Cezalıya atılacak kullanıcı' }),
    sure: arg.duration({ description: 'Süre (örn. 1g); boşsa süresiz', optional: true }),
    sebep: arg.text({ description: 'Ceza sebebi', optional: true }),
  },
  async run(ctx, args) {
    await punishAndReply(ctx, 'jail', args.kullanici, {
      durationMs: args.sure ?? null,
      reason: args.sebep,
    });
  },
});
