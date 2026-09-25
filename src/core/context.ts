import type {
  ChatInputCommandInteraction,
  GuildMember,
  GuildTextBasedChannel,
  Message,
} from 'discord.js';
import { MessageFlags } from 'discord.js';
import type { Level } from '#services/PermissionService.js';
import type { Bot, CommandContext, ReplyOptions } from './types.js';

/** `ctx.reply()`'a verilen `string | ReplyOptions` girdisini ortak bir şekle indirger. */
interface NormalizedReply {
  content?: string;
  embeds?: ReplyOptions['embeds'];
  components?: ReplyOptions['components'];
  ephemeral?: boolean;
}

function normalizeReply(input: string | ReplyOptions): NormalizedReply {
  if (typeof input === 'string') {
    return { content: input };
  }
  return {
    content: input.content,
    embeds: input.embeds,
    components: input.components,
    ephemeral: input.ephemeral,
  };
}

/**
 * Bir slash etkileşimi için {@link CommandContext} oluşturur. `reply` ilk çağrıda henüz
 * yanıtlanmamışsa `interaction.reply` (ardından `fetchReply`), `defer` edilmiş ve henüz bir
 * yanıt gönderilmemişse `interaction.editReply`, aksi halde `interaction.followUp` kullanır.
 */
export function slashContext(
  bot: Bot,
  interaction: ChatInputCommandInteraction,
  member: GuildMember,
  level: Level,
): CommandContext {
  // Bu bağlam yalnızca `bot.guild` içindeki bir metin kanalından gelen etkileşimler için
  // oluşturulur (bkz. `handleInteraction`); bu nedenle `channel` her zaman doludur.
  const channel = interaction.channel as GuildTextBasedChannel;
  let firstReplySent = interaction.replied || interaction.deferred;

  return {
    bot,
    guild: bot.guild,
    member,
    user: interaction.user,
    channel,
    level,
    isSlash: true,
    prefix: '/',
    commandName: interaction.commandName,
    async reply(options: string | ReplyOptions): Promise<Message> {
      const normalized = normalizeReply(options);
      const payload = {
        content: normalized.content,
        embeds: normalized.embeds,
        components: normalized.components,
      };

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          ...payload,
          flags: normalized.ephemeral === true ? MessageFlags.Ephemeral : undefined,
        });
        firstReplySent = true;
        return (await interaction.fetchReply()) as Message;
      }

      if (interaction.deferred && !firstReplySent) {
        firstReplySent = true;
        return (await interaction.editReply(payload)) as Message;
      }

      return (await interaction.followUp({
        ...payload,
        flags: normalized.ephemeral === true ? MessageFlags.Ephemeral : undefined,
      })) as Message;
    },
    async defer(): Promise<void> {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply();
      }
    },
  };
}

/**
 * Bir prefix komutu (mesaj) için {@link CommandContext} oluşturur. `reply` her zaman
 * `message.reply` ile yanıtlar (ephemeral yoksayılır); `defer` yalnızca yazıyor... göstergesi
 * gönderir, hata sessizce yutulur.
 */
export function prefixContext(
  bot: Bot,
  message: Message<true>,
  member: GuildMember,
  level: Level,
  commandName: string,
  prefix: string,
): CommandContext {
  return {
    bot,
    guild: bot.guild,
    member,
    user: message.author,
    channel: message.channel,
    level,
    isSlash: false,
    prefix,
    commandName,
    sourceMessageId: message.id,
    async reply(options: string | ReplyOptions): Promise<Message> {
      const normalized = normalizeReply(options);
      return (await message.reply({
        content: normalized.content,
        embeds: normalized.embeds,
        components: normalized.components,
        allowedMentions: { repliedUser: false },
      })) as Message;
    },
    async defer(): Promise<void> {
      try {
        await message.channel.sendTyping();
      } catch {
        // Yazıyor... göstergesi gönderilemedi; yutulur.
      }
    },
  };
}
