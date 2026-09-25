import {
  ChannelType,
  type Guild,
  type OverwriteResolvable,
  PermissionFlagsBits,
  type Role,
} from 'discord.js';
import { defineCommand } from '#core/define.js';
import { Level } from '#services/PermissionService.js';
import type { SettingsService } from '#services/SettingsService.js';
import { embed } from '#utils/embed.js';
import {
  applyPunishmentOverwrites,
  PUNISHMENT_ROLES,
  punishmentRoleIds,
} from '#utils/punishmentRoles.js';

const JAIL_CHANNEL_NAME = 'cezalı';
const STAFF_KEYS = ['yetki.dusuk', 'yetki.orta', 'yetki.yuksek'] as const;

/** Ayardaki ID'ye ait rolü döner; ayar boşsa veya rol silinmişse `null`. */
function existingRole(guild: Guild, settings: SettingsService, key: string): Role | null {
  const id = settings.get<string | null>(key);
  return id ? (guild.roles.cache.get(id) ?? null) : null;
}

/**
 * `/kurulum` ve `.kurulum`: ceza rollerini ve `#cezalı` kanalını oluşturur, tüm kanallara ceza
 * rollerinin izinlerini uygular. Tekrar çalıştırılırsa yalnızca eksikleri oluşturur.
 */
export default defineCommand({
  name: 'kurulum',
  description: 'Ceza rollerini ve cezalı kanalını kurar.',
  level: Level.Owner,
  async run(ctx) {
    await ctx.defer();
    const { guild } = ctx;
    const settings = ctx.bot.settings.genel;
    const report: string[] = [];

    for (const spec of PUNISHMENT_ROLES) {
      if (existingRole(guild, settings, spec.key)) {
        report.push(`✅ **${spec.name}** rolü zaten var`);
        continue;
      }
      const role = await guild.roles.create({
        name: spec.name,
        color: spec.color,
        permissions: [],
        reason: 'Moderasyon kurulumu',
      });
      await settings.set(spec.key, role.id, ctx.user.id);
      report.push(`🆕 **${spec.name}** rolü oluşturuldu`);
    }

    const roles = punishmentRoleIds(settings);
    const jailId = settings.get<string | null>('kanal.jail');
    if (jailId && guild.channels.cache.has(jailId)) {
      report.push(`✅ <#${jailId}> kanalı zaten var`);
    } else {
      const overwrites: OverwriteResolvable[] = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: guild.members.me?.id ?? ctx.bot.client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
      ];
      for (const key of STAFF_KEYS) {
        const staffRole = existingRole(guild, settings, key);
        if (staffRole) {
          overwrites.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel] });
        }
      }
      const channel = await guild.channels.create({
        name: JAIL_CHANNEL_NAME,
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites,
        reason: 'Moderasyon kurulumu',
      });
      await settings.set('kanal.jail', channel.id, ctx.user.id);
      report.push(`🆕 ${channel} kanalı oluşturuldu`);
    }

    const finalJailId = settings.get<string | null>('kanal.jail') ?? null;
    const channels = [...guild.channels.cache.values()].filter((c) => !c.isThread());
    let updated = 0;
    const failed: string[] = [];
    for (const channel of channels) {
      try {
        await applyPunishmentOverwrites(channel, roles, finalJailId);
        updated += 1;
      } catch {
        failed.push(`<#${channel.id}>`);
      }
    }
    report.push(`🔒 ${updated} kanalın izinleri güncellendi`);
    if (failed.length > 0) {
      report.push(`⚠️ İzni güncellenemeyen kanallar: ${failed.slice(0, 20).join(', ')}`);
    }

    report.push(
      '',
      '**Son adım:** Sunucu Ayarları → Entegrasyonlar → bu bot bölümünden komutların yalnızca ' +
        'yetkililere görünmesini ayarlayabilirsin. Botun rolünün ceza rollerinin üstünde ' +
        'olduğundan emin ol.',
    );

    await ctx.reply({
      embeds: [embed('success').setTitle('Kurulum').setDescription(report.join('\n'))],
    });
  },
});
