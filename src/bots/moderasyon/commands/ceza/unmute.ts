import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { revokeAndReply } from '#services/PunishCommands.js';
import { fetchMember } from '#services/TargetService.js';
import { success } from '#utils/replies.js';

/**
 * `/unmute` ve `.unmute`: bir kullanıcının zaman aşımını kaldırır. Kayıtlı aktif bir mute varsa
 * iptal edilir; kayıt yoksa ama kullanıcı zaman aşımındaysa doğrudan kaldırılır.
 */
export default defineCommand({
  name: 'unmute',
  description: 'Bir kullanıcının zaman aşımını kaldırır.',
  level: Level.Low,
  args: {
    kullanici: arg.user({ description: 'Zaman aşımı kaldırılacak kullanıcı' }),
    sebep: arg.text({ description: 'Kaldırma sebebi', optional: true }),
  },
  async run(ctx, args) {
    if (await mod().punishments.findActive(args.kullanici, 'mute')) {
      await revokeAndReply(ctx, 'mute', args.kullanici, args.sebep);
      return;
    }

    const member = await fetchMember(ctx.guild, args.kullanici);
    if (!member?.isCommunicationDisabled()) {
      throw new UserError('Bu kullanıcı susturulmuş değil.');
    }

    await member.timeout(null, args.sebep);
    await ctx.reply({ embeds: [success('Zaman aşımı kaldırıldı (kayıtlı bir ceza yoktu).')] });
  },
});
