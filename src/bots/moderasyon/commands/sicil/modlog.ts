import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import type { PunishmentType } from '#models/Punishment.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { linePages, paginate } from '#utils/paginate.js';
import { PUNISHMENT_LABELS, punishmentLine } from '#utils/punishment.js';

/** `/modlog` ve `.modlog`: bir yetkilinin verdiği cezaları ve türlere göre toplamları gösterir. */
export default defineCommand({
  name: 'modlog',
  description: 'Bir yetkilinin verdiği cezaları gösterir.',
  level: Level.Mid,
  args: {
    yetkili: arg.user({ description: 'Cezaları gösterilecek yetkili' }),
  },
  async run(ctx, args) {
    const records = await mod().punishments.listByStaff(args.yetkili);
    if (records.length === 0) {
      await ctx.reply(`<@${args.yetkili}> henüz ceza vermemiş.`);
      return;
    }

    const totals = new Map<PunishmentType, number>();
    for (const record of records) {
      totals.set(record.type, (totals.get(record.type) ?? 0) + 1);
    }
    const summary = [...totals]
      .map(([type, count]) => `${PUNISHMENT_LABELS[type]}: **${count}**`)
      .join(' • ');

    const lines = records.map((r) => `<@${r.userId}> ${punishmentLine(r)}`);
    await paginate(
      ctx,
      linePages(`Modlog (${records.length} ceza)`, lines, {
        header: `<@${args.yetkili}>\n${summary}`,
      }),
    );
  },
});
