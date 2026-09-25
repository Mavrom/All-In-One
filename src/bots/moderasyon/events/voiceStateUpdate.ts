import type { VoiceState } from 'discord.js';
import { defineEvent } from '#core/events.js';
import { modIfReady } from '#services/ModServices.js';
import { embed } from '#utils/embed.js';
import { type VoiceSnapshot, voiceChangeLines } from '#utils/eventLogs.js';

function snapshot(state: VoiceState): VoiceSnapshot {
  return {
    channelId: state.channelId,
    serverMute: state.serverMute ?? false,
    serverDeaf: state.serverDeaf ?? false,
  };
}

/** Ses giriş/çıkış/kanal değişikliği ve sunucu susturma/sağırlaştırmalarını `ses-log`'a yazar. */
export default defineEvent({
  name: 'voiceStateUpdate',
  async run(bot, before, after) {
    const services = modIfReady();
    if (!services || after.guild.id !== bot.guild.id) return;
    if (after.member?.user.bot) return;

    const lines = voiceChangeLines(after.id, snapshot(before), snapshot(after));
    if (lines.length === 0) return;

    await services.logs.send('sesLog', {
      embeds: [embed('info').setDescription(lines.join('\n'))],
    });
  },
});
