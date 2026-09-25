import { PermissionFlagsBits } from 'discord.js';
import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { Level } from '#services/PermissionService.js';
import { success } from '#utils/replies.js';

/**
 * `/kilit` ve `.kilit`: kanalı kilitler ya da kilidini açar. Kilitliyken `@everyone` mesaj
 * gönderemez; tekrar çalıştırılınca eski haline döner.
 */
export default defineCommand({
  name: 'kilit',
  aliases: ['lock'],
  description: 'Kanalı kilitler veya kilidini açar.',
  level: Level.Mid,
  args: {
    kanal: arg.channel({ description: 'Kanal (boşsa bu kanal)', optional: true }),
  },
  async run(ctx, args) {
    const channel = args.kanal ? ctx.guild.channels.cache.get(args.kanal) : ctx.channel;
    if (!channel || channel.isThread() || !('permissionOverwrites' in channel)) {
      throw new UserError('Bu kanal kilitlenemez.');
    }

    const everyone = ctx.guild.roles.everyone.id;
    const locked =
      channel.permissionOverwrites.cache
        .get(everyone)
        ?.deny.has(PermissionFlagsBits.SendMessages) ?? false;

    await channel.permissionOverwrites.edit(
      everyone,
      { SendMessages: locked ? null : false },
      { reason: `${ctx.user.tag} tarafından` },
    );
    await ctx.reply({
      embeds: [success(`<#${channel.id}> ${locked ? 'kilidi açıldı 🔓' : 'kilitlendi 🔒'}`)],
    });
  },
});
