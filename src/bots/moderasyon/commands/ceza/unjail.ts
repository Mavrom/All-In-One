import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { revokeAndReply } from '#services/PunishCommands.js';

/** `/unjail` ve `.unjail`: aktif jail cezasını iptal eder ve kayıtlı rolleri geri verir. */
export default defineCommand({
  name: 'unjail',
  description: 'Bir kullanıcıyı cezalıdan çıkarır.',
  level: Level.Mid,
  args: {
    kullanici: arg.user({ description: 'Cezalıdan çıkarılacak kullanıcı' }),
    sebep: arg.text({ description: 'Kaldırma sebebi', optional: true }),
  },
  async run(ctx, args) {
    await revokeAndReply(ctx, 'jail', args.kullanici, args.sebep);
  },
});
