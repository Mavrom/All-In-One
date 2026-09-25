import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import { success } from '#utils/replies.js';

/** `/otorolkapat` ve `.otorolkapat`: otorolü kapatır. */
export default defineCommand({
  name: 'otorolkapat',
  description: 'Otorolü kapatır.',
  level: Level.Owner,
  async run(ctx) {
    await ctx.bot.settings.bot.set('otorol.uye', null, ctx.user.id);
    await ctx.bot.settings.bot.set('otorol.bot', null, ctx.user.id);
    await ctx.reply({ embeds: [success('Otorol kapatıldı.')] });
  },
});
