import { defineEvent } from '#core/events.js';
import { modIfReady } from '#services/ModServices.js';
import { messageDeleteEmbed } from '#utils/eventLogs.js';

/** Silinen mesajları `mesaj-log`'a yazar; bot mesajları loglanmaz. */
export default defineEvent({
  name: 'messageDelete',
  async run(bot, message) {
    const services = modIfReady();
    if (!services || message.guildId !== bot.guild.id || message.author?.bot) return;

    await services.logs.send('mesajLog', {
      embeds: [
        messageDeleteEmbed({
          authorId: message.author?.id ?? null,
          authorTag: message.author?.tag ?? null,
          channelId: message.channelId,
          content: message.content ?? null,
          attachments: [...message.attachments.values()].map((a) => a.url),
        }),
      ],
    });
  },
});
