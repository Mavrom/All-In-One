import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { revokeAndReply } from '#services/PunishCommands.js';

/** `/unvoicemute` ve `.unvoicemute`: aktif voice mute cezasını iptal eder. */
export default defineCommand({
  name: 'unvoicemute',
  description: 'Bir kullanıcının voice mute cezasını kaldırır.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Cezası kaldırılacak kullanıcı' }),
    sebep: arg.text({ description: 'Kaldırma sebebi', optional: true }),
  },
  async run(ctx, args) {
    await revokeAndReply(ctx, 'voicemute', args.kullanici, args.sebep);
  },
});
