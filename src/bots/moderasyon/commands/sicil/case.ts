import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { PUNISHMENT_LABELS, punishmentEmbed } from '#utils/punishment.js';

/** `/case` ve `.case` (alias `.ceza`): tek bir ceza kaydının ayrıntılarını gösterir. */
export default defineCommand({
  name: 'case',
  aliases: ['ceza'],
  description: 'Bir ceza kaydının ayrıntılarını gösterir.',
  level: Level.Low,
  args: {
    ceza: arg.number({ description: 'Ceza numarası', integer: true, min: 1 }),
  },
  async run(ctx, args) {
    const record = await mod().punishments.findCase(args.ceza);
    if (!record) {
      throw new UserError(`#${args.ceza} numaralı ceza bulunamadı.`);
    }
    await ctx.reply({
      embeds: [punishmentEmbed(record, `${PUNISHMENT_LABELS[record.type]} cezası`)],
    });
  },
});
