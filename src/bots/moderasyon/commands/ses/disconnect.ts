import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { Level } from '#services/PermissionService.js';
import { ensureCanPunish } from '#services/TargetService.js';
import { success } from '#utils/replies.js';

/** `/disconnect` ve `.disconnect` (alias `.dc`): bir kullanıcıyı ses kanalından çıkarır. */
export default defineCommand({
  name: 'disconnect',
  aliases: ['dc'],
  description: 'Bir kullanıcıyı ses kanalından çıkarır.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Sesten çıkarılacak kullanıcı' }),
  },
  async run(ctx, args) {
    const { member } = await ensureCanPunish(ctx, args.kullanici);
    if (!member?.voice.channelId) {
      throw new UserError('Kullanıcı bir ses kanalında değil.');
    }

    await member.voice.disconnect(`${ctx.user.tag} tarafından`);
    await ctx.reply({ embeds: [success(`<@${member.id}> sesten çıkarıldı.`)] });
  },
});
