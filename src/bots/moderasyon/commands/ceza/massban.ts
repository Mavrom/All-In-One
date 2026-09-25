import type { User } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import { mod } from '#services/ModServices.js';
import { Level } from '#services/PermissionService.js';
import { ensureCanPunish } from '#services/TargetService.js';
import { embed } from '#utils/embed.js';

const MAX_TARGETS = 50;
const CONFIRM_MS = 30_000;

interface ValidTarget {
  id: string;
  user: User;
}

/** `/massban` ve `.massban`: birden çok kullanıcıyı onay adımından sonra aynı anda banlar. */
export default defineCommand({
  name: 'massban',
  description: 'Birden çok kullanıcıyı aynı anda banlar.',
  level: Level.High,
  args: {
    kullanicilar: arg.users({ description: 'Banlanacak kullanıcılar (etiket veya ID)' }),
    sebep: arg.text({ description: 'Ban sebebi', optional: true }),
  },
  async run(ctx, args) {
    const ids = [...new Set(args.kullanicilar)];
    if (ids.length > MAX_TARGETS) {
      throw new UserError('Tek seferde en fazla 50 kullanıcı banlanabilir.');
    }

    await mod().punishments.assertLimit(ctx.user.id, ctx.level, 'ban', ids.length);

    const valid: ValidTarget[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const id of ids) {
      try {
        const { user } = await ensureCanPunish(ctx, id);
        valid.push({ id, user });
      } catch (error) {
        const reason = error instanceof UserError ? error.message : 'Bilinmeyen hata';
        skipped.push({ id, reason });
      }
    }

    if (valid.length === 0) {
      throw new UserError(
        `Banlanabilecek kullanıcı yok:\n${skipped.map((s) => `<@${s.id}> — ${s.reason}`).join('\n')}`,
      );
    }

    const confirmId = `massban-confirm-${ctx.user.id}-${Date.now()}`;
    const cancelId = `massban-cancel-${ctx.user.id}-${Date.now()}`;

    const descriptionLines = [
      `${valid.length} kullanıcı banlanacak:`,
      ...valid.map((v) => `**${v.user.tag}** (\`${v.id}\`)`),
    ];
    if (skipped.length > 0) {
      descriptionLines.push('', 'Atlanacaklar:', ...skipped.map((s) => `<@${s.id}> — ${s.reason}`));
    }

    const confirmEmbed = embed('warning')
      .setTitle('Toplu ban onayı')
      .setDescription(descriptionLines.join('\n'));

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel('Onayla').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cancelId).setLabel('İptal').setStyle(ButtonStyle.Secondary),
    );

    const message = await ctx.reply({ embeds: [confirmEmbed], components: [row] });

    const interaction = await message
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        time: CONFIRM_MS,
        filter: (i) => i.user.id === ctx.user.id,
      })
      .catch(() => null);

    if (interaction === null) {
      await message.edit({
        content: 'Süre doldu, işlem iptal edildi.',
        embeds: [],
        components: [],
      });
      return;
    }

    if (interaction.customId === cancelId) {
      await interaction.update({ content: 'İşlem iptal edildi.', embeds: [], components: [] });
      return;
    }

    // Toplu ban birden çok sıralı API çağrısı içerebileceğinden butonu hemen onaylayıp
    // (deferUpdate) süreç bitince sonucu `editReply` ile göstererek 3 saniyelik etkileşim
    // onay süresini aşma riskini ortadan kaldırıyoruz.
    await interaction.deferUpdate();

    let ok = 0;
    const failures: string[] = [];
    for (const target of valid) {
      try {
        await mod().punishments.punish({
          type: 'ban',
          userId: target.id,
          staffId: ctx.user.id,
          staffLevel: ctx.level,
          reason: args.sebep,
          durationMs: null,
        });
        ok += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Bilinmeyen hata';
        failures.push(`❌ ${target.user.tag} — ${reason}`);
      }
    }

    const resultLines = [`✅ ${ok} kullanıcı banlandı`, ...failures];
    await interaction.editReply({ content: resultLines.join('\n'), embeds: [], components: [] });
  },
});
