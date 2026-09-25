import { arg } from '#core/args.js';
import { defineCommand, defineSubcommand } from '#core/define.js';
import { findCommand } from '#core/dispatcher.js';
import { UserError } from '#core/errors.js';
import type { CommandContext } from '#core/types.js';
import { Level } from '#services/PermissionService.js';
import type { SettingsService } from '#services/SettingsService.js';
import { parseDuration } from '#utils/duration.js';
import { embed } from '#utils/embed.js';
import { success } from '#utils/replies.js';
import { formatSettingValue, isResettableKey } from '#utils/settingsView.js';
import { trLower, truncate } from '#utils/text.js';

const LIMIT_TYPES = ['ban', 'kick', 'jail'] as const;
const STAFF_TIERS = ['dusuk', 'orta', 'yuksek'] as const;

/** Bir ayar anahtarının hangi kapsamda (genel veya bot) tutulduğunu döner. */
function scopeOf(ctx: CommandContext, key: string): SettingsService {
  return key.startsWith('yetki.') ? ctx.bot.settings.genel : ctx.bot.settings.bot;
}

function settingLines(settings: SettingsService): string[] {
  return settings
    .entries()
    .filter((entry) => !entry.key.startsWith('_'))
    .map(
      (entry) =>
        `${entry.overridden ? '✏️' : '▫️'} \`${entry.key}\`: ${formatSettingValue(entry.key, entry.value)}`,
    );
}

/**
 * `/ayar` ve `.ayar`: botun dinamik ayarlarını gösterir ve değiştirir. Değişiklikler
 * veritabanına yazılır; `sıfırla` config dosyasındaki değere döndürür.
 */
export default defineCommand({
  name: 'ayar',
  description: 'Bot ayarlarını gösterir ve değiştirir.',
  level: Level.Owner,
  defaultSubcommand: 'goster',
  subcommands: {
    goster: defineSubcommand({
      name: 'goster',
      description: 'Tüm güncel ayarları gösterir.',
      async run(ctx) {
        const result = embed('info')
          .setTitle('Ayarlar')
          .setDescription('✏️ = değiştirilmiş, ▫️ = config değeri')
          .addFields(
            {
              name: 'Genel',
              value: truncate(settingLines(ctx.bot.settings.genel).join('\n'), 1024) || '—',
            },
            {
              name: 'Moderasyon',
              value: truncate(settingLines(ctx.bot.settings.bot).join('\n'), 1024) || '—',
            },
          );
        await ctx.reply({ embeds: [result] });
      },
    }),
    limit: defineSubcommand({
      name: 'limit',
      description: 'Bir ceza türünün saatlik limitini ayarlar (0 = limitsiz).',
      args: {
        tur: arg.string({ description: 'Ceza türü', choices: LIMIT_TYPES }),
        sayi: arg.number({ description: 'Limit', integer: true, min: 0, max: 1000 }),
      },
      async run(ctx, args) {
        await ctx.bot.settings.bot.set(`limit.${args.tur}`, args.sayi, ctx.user.id);
        await ctx.reply({ embeds: [success(`\`${args.tur}\` limiti **${args.sayi}** yapıldı.`)] });
      },
    }),
    'limit-süre': defineSubcommand({
      name: 'limit-süre',
      description: 'Limitlerin sayıldığı zaman penceresini ayarlar.',
      args: {
        sure: arg.string({ description: 'Süre (örn. 1sa, 30dk)' }),
      },
      async run(ctx, args) {
        if (parseDuration(args.sure) === null) {
          throw new UserError('Geçersiz süre. Örnek: `1sa`, `30dk`.');
        }
        await ctx.bot.settings.bot.set('limit.pencere', args.sure, ctx.user.id);
        await ctx.reply({ embeds: [success(`Limit penceresi **${args.sure}** yapıldı.`)] });
      },
    }),
    kademe: defineSubcommand({
      name: 'kademe',
      description: 'Bir komutun gerektirdiği yetki kademesini değiştirir.',
      args: {
        komut: arg.string({ description: 'Komut adı' }),
        seviye: arg.number({ description: 'Kademe (1-3)', integer: true, min: 1, max: 3 }),
      },
      async run(ctx, args) {
        const def = findCommand(ctx.bot.commands, args.komut);
        if (!def) {
          throw new UserError('Böyle bir komut yok.');
        }
        if (def.level === Level.Owner) {
          throw new UserError('Sahip komutlarının kademesi değiştirilemez.');
        }
        await ctx.bot.settings.bot.set(`kademe.${trLower(def.name)}`, args.seviye, ctx.user.id);
        await ctx.reply({
          embeds: [success(`\`${def.name}\` artık **${args.seviye}.** kademe gerektiriyor.`)],
        });
      },
    }),
    yetki: defineSubcommand({
      name: 'yetki',
      description: 'Bir yetki kademesinin rolünü ayarlar.',
      args: {
        kademe: arg.string({ description: 'Kademe', choices: STAFF_TIERS }),
        rol: arg.role({ description: 'Yetki rolü' }),
      },
      async run(ctx, args) {
        await ctx.bot.settings.genel.set(`yetki.${args.kademe}`, args.rol, ctx.user.id);
        await ctx.reply({
          embeds: [success(`\`${args.kademe}\` yetki rolü <@&${args.rol}> yapıldı.`)],
        });
      },
    }),
    prefix: defineSubcommand({
      name: 'prefix',
      description: 'Prefix komutlarının önekini değiştirir.',
      args: {
        onek: arg.string({ description: 'Yeni önek (en fazla 5 karakter)' }),
      },
      async run(ctx, args) {
        if (args.onek.length > 5) {
          throw new UserError('Önek en fazla 5 karakter olabilir.');
        }
        await ctx.bot.settings.bot.set('prefix', args.onek, ctx.user.id);
        await ctx.reply({ embeds: [success(`Prefix \`${args.onek}\` yapıldı.`)] });
      },
    }),
    sıfırla: defineSubcommand({
      name: 'sıfırla',
      description: 'Bir ayarı config dosyasındaki değerine döndürür.',
      args: {
        anahtar: arg.string({ description: 'Ayar anahtarı (örn. limit.ban)' }),
      },
      async run(ctx, args) {
        const key = args.anahtar;
        if (!isResettableKey(key)) {
          throw new UserError('Bu ayar sıfırlanamaz. Anahtarları görmek için: `ayar`');
        }
        const settings = scopeOf(ctx, key);
        if (!settings.isOverridden(key)) {
          throw new UserError('Bu ayar zaten config değerinde.');
        }
        await settings.reset(key);
        await ctx.reply({ embeds: [success(`\`${key}\` config değerine döndürüldü.`)] });
      },
    }),
  },
});
