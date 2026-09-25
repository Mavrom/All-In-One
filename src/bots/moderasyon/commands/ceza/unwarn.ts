import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { revokeDone } from '#utils/replies.js';

/** `/unwarn` ve `.unwarn`: ceza numarasıyla verilen bir uyarıyı iptal eder. */
export default defineCommand({
  name: 'unwarn',
  description: 'Bir uyarıyı ceza numarasıyla iptal eder.',
  level: Level.Mid,
  args: {
    ceza: arg.number({ description: 'Uyarının ceza numarası', integer: true, min: 1 }),
    sebep: arg.text({ description: 'İptal sebebi', optional: true }),
  },
  async run(ctx, args) {
    const record = await mod().punishments.findCase(args.ceza);
    if (!record) {
      throw new UserError(`#${args.ceza} numaralı ceza bulunamadı.`);
    }
    if (record.type !== 'warn') {
      throw new UserError(`#${args.ceza} bir uyarı değil.`);
    }

    const revoked = await mod().punishments.revoke({ caseId: args.ceza }, ctx.user.id, args.sebep);
    const user = await ctx.bot.client.users.fetch(revoked.userId).catch(() => null);
    await ctx.reply({ embeds: [revokeDone(revoked, user?.tag ?? revoked.userId)] });
  },
});
