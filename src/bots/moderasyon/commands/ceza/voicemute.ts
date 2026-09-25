import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { punishAndReply } from '#services/PunishCommands.js';

/** `/voicemute` ve `.voicemute`: `Voice Mute` rolünü verir; kullanıcı sesteyse anında susturur. */
export default defineCommand({
  name: 'voicemute',
  description: 'Bir kullanıcının ses kanallarında konuşmasını engeller.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Susturulacak kullanıcı' }),
    sure: arg.duration({ description: 'Süre (örn. 1sa); boşsa süresiz', optional: true }),
    sebep: arg.text({ description: 'Ceza sebebi', optional: true }),
  },
  async run(ctx, args) {
    await punishAndReply(ctx, 'voicemute', args.kullanici, {
      durationMs: args.sure ?? null,
      reason: args.sebep,
    });
  },
});
