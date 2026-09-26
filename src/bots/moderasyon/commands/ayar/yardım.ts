import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { canUse, findCommand, requiredLevel } from '#core/dispatcher.js';
import { UserError } from '#core/errors.js';
import { usage } from '#core/prefix.js';
import { Level, levelLabel } from '#services/PermissionService.js';
import { embed } from '#utils/embed.js';

const CATEGORY_LABELS: Record<string, string> = {
  ceza: 'Ceza',
  sicil: 'Sicil',
  kanal: 'Kanal',
  ses: 'Ses',
  uye: 'Üye',
  ayar: 'Ayar',
};

/**
 * `/yardım` ve `.yardım` (alias `.help`): kullanıcının kullanabildiği komutları kategorilere
 * göre listeler; komut adı verilirse o komutun kullanımını ve ayrıntılarını gösterir.
 */
export default defineCommand({
  name: 'yardım',
  aliases: ['help'],
  description: 'Kullanabildiğin komutları listeler.',
  level: Level.Low,
  args: {
    komut: arg.string({ description: 'Ayrıntısı gösterilecek komut', optional: true }),
  },
  async run(ctx, args) {
    const settings = ctx.bot.settings.bot;

    if (args.komut !== undefined) {
      const def = findCommand(ctx.bot.commands, args.komut);
      const required = def ? requiredLevel(def, settings) : undefined;
      if (!def || required === undefined || !canUse(def, ctx.level, ctx.member, settings)) {
        throw new UserError('Böyle bir komut yok ya da kullanma yetkin yok.');
      }

      const usages = def.subcommands
        ? Object.values(def.subcommands).map(
            (sub) =>
              `\`${usage(def.name, sub.args ?? {}, ctx.prefix, sub.name)}\` — ${sub.description}`,
          )
        : [`\`${usage(def.name, def.args ?? {}, ctx.prefix)}\``];

      const result = embed('info')
        .setTitle(`${ctx.prefix}${def.name}`)
        .setDescription(def.description)
        .addFields(
          { name: 'Kullanım', value: usages.join('\n') },
          {
            name: 'Yetki',
            value: def.allowAdministrator
              ? `${levelLabel(required)} veya Discord Yönetici`
              : levelLabel(required),
            inline: true,
          },
        );
      if (def.aliases?.length) {
        result.addFields({
          name: 'Diğer adları',
          value: def.aliases.map((a) => `${ctx.prefix}${a}`).join(', '),
          inline: true,
        });
      }
      await ctx.reply({ embeds: [result] });
      return;
    }

    const byCategory = new Map<string, string[]>();
    for (const def of ctx.bot.commands.values()) {
      if (!canUse(def, ctx.level, ctx.member, settings)) continue;
      const category = def.category ?? 'diğer';
      const names = byCategory.get(category) ?? [];
      names.push(`\`${def.name}\``);
      byCategory.set(category, names);
    }

    const result = embed('info')
      .setTitle('Komutlar')
      .setDescription(`Ayrıntı için: \`${ctx.prefix}yardım <komut>\``);
    for (const [category, names] of byCategory) {
      result.addFields({
        name: CATEGORY_LABELS[category] ?? category,
        value: names.sort().join(' '),
      });
    }
    await ctx.reply({ embeds: [result] });
  },
});
