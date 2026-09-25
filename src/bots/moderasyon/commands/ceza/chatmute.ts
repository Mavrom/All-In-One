import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { punishAndReply } from '#services/PunishCommands.js';

/** `/chatmute` ve `.chatmute`: `Chat Mute` rolünü verir. */
export default defineCommand({
  name: 'chatmute',
  description: 'Bir kullanıcının yazı kanallarında yazmasını engeller.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Susturulacak kullanıcı' }),
    sure: arg.duration({ description: 'Süre (örn. 1sa); boşsa süresiz', optional: true }),
    sebep: arg.text({ description: 'Ceza sebebi', optional: true }),
  },
  async run(ctx, args) {
    await punishAndReply(ctx, 'chatmute', args.kullanici, {
      durationMs: args.sure ?? null,
      reason: args.sebep,
    });
  },
});
