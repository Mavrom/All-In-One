import type { EmbedBuilder } from 'discord.js';
import { defineCommand } from '#core/define.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { embed } from '#utils/embed.js';
import { paginate } from '#utils/paginate.js';
import { truncate } from '#utils/text.js';

const PAGE_SIZE = 10;

/** `/jaillist` ve `.jaillist`: aktif jail cezalarını sayfalı listeler. */
export default defineCommand({
  name: 'jaillist',
  description: 'Cezalıdaki kullanıcıları listeler.',
  level: Level.Mid,
  async run(ctx) {
    const records = await mod().punishments.listActive('jail');
    if (records.length === 0) {
      await ctx.reply('Cezalıda kimse yok.');
      return;
    }

    const lines = records.map((record) => {
      const end = record.expiresAt
        ? `<t:${Math.floor(record.expiresAt.getTime() / 1000)}:R>`
        : 'süresiz';
      return `\`#${record.caseId}\` <@${record.userId}> — ${end} — ${truncate(record.reason, 60)}`;
    });

    const pages: EmbedBuilder[] = [];
    for (let i = 0; i < lines.length; i += PAGE_SIZE) {
      pages.push(
        embed('info')
          .setTitle(`Cezalıdakiler (${records.length})`)
          .setDescription(lines.slice(i, i + PAGE_SIZE).join('\n')),
      );
    }

    await paginate(ctx, pages);
  },
});
