import { defineEvent } from '#core/events.js';
import { giveAutoRole } from '#services/AutoRole.js';
import { modIfReady } from '#services/ModServices.js';
import { memberJoinEmbed } from '#utils/eventLogs.js';

/**
 * Yeni üye: `üye-log`'a yazar, çık-gir korumasıyla aktif cezaları yeniden uygular ve otorolü
 * verir. Aktif jail cezasıyla dönen üyeye otorol verilmez.
 */
export default defineEvent({
  name: 'guildMemberAdd',
  async run(bot, member) {
    const services = modIfReady();
    if (!services || member.guild.id !== bot.guild.id) return;

    await services.logs.send('uyeLog', {
      embeds: [
        memberJoinEmbed({
          userId: member.id,
          tag: member.user.tag,
          createdAt: member.user.createdAt,
          memberCount: member.guild.memberCount,
        }),
      ],
    });

    if (!member.user.bot) {
      const reapplied = await services.punishments.handleRejoin(member.id);
      if (reapplied.some((record) => record.type === 'jail')) return;
    }

    try {
      await giveAutoRole(member, bot.settings.bot);
    } catch (error) {
      bot.logger.warn({ err: error, userId: member.id }, 'Otorol verilemedi');
    }
  },
});
