import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { purgeAndReply } from '#services/ChannelActions.js';
import { Level } from '#services/PermissionService.js';

/** `/clear` ve `.clear` (alias `.sil`, `.temizle`): kanaldaki son mesajları siler. */
export default defineCommand({
  name: 'clear',
  aliases: ['sil', 'temizle'],
  description: 'Kanaldaki son mesajları siler.',
  level: Level.Low,
  args: {
    sayi: arg.number({
      description: 'Silinecek mesaj sayısı (1-100)',
      integer: true,
      min: 1,
      max: 100,
    }),
  },
  async run(ctx, args) {
    await purgeAndReply(ctx, args.sayi, () => true, 'mesaj');
  },
});
