import { defineEvent } from '#core/events.js';
import { modIfReady } from '#services/ModServices.js';

/** Çık-gir koruması: aktif jail/chatmute/voicemute cezası olan üyeye rolünü geri verir. */
export default defineEvent({
  name: 'guildMemberAdd',
  async run(bot, member) {
    const services = modIfReady();
    if (!services || member.guild.id !== bot.guild.id || member.user.bot) return;

    await services.punishments.handleRejoin(member.id);
  },
});
