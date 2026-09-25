import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { Level } from '#services/PermissionService.js';
import { slowmodeSeconds } from '#utils/channelTools.js';
import { formatDuration } from '#utils/duration.js';
import { success } from '#utils/replies.js';

/** `/slowmode` ve `.slowmode` (alias `.yavaşmod`): kanalın yavaş modunu ayarlar veya kapatır. */
export default defineCommand({
  name: 'slowmode',
  aliases: ['yavaşmod'],
  description: 'Kanalın yavaş modunu ayarlar (0 = kapat).',
  level: Level.Mid,
  args: {
    sure: arg.string({ description: 'Süre (örn. 10sn, 1dk; en fazla 6sa) veya 0' }),
    kanal: arg.channel({ description: 'Kanal (boşsa bu kanal)', optional: true }),
  },
  async run(ctx, args) {
    const seconds = slowmodeSeconds(args.sure);
    if (seconds === null) {
      throw new UserError(
        'Geçersiz süre. Örnek: `10sn`, `1dk`, en fazla `6sa`; kapatmak için `0`.',
      );
    }

    const channel = args.kanal ? ctx.guild.channels.cache.get(args.kanal) : ctx.channel;
    if (!channel?.isTextBased() || !('setRateLimitPerUser' in channel)) {
      throw new UserError('Bu kanalda yavaş mod ayarlanamaz.');
    }

    await channel.setRateLimitPerUser(seconds, `${ctx.user.tag} tarafından`);
    const text =
      seconds === 0
        ? `<#${channel.id}> kanalında yavaş mod kapatıldı.`
        : `<#${channel.id}> kanalında yavaş mod **${formatDuration(seconds * 1000)}** yapıldı.`;
    await ctx.reply({ embeds: [success(text)] });
  },
});
