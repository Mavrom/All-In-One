import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { purgeAndReply } from '#services/ChannelActions.js';
import { Level } from '#services/PermissionService.js';
import { hasLink } from '#utils/channelTools.js';

/** `/clearlinks` ve `.clearlinks`: kanaldaki bağlantı içeren mesajları siler. */
export default defineCommand({
  name: 'clearlinks',
  description: 'Kanaldaki bağlantı içeren mesajları siler.',
  level: Level.Low,
  args: {
    sayi: arg.number({
      description: 'En fazla kaç mesaj (1-100, varsayılan 100)',
      integer: true,
      min: 1,
      max: 100,
      optional: true,
    }),
  },
  async run(ctx, args) {
    await purgeAndReply(ctx, args.sayi ?? 100, (m) => hasLink(m.content), 'bağlantılı mesaj');
  },
});
