import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  DiscordAPIError,
  type EmbedBuilder,
  type GuildMember,
  type Message,
  PermissionFlagsBits,
  type RateLimitData,
  RESTEvents,
  RESTJSONErrorCodes,
} from 'discord.js';
import { UserError } from '#core/errors.js';
import type { CommandContext, ReplyOptions } from '#core/types.js';
import { type BulkRoleFilter, describeFilter } from '#utils/bulkRoleFilter.js';
import { formatDuration } from '#utils/duration.js';
import { embed } from '#utils/embed.js';
import { truncate } from '#utils/text.js';
import { assertAssignableRole } from './AutoRole.js';
import {
  activeJobRole,
  type BulkAction,
  type BulkProgress,
  type BulkResult,
  collectTargets,
  endJob,
  estimateMs,
  runBulk,
  tryStartJob,
} from './BulkRole.js';
import { modIfReady } from './ModServices.js';

const CONFIRM_MS = 30_000;
const PROGRESS_EDIT_MS = 3000;
const PREVIEW_COUNT = 10;
const MAX_LISTED_USERS = 100;

/** Bir toplu rol isteği: ne yapılacak, hangi rol, kimlere. */
export interface BulkRoleRequest {
  action: BulkAction;
  roleId: string;
  filter: BulkRoleFilter;
}

const ACTION_LABELS: Record<
  BulkAction,
  { verb: string; running: string; done: string; suffix: string }
> = {
  ver: { verb: 'verilecek', running: 'veriliyor', done: 'verildi', suffix: 'kişiye' },
  al: { verb: 'alınacak', running: 'alınıyor', done: 'alındı', suffix: 'kişiden' },
};

/** Filtre özeti; embed alanı sınırına (1024) göre kesilir. */
function filterField(filter: BulkRoleFilter): string {
  return truncate(describeFilter(filter).join('\n'), 1024);
}

function human(ms: number): string {
  return formatDuration(Math.max(ms, 1000));
}

function previewEmbed(
  request: BulkRoleRequest,
  targets: GuildMember[],
  alreadyDone: number,
): EmbedBuilder {
  const label = ACTION_LABELS[request.action];
  const bots = targets.filter((m) => m.user.bot).length;
  const shown = targets.slice(0, PREVIEW_COUNT).map((m) => `<@${m.id}>`);
  if (targets.length > PREVIEW_COUNT)
    shown.push(`… ve ${targets.length - PREVIEW_COUNT} kişi daha`);

  const result = embed('warning')
    .setTitle('Toplu rol onayı')
    .setDescription(
      `<@&${request.roleId}> rolü **${targets.length}** ${label.suffix} ${label.verb}.`,
    )
    .addFields(
      { name: 'Filtre', value: filterField(request.filter) },
      { name: 'Dağılım', value: `👤 ${targets.length - bots} üye · 🤖 ${bots} bot`, inline: true },
      { name: 'Tahmini süre', value: `~${human(estimateMs(targets.length))}`, inline: true },
      { name: 'Etkilenecekler', value: shown.join(' ') },
    );
  if (alreadyDone > 0) {
    const reason = request.action === 'ver' ? 'rol zaten var' : 'rol zaten yok';
    result.setFooter({ text: `${alreadyDone} kişi atlandı (${reason})` });
  }
  return result;
}

function progressLine(progress: BulkProgress, elapsedMs: number): string {
  const parts = [
    `**${progress.done}/${progress.total}**`,
    `✅ ${progress.ok}`,
    `❌ ${progress.failed}`,
  ];
  if (progress.left > 0) parts.push(`🚪 ${progress.left}`);
  if (progress.done > 0 && progress.done < progress.total) {
    const remaining = (elapsedMs / progress.done) * (progress.total - progress.done);
    parts.push(`kalan ~${human(remaining)}`);
  }
  return parts.join(' · ');
}

function resultEmbed(request: BulkRoleRequest, result: BulkResult, staffId: string): EmbedBuilder {
  const kind = result.end === 'tamam' ? 'success' : result.end === 'hata' ? 'error' : 'warning';
  const title =
    result.end === 'tamam'
      ? 'Toplu rol tamamlandı'
      : result.end === 'hata'
        ? 'Toplu rol hata nedeniyle durdu'
        : 'Toplu rol durduruldu';
  const label = ACTION_LABELS[request.action];
  const lines = [
    `<@&${request.roleId}> rolü ${result.ok} ${label.suffix} ${label.done}.`,
    progressLine(result, result.elapsedMs),
    `Süre: ${human(result.elapsedMs)} · Yetkili: <@${staffId}>`,
  ];
  if (result.end !== 'tamam') {
    lines.push(`${result.total - result.done} kişide işlem yapılmadı.`);
  }
  if (result.error !== undefined) lines.push(`Son hata: ${result.error}`);

  return embed(kind)
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .addFields({ name: 'Filtre', value: filterField(request.filter) });
}

function buttons(
  ...items: Array<{ id: string; label: string; style: ButtonStyle }>
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    items.map((b) => new ButtonBuilder().setCustomId(b.id).setLabel(b.label).setStyle(b.style)),
  );
}

function isRoleRoute(data: RateLimitData): boolean {
  return data.route.includes('/members/') && data.route.includes('/roles/');
}

/**
 * Toplu rol isteğini önizler, onay alır ve işlemi ilerleme mesajıyla çalıştırır. `target`
 * verilirse (sihirbaz) mesajlar o mesaj düzenlenerek gösterilir, verilmezse komuta yanıt
 * verilir. İstek geçersizse `UserError` fırlatır.
 */
export async function startBulkRole(
  ctx: CommandContext,
  request: BulkRoleRequest,
  target?: Message,
): Promise<void> {
  const role = assertAssignableRole(ctx, request.roleId);
  if (!ctx.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new UserError('Botun "Rolleri Yönet" yetkisi yok.');
  }
  if ((request.filter.users?.length ?? 0) > MAX_LISTED_USERS) {
    throw new UserError(`\`kişiler\` ile en fazla ${MAX_LISTED_USERS} kişi yazılabilir.`);
  }
  if (activeJobRole(ctx.guild.id) !== null) {
    throw new UserError('Şu an çalışan bir toplu rol işlemi var, bitmesini bekle.');
  }

  let message = target;
  const show = async (options: ReplyOptions): Promise<Message> => {
    if (message) return message.edit({ ...options, content: options.content ?? null });
    message = await ctx.reply(options);
    return message;
  };

  if (!target) await ctx.defer();
  const { targets, alreadyDone } = await collectTargets(
    ctx.guild,
    role.id,
    request.action,
    request.filter,
  );

  if (targets.length === 0) {
    const text =
      alreadyDone > 0
        ? `Filtreye uyan ${alreadyDone} kişinin hepsinde işlem zaten yapılmış durumda.`
        : 'Filtreye uyan kimse yok.';
    await show({ embeds: [embed('info').setDescription(`ℹ️ ${text}`)], components: [] });
    return;
  }

  const stamp = `${ctx.user.id}-${Date.now()}`;
  const confirmId = `toplurol-onay-${stamp}`;
  const cancelId = `toplurol-iptal-${stamp}`;
  const stopId = `toplurol-dur-${stamp}`;

  const preview = await show({
    embeds: [previewEmbed(request, targets, alreadyDone)],
    components: [
      buttons(
        {
          id: confirmId,
          label: 'Onayla',
          style: request.action === 'ver' ? ButtonStyle.Success : ButtonStyle.Danger,
        },
        { id: cancelId, label: 'İptal', style: ButtonStyle.Secondary },
      ),
    ],
  });

  const answer = await preview
    .awaitMessageComponent({
      componentType: ComponentType.Button,
      time: CONFIRM_MS,
      filter: (i) =>
        i.user.id === ctx.user.id && (i.customId === confirmId || i.customId === cancelId),
    })
    .catch(() => null);

  if (answer === null) {
    await preview.edit({ content: 'Süre doldu, işlem iptal edildi.', embeds: [], components: [] });
    return;
  }
  if (answer.customId === cancelId) {
    await answer.update({ content: 'İşlem iptal edildi.', embeds: [], components: [] });
    return;
  }
  if (!tryStartJob(ctx.guild.id, role.id)) {
    await answer.update({
      content: 'Şu an çalışan bir toplu rol işlemi var, bitmesini bekle.',
      embeds: [],
      components: [],
    });
    return;
  }

  // İşlem 15 dakikayı aşabileceğinden (etkileşim jetonunun ömrü) buton hemen onaylanır ve
  // sonraki güncellemeler etkileşim yerine doğrudan mesaj düzenlenerek yapılır.
  await answer.deferUpdate();

  const controller = new AbortController();
  const stopCollector = preview.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === ctx.user.id && i.customId === stopId,
  });
  stopCollector.on('collect', (i) => {
    controller.abort();
    void i.deferUpdate().catch(() => {});
  });

  const label = ACTION_LABELS[request.action];
  const startedAt = Date.now();
  const runningEmbed = (progress: BulkProgress): EmbedBuilder =>
    embed('info')
      .setTitle('Toplu rol çalışıyor')
      .setDescription(
        `<@&${role.id}> rolü ${progress.total} ${label.suffix} ${label.running}.\n${progressLine(progress, Date.now() - startedAt)}`,
      );
  const stopRow = buttons({ id: stopId, label: 'Durdur', style: ButtonStyle.Danger });

  let lastEdit = 0;
  let editing = false;
  const onProgress = (progress: BulkProgress): void => {
    const now = Date.now();
    if (editing || now - lastEdit < PROGRESS_EDIT_MS) return;
    editing = true;
    lastEdit = now;
    preview
      .edit({ content: null, embeds: [runningEmbed(progress)], components: [stopRow] })
      .catch(() => {})
      .finally(() => {
        editing = false;
      });
  };

  const rest = ctx.bot.client.rest;
  const reason = `Toplu rol: ${ctx.user.tag}`;
  let result: BulkResult;
  try {
    await preview.edit({
      content: null,
      embeds: [runningEmbed({ total: targets.length, done: 0, ok: 0, failed: 0, left: 0 })],
      components: [stopRow],
    });
    result = await runBulk({
      targets,
      apply: async (member) => {
        if (request.action === 'ver') await member.roles.add(role.id, reason);
        else await member.roles.remove(role.id, reason);
      },
      isGone: (error) =>
        error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMember,
      onRateLimit: (listener) => {
        const handler = (data: RateLimitData): void => {
          if (isRoleRoute(data)) listener();
        };
        rest.on(RESTEvents.RateLimited, handler);
        return () => rest.off(RESTEvents.RateLimited, handler);
      },
      signal: controller.signal,
      onProgress,
    });
  } finally {
    endJob(ctx.guild.id);
    stopCollector.stop();
  }

  const summary = resultEmbed(request, result, ctx.user.id);
  await preview.edit({ content: null, embeds: [summary], components: [] }).catch(async () => {
    await ctx.channel.send({ embeds: [summary] }).catch(() => {});
  });
  await modIfReady()?.logs.send('uyeLog', { embeds: [summary] });
  ctx.bot.logger.info(
    { roleId: role.id, action: request.action, ...result, staffId: ctx.user.id },
    'Toplu rol bitti',
  );
}
