import type { User } from 'discord.js';
import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { revokeDone, success } from '#utils/replies.js';

/**
 * `/unban` ve `.unban`: bir kullanıcının banını kaldırır. Kayıtlı aktif bir ban cezası varsa
 * `PunishmentService.revoke` ile iptal edilir; kayıt yoksa ama kullanıcı Discord'da banlıysa
 * (örn. Discord üzerinden manuel banlanmış) doğrudan `guild.bans.remove` ile kaldırılır.
 */
export default defineCommand({
  name: 'unban',
  description: 'Bir kullanıcının banını kaldırır.',
  level: Level.High,
  args: {
    kullanici: arg.user({ description: 'Banı kaldırılacak kullanıcı' }),
    sebep: arg.text({ description: 'Kaldırma sebebi', optional: true }),
  },
  async run(ctx, args) {
    let user: User;
    try {
      user = await ctx.bot.client.users.fetch(args.kullanici);
    } catch {
      throw new UserError('Kullanıcı bulunamadı.');
    }

    const active = await mod().punishments.findActive(args.kullanici, 'ban');
    if (active) {
      const record = await mod().punishments.revoke(
        { userId: args.kullanici, type: 'ban' },
        ctx.user.id,
        args.sebep,
      );
      await ctx.reply({ embeds: [revokeDone(record, user)] });
      return;
    }

    try {
      await ctx.guild.bans.fetch(args.kullanici);
    } catch {
      throw new UserError('Bu kullanıcı banlı değil.');
    }

    await ctx.guild.bans.remove(args.kullanici, args.sebep);
    await ctx.reply({ embeds: [success('Ban kaldırıldı (kayıtlı bir ceza yoktu).')] });
  },
});
