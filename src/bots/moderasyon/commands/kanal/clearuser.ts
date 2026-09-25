import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { purgeAndReply } from '#services/ChannelActions.js';
import { Level } from '#services/PermissionService.js';

/** `/clearuser` ve `.clearuser`: bir kullanıcının kanaldaki son mesajlarını siler. */
export default defineCommand({
  name: 'clearuser',
  description: 'Bir kullanıcının kanaldaki son mesajlarını siler.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Mesajları silinecek kullanıcı' }),
    sayi: arg.number({
      description: 'En fazla kaç mesaj (1-100, varsayılan 100)',
      integer: true,
      min: 1,
      max: 100,
      optional: true,
    }),
  },
  async run(ctx, args) {
    await purgeAndReply(ctx, args.sayi ?? 100, (m) => m.author.id === args.kullanici, 'mesaj');
  },
});
