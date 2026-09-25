import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { voiceChannelOrOwn } from '#services/ChannelActions.js';
import { Level } from '#services/PermissionService.js';
import { success } from '#utils/replies.js';

/** `/disconnectall` ve `.disconnectall`: bir ses kanalındaki herkesi sesten çıkarır. */
export default defineCommand({
  name: 'disconnectall',
  description: 'Bir ses kanalındaki herkesi sesten çıkarır.',
  level: Level.Mid,
  args: {
    kanal: arg.channel({ description: 'Ses kanalı (boşsa bulunduğun kanal)', optional: true }),
  },
  async run(ctx, args) {
    const channel = voiceChannelOrOwn(ctx, args.kanal);
    const members = [...channel.members.values()].filter((m) => m.id !== ctx.user.id);
    if (members.length === 0) {
      throw new UserError('Kanalda çıkarılacak kimse yok.');
    }

    let done = 0;
    for (const member of members) {
      try {
        await member.voice.disconnect(`${ctx.user.tag} tarafından (toplu çıkarma)`);
        done += 1;
      } catch {
        // Çıkarılamayan üye atlanır; toplam sonuçta görünür.
      }
    }

    await ctx.reply({
      embeds: [success(`<#${channel.id}> kanalından ${done}/${members.length} kişi çıkarıldı.`)],
    });
  },
});
