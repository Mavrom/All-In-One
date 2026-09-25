import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { assertAssignableRole } from '#services/AutoRole.js';
import { Level } from '#services/PermissionService.js';
import { success } from '#utils/replies.js';

/**
 * `/otorol` ve `.otorol`: sunucuya katılan üyelere otomatik verilecek rolü ayarlar; isteğe
 * bağlı olarak botlara ayrı bir rol verilebilir. Aktif jail cezasıyla dönenlere verilmez.
 */
export default defineCommand({
  name: 'otorol',
  description: 'Yeni üyelere otomatik verilecek rolü ayarlar.',
  level: Level.High,
  args: {
    rol: arg.role({ description: 'Üyelere verilecek rol' }),
    botrol: arg.role({ description: 'Botlara verilecek rol (isteğe bağlı)', optional: true }),
  },
  async run(ctx, args) {
    const role = assertAssignableRole(ctx, args.rol);
    const botRole = args.botrol ? assertAssignableRole(ctx, args.botrol) : null;

    await ctx.bot.settings.bot.set('otorol.uye', role.id, ctx.user.id);
    await ctx.bot.settings.bot.set('otorol.bot', botRole?.id ?? null, ctx.user.id);

    const text = botRole
      ? `Otorol ayarlandı: üyeler <@&${role.id}>, botlar <@&${botRole.id}> alacak.`
      : `Otorol ayarlandı: yeni üyeler <@&${role.id}> alacak.`;
    await ctx.reply({ embeds: [success(text)] });
  },
});
