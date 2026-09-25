import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { requireVoiceChannel, voiceChannelOrOwn } from '#services/ChannelActions.js';
import { Level } from '#services/PermissionService.js';
import { success } from '#utils/replies.js';

/** `/moveall` ve `.moveall`: bir ses kanalındaki herkesi başka bir ses kanalına taşır. */
export default defineCommand({
  name: 'moveall',
  description: 'Bir ses kanalındaki herkesi başka kanala taşır.',
  level: Level.Mid,
  args: {
    hedef: arg.channel({ description: 'Hedef ses kanalı' }),
    kaynak: arg.channel({
      description: 'Kaynak ses kanalı (boşsa bulunduğun kanal)',
      optional: true,
    }),
  },
  async run(ctx, args) {
    const target = requireVoiceChannel(ctx, args.hedef);
    const source = voiceChannelOrOwn(ctx, args.kaynak);
    if (source.id === target.id) {
      throw new UserError('Kaynak ve hedef kanal aynı.');
    }

    const members = [...source.members.values()];
    if (members.length === 0) {
      throw new UserError('Kaynak kanalda kimse yok.');
    }

    let moved = 0;
    for (const member of members) {
      try {
        await member.voice.setChannel(target, `${ctx.user.tag} tarafından (toplu taşıma)`);
        moved += 1;
      } catch {
        // Taşınamayan üye (yetki/izin) atlanır; toplam sonuçta görünür.
      }
    }

    await ctx.reply({
      embeds: [
        success(`${moved}/${members.length} kişi <#${source.id}> → <#${target.id}> taşındı.`),
      ],
    });
  },
});
