import { defineEvent } from '#core/events.js';
import { modIfReady } from '#services/ModServices.js';
import { embed } from '#utils/embed.js';
import { userChangeLines } from '#utils/eventLogs.js';

/** Sunucu üyelerinin kullanıcı adı ve görünen ad değişikliklerini `üye-log`'a yazar. */
export default defineEvent({
  name: 'userUpdate',
  async run(bot, before, after) {
    const services = modIfReady();
    if (!services || before.partial || !bot.guild.members.cache.has(after.id)) return;

    const lines = userChangeLines(after.id, before, after);
    if (lines.length === 0) return;

    await services.logs.send('uyeLog', {
      embeds: [embed('info').setDescription(lines.join('\n'))],
    });
  },
});
