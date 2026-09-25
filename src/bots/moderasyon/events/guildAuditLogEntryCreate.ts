import { defineEvent } from '#core/events.js';
import { modIfReady } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { auditAction } from '#utils/eventLogs.js';

/**
 * Discord arayüzünden (sağ tık) yapılan ban/unban/kick/timeout işlemlerini `source = discord`
 * ile ceza kaydına işler. Botun kendi işlemleri zaten komutla kaydedildiği için atlanır.
 */
export default defineEvent({
  name: 'guildAuditLogEntryCreate',
  async run(bot, entry, guild) {
    const services = modIfReady();
    if (!services || guild.id !== bot.guild.id) return;
    if (!entry.executorId || entry.executorId === bot.client.user.id || !entry.targetId) return;

    const action = auditAction(entry);
    if (!action) return;

    const reason = entry.reason ?? undefined;
    if (action.kind === 'punish') {
      await services.punishments.punish({
        type: action.type,
        userId: entry.targetId,
        staffId: entry.executorId,
        staffLevel: Level.None,
        reason,
        durationMs: action.durationMs ?? null,
        source: 'discord',
      });
      return;
    }

    if (await services.punishments.findActive(entry.targetId, action.type)) {
      await services.punishments.revoke(
        { userId: entry.targetId, type: action.type },
        entry.executorId,
        reason,
        { skipAction: true },
      );
    }
  },
});
