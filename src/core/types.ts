import type {
  ActionRowBuilder,
  APIEmbed,
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  GuildTextBasedChannel,
  Message,
  MessageActionRowComponentBuilder,
  User,
} from 'discord.js';
import type { Logger } from 'pino';
import type { Level } from '#services/PermissionService.js';
import type { SettingsService } from '#services/SettingsService.js';
import type { Env, GenelConfig } from './config.js';
import type { CommandDef } from './define.js';

/** `ctx.reply()` çağrısına verilebilecek yanıt seçenekleri. */
export interface ReplyOptions {
  content?: string;
  embeds?: (APIEmbed | EmbedBuilder)[];
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  ephemeral?: boolean;
}

/** Slash ve prefix komutlarının ortak çalışma zamanı bağlamı. */
export interface CommandContext {
  bot: Bot;
  guild: Guild;
  member: GuildMember;
  user: User;
  channel: GuildTextBasedChannel;
  level: Level;
  isSlash: boolean;
  prefix: string;
  commandName: string;
  /** Prefix komutlarında komutu içeren mesajın ID'si (slash'ta yok). */
  sourceMessageId?: string;
  reply(options: string | ReplyOptions): Promise<Message>;
  defer(): Promise<void>;
}

/** Ad → tanım eşlemesiyle tutulan komut kaydı. */
export type CommandRegistry = Map<string, CommandDef>;

/** `komut-log` kanalına yazılacak bir komut çalıştırma bilgisi. */
export interface CommandRunInfo {
  command: string;
  sub?: string;
  userId: string;
  channelId: string;
  args: Record<string, unknown>;
  success: boolean;
  error?: string;
  isSlash: boolean;
}

/** Bir moderasyon botunun çalışma zamanı bağımlılıkları. */
export interface Bot {
  name: string;
  client: Client<true>;
  logger: Logger;
  env: Env;
  genel: GenelConfig;
  guild: Guild;
  settings: { genel: SettingsService; bot: SettingsService };
  commands: CommandRegistry;
  onCommandRun?: (info: CommandRunInfo) => void;
}
