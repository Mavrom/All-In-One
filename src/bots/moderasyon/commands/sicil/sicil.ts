import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { linePages, paginate } from '#utils/paginate.js';
import { punishmentLine } from '#utils/punishment.js';

/** `/sicil` ve `.sicil`: bir kullanıcının tüm ceza geçmişini sayfalı gösterir. */
export default defineCommand({
  name: 'sicil',
  description: 'Bir kullanıcının ceza geçmişini gösterir.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Sicili gösterilecek kullanıcı' }),
  },
  async run(ctx, args) {
    const records = await mod().punishments.listByUser(args.kullanici);
    if (records.length === 0) {
      await ctx.reply(`<@${args.kullanici}> kullanıcısının sicili temiz.`);
      return;
    }

    const active = records.filter((r) => r.status === 'active' && r.type !== 'kick').length;
    await paginate(
      ctx,
      linePages(`Sicil (${records.length} kayıt)`, records.map(punishmentLine), {
        header: `<@${args.kullanici}> • Aktif ceza: ${active}`,
      }),
    );
  },
});
