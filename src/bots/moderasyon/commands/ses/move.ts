import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { requireVoiceChannel } from '#services/ChannelActions.js';
import { Level } from '#services/PermissionService.js';
import { ensureCanPunish } from '#services/TargetService.js';
import { success } from '#utils/replies.js';

/** `/move` ve `.move` (alias `.taşı`): bir kullanıcıyı başka bir ses kanalına taşır. */
export default defineCommand({
  name: 'move',
  aliases: ['taşı'],
  description: 'Bir kullanıcıyı başka bir ses kanalına taşır.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Taşınacak kullanıcı' }),
    kanal: arg.channel({ description: 'Hedef ses kanalı' }),
  },
  async run(ctx, args) {
    const target = requireVoiceChannel(ctx, args.kanal);
    const { member } = await ensureCanPunish(ctx, args.kullanici);
    if (!member?.voice.channelId) {
      throw new UserError('Kullanıcı bir ses kanalında değil.');
    }

    await member.voice.setChannel(target, `${ctx.user.tag} tarafından`);
    await ctx.reply({ embeds: [success(`<@${member.id}> → <#${target.id}> taşındı.`)] });
  },
});
