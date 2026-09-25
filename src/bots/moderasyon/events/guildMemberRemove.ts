import { defineEvent } from '#core/events.js';
import { modIfReady } from '#services/ModServices.js';
import { memberLeaveEmbed } from '#utils/eventLogs.js';

/** Sunucudan ayrılan üyeyi rolleriyle birlikte `üye-log`'a yazar. */
export default defineEvent({
  name: 'guildMemberRemove',
  async run(bot, member) {
    const services = modIfReady();
    if (!services || member.guild.id !== bot.guild.id) return;

    await services.logs.send('uyeLog', {
      embeds: [
        memberLeaveEmbed({
          userId: member.id,
          tag: member.user.tag,
          joinedAt: member.joinedAt,
          roleIds: member.roles.cache
            .filter((role) => role.id !== member.guild.id)
            .map((role) => role.id),
        }),
      ],
    });
  },
});
