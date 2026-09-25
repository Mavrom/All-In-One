import { randomBytes } from 'node:crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';
import type { CommandContext } from '#core/types.js';
import { embed } from './embed.js';

const COLLECT_MS = 120_000;

function buildRow(prevId: string, nextId: string, index: number, total: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(prevId)
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index === 0),
    new ButtonBuilder()
      .setCustomId(nextId)
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index === total - 1),
  );
}

/**
 * Birden çok embed sayfasını ◀ ▶ butonlarıyla gezilebilir tek bir yanıt olarak gönderir. Tek
 * sayfa varsa buton eklemeden düz yanıt gönderir; çağıran taraf 0 sayfa için bu fonksiyonu hiç
 * çağırmamalıdır. Yalnızca komutu çalıştıran kullanıcı (`ctx.user.id`) butonları kullanabilir,
 * diğerleri ephemeral bir uyarı alır. 120 saniye işlemsizlik sonunda butonlar kaldırılır.
 */
export async function paginate(ctx: CommandContext, pages: EmbedBuilder[]): Promise<void> {
  const first = pages[0];
  if (first === undefined) return;

  if (pages.length === 1) {
    await ctx.reply({ embeds: [first] });
    return;
  }

  const withFooter = pages.map((page, i) =>
    EmbedBuilder.from(page).setFooter({ text: `Sayfa ${i + 1}/${pages.length}` }),
  );

  const suffix = randomBytes(4).toString('hex');
  const prevId = `paginate-prev-${suffix}`;
  const nextId = `paginate-next-${suffix}`;

  let index = 0;
  const firstPage = withFooter[0] as EmbedBuilder;
  const message = await ctx.reply({
    embeds: [firstPage],
    components: [buildRow(prevId, nextId, index, pages.length)],
  });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: COLLECT_MS,
  });

  collector.on('collect', (interaction) => {
    void (async () => {
      if (interaction.user.id !== ctx.user.id) {
        await interaction.reply({ content: 'Bu butonlar sana ait değil.', ephemeral: true });
        return;
      }

      if (interaction.customId === prevId) {
        index = Math.max(0, index - 1);
      } else if (interaction.customId === nextId) {
        index = Math.min(pages.length - 1, index + 1);
      }

      const page = withFooter[index] as EmbedBuilder;
      await interaction.update({
        embeds: [page],
        components: [buildRow(prevId, nextId, index, pages.length)],
      });
    })();
  });

  collector.on('end', () => {
    void message.edit({ components: [] }).catch(() => {
      // Mesaj silinmiş veya artık düzenlenemez olabilir; yutulur.
    });
  });
}

/**
 * Satırları `pageSize`'lık embed sayfalarına böler. `header` verilirse her sayfanın
 * açıklamasının başına eklenir (özet/toplam satırı gibi).
 */
export function linePages(
  title: string,
  lines: string[],
  opts: { pageSize?: number; header?: string } = {},
): EmbedBuilder[] {
  const pageSize = opts.pageSize ?? 10;
  const pages: EmbedBuilder[] = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    const body = lines.slice(i, i + pageSize).join('\n');
    pages.push(
      embed('info')
        .setTitle(title)
        .setDescription(opts.header !== undefined ? `${opts.header}\n\n${body}` : body),
    );
  }
  return pages;
}
