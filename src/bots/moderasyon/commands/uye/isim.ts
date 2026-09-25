import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { Level } from '#services/PermissionService.js';
import { ensureCanPunish } from '#services/TargetService.js';
import { success } from '#utils/replies.js';

const MAX_NICKNAME = 32;

/** `/isim` ve `.isim`: bir kullanıcının sunucu takma adını değiştirir; isim boşsa sıfırlar. */
export default defineCommand({
  name: 'isim',
  aliases: ['nick'],
  description: 'Bir kullanıcının sunucudaki ismini değiştirir.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'İsmi değiştirilecek kullanıcı' }),
    isim: arg.text({ description: 'Yeni isim (boşsa sıfırlanır)', optional: true }),
  },
  async run(ctx, args) {
    const nickname = args.isim?.trim() || null;
    if (nickname && nickname.length > MAX_NICKNAME) {
      throw new UserError(`İsim en fazla ${MAX_NICKNAME} karakter olabilir.`);
    }

    const { member } = await ensureCanPunish(ctx, args.kullanici);
    if (!member) {
      throw new UserError('Kullanıcı sunucuda değil.');
    }

    await member.setNickname(nickname, `${ctx.user.tag} tarafından`);
    await ctx.reply({
      embeds: [
        success(
          nickname
            ? `<@${member.id}> kullanıcısının ismi **${nickname}** yapıldı.`
            : `<@${member.id}> kullanıcısının ismi sıfırlandı.`,
        ),
      ],
    });
  },
});
