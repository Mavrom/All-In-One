import { ChannelType, type OverwriteResolvable, PermissionFlagsBits } from 'discord.js';
import { defineCommand } from '#core/define.js';
import { LOG_CHANNELS, type LogChannelKey } from '#services/LogService.js';
import { Level } from '#services/PermissionService.js';
import { embed } from '#utils/embed.js';

const CATEGORY_NAME = '📁 Loglar';

/**
 * `/logkur` ve `.logkur`: `📁 Loglar` kategorisini ve log kanallarını açar, ID'lerini kaydeder.
 * Kategori yalnızca sunucu sahibi, yüksek yetki rolü ve bot tarafından görülür. Tekrar
 * çalıştırılırsa yalnızca eksik kanalları açar.
 */
export default defineCommand({
  name: 'logkur',
  description: 'Log kategorisini ve kanallarını kurar.',
  level: Level.Owner,
  async run(ctx) {
    await ctx.defer();
    const { guild } = ctx;
    const settings = ctx.bot.settings.genel;
    const report: string[] = [];

    let categoryId = settings.get<string | null>('kategori.log') ?? null;
    if (categoryId && guild.channels.cache.get(categoryId)?.type === ChannelType.GuildCategory) {
      report.push(`✅ **${CATEGORY_NAME}** kategorisi zaten var`);
    } else {
      const overwrites: OverwriteResolvable[] = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: guild.members.me?.id ?? ctx.bot.client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ];
      const highRoleId = settings.get<string | null>('yetki.yuksek');
      if (highRoleId && guild.roles.cache.has(highRoleId)) {
        overwrites.push({ id: highRoleId, allow: [PermissionFlagsBits.ViewChannel] });
      }
      const category = await guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        permissionOverwrites: overwrites,
        reason: 'Log kurulumu',
      });
      categoryId = category.id;
      await settings.set('kategori.log', categoryId, ctx.user.id);
      report.push(`🆕 **${CATEGORY_NAME}** kategorisi oluşturuldu`);
    }

    for (const [key, name] of Object.entries(LOG_CHANNELS) as [LogChannelKey, string][]) {
      const settingKey = `kanal.${key}`;
      const existingId = settings.get<string | null>(settingKey);
      if (existingId && guild.channels.cache.has(existingId)) {
        report.push(`✅ <#${existingId}> zaten var`);
        continue;
      }
      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: categoryId,
        reason: 'Log kurulumu',
      });
      await settings.set(settingKey, channel.id, ctx.user.id);
      report.push(`🆕 ${channel} oluşturuldu`);
    }

    await ctx.reply({
      embeds: [embed('success').setTitle('Log kurulumu').setDescription(report.join('\n'))],
    });
  },
});
