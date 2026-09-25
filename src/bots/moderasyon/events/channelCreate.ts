import { defineEvent } from '#core/events.js';
import { applyPunishmentOverwrites, punishmentRoleIds } from '#utils/punishmentRoles.js';

/** Sonradan açılan kanallara ceza rollerinin izinlerini otomatik uygular. */
export default defineEvent({
  name: 'channelCreate',
  async run(bot, channel) {
    if (channel.guild.id !== bot.guild.id) return;

    const settings = bot.settings.genel;
    const roles = punishmentRoleIds(settings);
    if (!roles.cezali && !roles.chatmute && !roles.voicemute) return;

    await applyPunishmentOverwrites(
      channel,
      roles,
      settings.get<string | null>('kanal.jail') ?? null,
    );
  },
});
