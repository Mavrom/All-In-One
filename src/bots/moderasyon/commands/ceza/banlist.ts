import type { EmbedBuilder } from 'discord.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { embed } from '#utils/embed.js';
import { paginate } from '#utils/paginate.js';

const PAGE_SIZE = 10;

/** `/banlist` ve `.banlist` (alias `.banlar`): sunucudaki banlı kullanıcıları sayfalı listeler. */
export default defineCommand({
  name: 'banlist',
  aliases: ['banlar'],
  description: 'Sunucudaki banlı kullanıcıları listeler.',
  level: Level.High,
  async run(ctx) {
    const bans = [...(await ctx.guild.bans.fetch()).values()];
    if (bans.length === 0) {
      await ctx.reply('Banlı kullanıcı yok.');
      return;
    }

    const lines = bans.map(
      (ban) => `**${ban.user.tag}** (\`${ban.user.id}\`) — ${ban.reason ?? 'Sebep yok'}`,
    );

    const pages: EmbedBuilder[] = [];
    for (let i = 0; i < lines.length; i += PAGE_SIZE) {
      const chunk = lines.slice(i, i + PAGE_SIZE);
      pages.push(
        embed('info')
          .setTitle(`Banlı kullanıcılar (${bans.length})`)
          .setDescription(chunk.join('\n')),
      );
    }

    await paginate(ctx, pages);
  },
});
