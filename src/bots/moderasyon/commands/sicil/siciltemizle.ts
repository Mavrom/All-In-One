import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { success } from '#utils/replies.js';

/**
 * `/siciltemizle` ve `.siciltemizle`: bir kullanıcının iptal edilmemiş tüm kayıtlarını iptal
 * eder. Kayıtlar silinmez; sicilde üstü çizili görünür.
 */
export default defineCommand({
  name: 'siciltemizle',
  description: 'Bir kullanıcının tüm cezalarını iptal eder.',
  level: Level.High,
  args: {
    kullanici: arg.user({ description: 'Sicili temizlenecek kullanıcı' }),
    sebep: arg.text({ description: 'Temizleme sebebi', optional: true }),
  },
  async run(ctx, args) {
    const count = await mod().punishments.revokeAll(args.kullanici, ctx.user.id, args.sebep);
    if (count === 0) {
      throw new UserError('Bu kullanıcının iptal edilecek kaydı yok.');
    }
    await ctx.reply({
      embeds: [success(`<@${args.kullanici}> kullanıcısının ${count} kaydı iptal edildi.`)],
    });
  },
});
