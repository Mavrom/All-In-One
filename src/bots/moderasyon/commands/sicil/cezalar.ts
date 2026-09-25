import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import type { PunishmentType } from '#models/Punishment.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { linePages, paginate } from '#utils/paginate.js';
import { PUNISHMENT_LABELS, punishmentLine } from '#utils/punishment.js';

const ACTIVE_TYPES = ['ban', 'mute', 'chatmute', 'voicemute', 'jail'] as const;

/** `/cezalar` ve `.cezalar`: aktif cezaları (isteğe bağlı olarak türe göre) listeler. */
export default defineCommand({
  name: 'cezalar',
  description: 'Aktif cezaları listeler.',
  level: Level.Mid,
  args: {
    tur: arg.string({ description: 'Ceza türü', choices: ACTIVE_TYPES, optional: true }),
  },
  async run(ctx, args) {
    const type = args.tur as PunishmentType | undefined;
    const records = await mod().punishments.listActive(type);
    if (records.length === 0) {
      await ctx.reply('Aktif ceza yok.');
      return;
    }

    const title = type ? `Aktif ${PUNISHMENT_LABELS[type]} cezaları` : 'Aktif cezalar';
    const lines = records.map((r) => `<@${r.userId}> ${punishmentLine(r)}`);
    await paginate(ctx, linePages(`${title} (${records.length})`, lines));
  },
});
