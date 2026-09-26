import type { GuildMember, PartialGuildMember } from 'discord.js';
import { defineEvent } from '#core/events.js';
import { activeJobRole } from '#services/BulkRole.js';
import { modIfReady } from '#services/ModServices.js';
import { embed } from '#utils/embed.js';
import { type MemberSnapshot, memberChangeLines } from '#utils/eventLogs.js';

function snapshot(
  member: GuildMember | PartialGuildMember,
  ignoredRole: string | null,
): MemberSnapshot {
  return {
    nickname: member.nickname,
    roleIds: member.roles.cache
      .filter((role) => role.id !== member.guild.id && role.id !== ignoredRole)
      .map((role) => role.id),
  };
}

/**
 * Takma ad ve rol değişikliklerini `üye-log`'a yazar; önceki durumu bilinmeyenler atlanır.
 * Toplu rol sürerken o rolün değişiklikleri yazılmaz (bitince tek özet yazılır).
 */
export default defineEvent({
  name: 'guildMemberUpdate',
  async run(bot, before, after) {
    const services = modIfReady();
    if (!services || after.guild.id !== bot.guild.id || before.partial) return;

    const bulkRole = activeJobRole(after.guild.id);
    const lines = memberChangeLines(
      after.id,
      snapshot(before, bulkRole),
      snapshot(after, bulkRole),
    );
    if (lines.length === 0) return;

    await services.logs.send('uyeLog', {
      embeds: [embed('info').setDescription(lines.join('\n'))],
    });
  },
});
