import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { punishAndReply } from '#services/PunishCommands.js';

/** `/warn` ve `.warn` (alias `.uyar`): yalnızca kayıt oluşturur ve kullanıcıya DM gönderir. */
export default defineCommand({
  name: 'warn',
  aliases: ['uyar'],
  description: 'Bir kullanıcıyı uyarır.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Uyarılacak kullanıcı' }),
    sebep: arg.text({ description: 'Uyarı sebebi' }),
  },
  async run(ctx, args) {
    await punishAndReply(ctx, 'warn', args.kullanici, { durationMs: null, reason: args.sebep });
  },
});
