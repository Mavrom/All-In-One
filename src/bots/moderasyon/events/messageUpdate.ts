import { defineEvent } from '#core/events.js';
import { modIfReady } from '#services/ModServices.js';
import { messageUpdateEmbed } from '#utils/eventLogs.js';

/** Düzenlenen mesajları eski/yeni içerikle `mesaj-log`'a yazar; bot mesajları loglanmaz. */
export default defineEvent({
  name: 'messageUpdate',
  async run(bot, before, after) {
    const services = modIfReady();
    if (!services || after.guildId !== bot.guild.id) return;

    const message = after.partial ? await after.fetch().catch(() => null) : after;
    if (!message || message.author.bot) return;
    // Yalnızca embed önizlemesi eklenen güncellemelerde içerik değişmez; bunları atla.
    if (before.content !== null && before.content === message.content) return;

    await services.logs.send('mesajLog', {
      embeds: [
        messageUpdateEmbed({
          authorId: message.author.id,
          authorTag: message.author.tag,
          channelId: message.channelId,
          url: message.url,
          before: before.content ?? null,
          after: message.content,
        }),
      ],
    });
  },
});
