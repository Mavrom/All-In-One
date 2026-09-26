import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type EmbedBuilder,
  type MessageActionRowComponentBuilder,
  MessageFlags,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { UserError } from '#core/errors.js';
import type { CommandContext } from '#core/types.js';
import { type BulkScope, parseFilter } from '#utils/bulkRoleFilter.js';
import { embed } from '#utils/embed.js';
import type { BulkAction } from './BulkRole.js';
import { startBulkRole } from './BulkRoleCommand.js';

const WIZARD_MS = 120_000;
const MAX_FILTER_ROLES = 10;

/** Ek filtreler menüsünün seçenekleri: değer → filtre dili karşılığı ve etiket. */
const EXTRAS = [
  { value: 'herhangi', label: 'Seçili rollerden herhangi biri yeter (VEYA)' },
  { value: 'rolsüz', label: 'Hiç rolü olmayanlar' },
  { value: 'seste', label: 'Şu an seste olanlar' },
  { value: 'sestedeğil', label: 'Şu an seste olmayanlar' },
  { value: 'hesap<7g', label: 'Hesabı 7 günden yeni' },
  { value: 'hesap>30g', label: 'Hesabı 30 günden eski' },
  { value: 'katılım<1g', label: 'Son 24 saatte katılanlar' },
  { value: 'katılım<7g', label: 'Son 7 günde katılanlar' },
  { value: 'katılım>30g', label: '30 günden önce katılanlar' },
] as const;

const SCOPES: BulkScope[] = ['herkes', 'uyeler', 'botlar'];
const SCOPE_LABELS: Record<BulkScope, string> = {
  herkes: 'Herkes',
  uyeler: 'Üyeler',
  botlar: 'Botlar',
};

interface WizardState {
  action: BulkAction;
  scope: BulkScope;
  roleId: string | null;
  allRoles: string[];
  excludeRoles: string[];
  extras: string[];
}

/** Sihirbaz seçimlerini filtre diline çevirir; filtre tek yerden ({@link parseFilter}) ayrıştırılır. */
function filterText(state: WizardState): string {
  const parts: string[] = [state.scope];
  const listWord = state.extras.includes('herhangi') ? 'herhangi' : 'rolde';
  if (state.allRoles.length > 0) {
    parts.push(listWord, ...state.allRoles.map((id) => `<@&${id}>`));
  }
  if (state.excludeRoles.length > 0) {
    parts.push('hariç', ...state.excludeRoles.map((id) => `<@&${id}>`));
  }
  parts.push(...state.extras.filter((extra) => extra !== 'herhangi'));
  return parts.join(' ');
}

function wizardEmbed(state: WizardState): EmbedBuilder {
  const role = state.roleId ? `<@&${state.roleId}>` : '*seçilmedi*';
  return embed('info')
    .setTitle('Toplu rol sihirbazı')
    .setDescription(
      [
        `**İşlem:** ${state.action === 'ver' ? 'Rol ver' : 'Rol al'}`,
        `**Rol:** ${role}`,
        `**Kime:** ${SCOPE_LABELS[state.scope]}`,
        '',
        "Menülerden seçimini yap, sonra **Devam**'a bas. Belirli kişiler için filtre dilini kullan:",
        '`.toplurol ver @Rol kişiler @a @b`',
      ].join('\n'),
    );
}

function wizardRows(
  state: WizardState,
  prefix: string,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(`${prefix}:rol`)
    .setPlaceholder('Verilecek / alınacak rol')
    .setMinValues(1)
    .setMaxValues(1);
  if (state.roleId) roleSelect.setDefaultRoles(state.roleId);

  const allSelect = new RoleSelectMenuBuilder()
    .setCustomId(`${prefix}:rolde`)
    .setPlaceholder('Şu rollerde olanlar (isteğe bağlı)')
    .setMinValues(0)
    .setMaxValues(MAX_FILTER_ROLES);
  if (state.allRoles.length > 0) allSelect.setDefaultRoles(...state.allRoles);

  const excludeSelect = new RoleSelectMenuBuilder()
    .setCustomId(`${prefix}:haric`)
    .setPlaceholder('Şu rollerdekiler hariç (isteğe bağlı)')
    .setMinValues(0)
    .setMaxValues(MAX_FILTER_ROLES);
  if (state.excludeRoles.length > 0) excludeSelect.setDefaultRoles(...state.excludeRoles);

  const extraSelect = new StringSelectMenuBuilder()
    .setCustomId(`${prefix}:ek`)
    .setPlaceholder('Ek filtreler (isteğe bağlı)')
    .setMinValues(0)
    .setMaxValues(EXTRAS.length)
    .addOptions(
      EXTRAS.map((extra) => ({
        label: extra.label,
        value: extra.value,
        default: state.extras.includes(extra.value),
      })),
    );

  const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:islem`)
      .setLabel(`İşlem: ${state.action === 'ver' ? 'Ver' : 'Al'}`)
      .setStyle(state.action === 'ver' ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${prefix}:kime`)
      .setLabel(`Kime: ${SCOPE_LABELS[state.scope]}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${prefix}:devam`)
      .setLabel('Devam')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.roleId === null),
    new ButtonBuilder()
      .setCustomId(`${prefix}:iptal`)
      .setLabel('İptal')
      .setStyle(ButtonStyle.Secondary),
  );

  return [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(roleSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(allSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(excludeSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(extraSelect),
    buttons,
  ];
}

/**
 * Menülerle toplu rol isteği oluşturan sihirbazı açar. **Devam** ile önizleme/onay adımına
 * ({@link startBulkRole}) aynı mesaj üzerinde geçilir; 2 dakika işlem yapılmazsa kapanır.
 */
export async function openBulkRoleWizard(ctx: CommandContext): Promise<void> {
  const state: WizardState = {
    action: 'ver',
    scope: 'herkes',
    roleId: null,
    allRoles: [],
    excludeRoles: [],
    extras: [],
  };
  const prefix = `toplurol-sihirbaz-${ctx.user.id}-${Date.now()}`;
  const message = await ctx.reply({
    embeds: [wizardEmbed(state)],
    components: wizardRows(state, prefix),
  });

  const collector = message.createMessageComponentCollector({
    time: WIZARD_MS,
    filter: (i) => i.user.id === ctx.user.id && i.customId.startsWith(`${prefix}:`),
  });

  collector.on('collect', async (i) => {
    const key = i.customId.slice(prefix.length + 1);

    if (i.isRoleSelectMenu()) {
      if (key === 'rol') state.roleId = i.values[0] ?? null;
      if (key === 'rolde') state.allRoles = [...i.values];
      if (key === 'haric') state.excludeRoles = [...i.values];
    } else if (i.isStringSelectMenu()) {
      state.extras = [...i.values];
    } else if (key === 'islem') {
      state.action = state.action === 'ver' ? 'al' : 'ver';
    } else if (key === 'kime') {
      state.scope = SCOPES[(SCOPES.indexOf(state.scope) + 1) % SCOPES.length] ?? 'herkes';
    } else if (key === 'iptal') {
      collector.stop('iptal');
      await i.update({ content: 'İşlem iptal edildi.', embeds: [], components: [] });
      return;
    } else if (key === 'devam' && state.roleId !== null) {
      let filter: ReturnType<typeof parseFilter>;
      try {
        filter = parseFilter(filterText(state), (id) => ctx.guild.roles.cache.has(id));
      } catch (error) {
        if (!(error instanceof UserError)) throw error;
        await i.reply({ content: `❌ ${error.message}`, flags: MessageFlags.Ephemeral });
        return;
      }

      collector.stop('devam');
      await i.update({
        content: '⏳ Üyeler taranıyor…',
        embeds: [],
        components: [],
      });
      try {
        await startBulkRole(ctx, { action: state.action, roleId: state.roleId, filter }, message);
      } catch (error) {
        const text = error instanceof UserError ? error.message : 'Beklenmeyen bir hata oluştu.';
        if (!(error instanceof UserError)) {
          ctx.bot.logger.error({ err: error }, 'Toplu rol sihirbazı hatası');
        }
        await message.edit({ content: `❌ ${text}`, embeds: [], components: [] }).catch(() => {});
      }
      return;
    }

    await i.update({ embeds: [wizardEmbed(state)], components: wizardRows(state, prefix) });
  });

  collector.on('end', async (_collected, reason) => {
    if (reason !== 'time') return;
    await message
      .edit({ content: 'Süre doldu, sihirbaz kapandı.', embeds: [], components: [] })
      .catch(() => {});
  });
}
