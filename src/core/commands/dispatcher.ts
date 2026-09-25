import type { ChatInputCommandInteraction, Message } from 'discord.js';
import { GuildMember } from 'discord.js';
import mongoose from 'mongoose';
import { Level, levelLabel, resolveLevel } from '#services/PermissionService.js';
import type { SettingsService } from '#services/SettingsService.js';
import { foldTurkish, trLower } from '#utils/text.js';
import { UserError } from '../errors.js';
import type { Bot, CommandContext, CommandRegistry, CommandRunInfo } from '../types.js';
import type { ArgDefMap, ArgValues } from './args.js';
import { prefixContext, slashContext } from './context.js';
import type { CommandDef } from './define.js';
import { parsePrefixArgs, tokenize, usage } from './prefix.js';
import { readSlashArgs } from './slash.js';

/**
 * `member`in kademesini belirler: sunucu sahibi ve `DEVELOPER_IDS` Sahip, aksi halde
 * `genel` kapsamındaki yetki rollerinden (kümülatif) en yükseği. Bu fonksiyon `bot.ts` yerine
 * burada tanımlanır; aksi halde `bot.ts` ↔ `dispatcher.ts` arasında bir çalışma zamanı içe
 * aktarma döngüsü oluşurdu.
 */
export function memberLevel(bot: Bot, member: GuildMember): Level {
  return resolveLevel({
    userId: member.id,
    roleIds: [...member.roles.cache.keys()],
    ownerId: bot.guild.ownerId,
    developerIds: bot.env.DEVELOPER_IDS,
    staffRoles: {
      dusuk: bot.settings.genel.get<string | null>('yetki.dusuk') ?? null,
      orta: bot.settings.genel.get<string | null>('yetki.orta') ?? null,
      yuksek: bot.settings.genel.get<string | null>('yetki.yuksek') ?? null,
    },
  });
}

/**
 * Bir komutun gereken kademesini çözer: `Owner` komutları her zaman sabittir; aksi halde
 * `kademe.<ad>` ayarı (veritabanı/config) varsa onu, yoksa komut dosyasındaki `level`'ı kullanır.
 */
export function requiredLevel(
  def: Pick<CommandDef, 'name' | 'level'>,
  settings: Pick<SettingsService, 'get'>,
): Level {
  if (def.level === Level.Owner) {
    return Level.Owner;
  }
  const override = settings.get<number>(`kademe.${def.name}`);
  return (override ?? def.level) as Level;
}

/**
 * `input`i (komut adı veya alias) Türkçe büyük/küçük harf ve Türkçe karakter duyarsız biçimde
 * `registry`deki komutlarla eşleştirir (`UYARI`, `uyari` → `uyarı` komutu gibi).
 */
export function findCommand(registry: CommandRegistry, input: string): CommandDef | undefined {
  const target = foldTurkish(trLower(input));

  for (const def of registry.values()) {
    if (foldTurkish(trLower(def.name)) === target) {
      return def;
    }
    if (def.aliases?.some((alias) => foldTurkish(trLower(alias)) === target)) {
      return def;
    }
  }

  return undefined;
}

/** {@link selectSubcommand} sonucu: başarılıysa seçilen alt komut adı (varsa) ve kalan tokenler. */
export type SelectSubcommandResult =
  | { ok: true; sub?: string; rest: string[] }
  | { ok: false; error: string };

/**
 * Prefix komutlarında ilk tokene bakarak alt komutu seçer (yalnızca prefix; slash'ta alt komut
 * `interaction.options.getSubcommand` ile doğrudan gelir). Komutun alt komutu yoksa tüm
 * tokenleri olduğu gibi döner; ilk token bir alt komutla (Türkçe katlanmış) eşleşirse onu ve
 * kalanını döner; token yoksa ve `defaultSubcommand` tanımlıysa onu kullanır; aksi halde
 * kullanılabilir alt komutları listeleyen bir hata döner.
 */
export function selectSubcommand(def: CommandDef, tokens: string[]): SelectSubcommandResult {
  const subcommands = def.subcommands;
  if (subcommands === undefined) {
    return { ok: true, rest: tokens };
  }

  const [first, ...rest] = tokens;
  if (first !== undefined) {
    const target = foldTurkish(trLower(first));
    const matchKey = Object.keys(subcommands).find((key) => foldTurkish(trLower(key)) === target);
    if (matchKey !== undefined) {
      return { ok: true, sub: matchKey, rest };
    }
  }

  if (tokens.length === 0 && def.defaultSubcommand !== undefined) {
    return { ok: true, sub: def.defaultSubcommand, rest: [] };
  }

  return {
    ok: false,
    error: `Geçersiz alt komut. Kullanılabilir: ${Object.keys(subcommands).join(', ')}`,
  };
}

/** Bir yanıt gönderir; etkileşim/mesaj artık yanıtlanamıyorsa (süresi dolmuş vb.) hatayı yutar. */
async function safeReply(ctx: CommandContext, content: string, ephemeral: boolean): Promise<void> {
  try {
    await ctx.reply({ content, ephemeral });
  } catch {
    // Yanıt gönderilemedi; yutulur.
  }
}

/**
 * Komut bulunduktan sonra ortak akışı çalıştırır: kademe kontrolü → argüman ayrıştırma (hata +
 * kullanım) → veritabanı bağlantı kontrolü → `run` → `onCommandRun`. `resolveArgs` argüman
 * hatalarını `UserError` fırlatarak bildirir; slash için `readSlashArgs`, prefix için
 * `selectSubcommand` + `parsePrefixArgs` sarmalanarak kullanılır.
 */
async function runCommand(
  bot: Bot,
  ctx: CommandContext,
  def: CommandDef,
  subName: string | undefined,
  resolveArgs: () => Record<string, unknown>,
): Promise<void> {
  const required = requiredLevel(def, bot.settings.bot);
  if (ctx.level < required) {
    await safeReply(ctx, `Bu komut için **${levelLabel(required)}** gerekli.`, true);
    return;
  }

  const sub = subName !== undefined ? def.subcommands?.[subName] : undefined;
  const argsSchema: ArgDefMap = sub?.args ?? def.args ?? {};

  let values: Record<string, unknown>;
  try {
    values = resolveArgs();
  } catch (error) {
    if (!(error instanceof UserError)) {
      throw error;
    }
    const usageText = usage(def.name, argsSchema, ctx.prefix, subName);
    await safeReply(ctx, `❌ ${error.message}\nKullanım: \`${usageText}\``, true);
    return;
  }

  if (mongoose.connection.readyState !== 1) {
    await safeReply(ctx, 'Veritabanına ulaşılamıyor, birazdan tekrar deneyin.', true);
    return;
  }

  const runner = sub?.run ?? def.run;
  const info: CommandRunInfo = {
    command: def.name,
    sub: subName,
    userId: ctx.user.id,
    channelId: ctx.channel.id,
    args: values,
    success: false,
    isSlash: ctx.isSlash,
  };

  try {
    if (runner !== undefined) {
      await runner(ctx, values as ArgValues<ArgDefMap>);
    }
    info.success = true;
  } catch (error) {
    if (error instanceof UserError) {
      info.error = error.message;
      await safeReply(ctx, `❌ ${error.message}`, true);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      info.error = message;
      bot.logger.error({ err: error, command: def.name }, 'Komut çalıştırma hatası');
      await safeReply(ctx, 'Bir hata oluştu.', true);
    }
  } finally {
    bot.onCommandRun?.(info);
  }
}

/** Yalnızca `bot.guild`den gelen slash komut etkileşimlerini işler. */
export async function handleInteraction(
  bot: Bot,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild() || interaction.guildId !== bot.guild.id) {
    return;
  }

  const def = findCommand(bot.commands, interaction.commandName);
  if (def === undefined) {
    return;
  }

  const member =
    interaction.member instanceof GuildMember
      ? interaction.member
      : await bot.guild.members.fetch(interaction.user.id);

  const level = memberLevel(bot, member);
  const ctx = slashContext(bot, interaction, member, level);
  const subName = interaction.options.getSubcommand(false) ?? undefined;

  await runCommand(bot, ctx, def, subName, () => {
    const sub = subName !== undefined ? def.subcommands?.[subName] : undefined;
    const argsSchema: ArgDefMap = sub?.args ?? def.args ?? {};
    return readSlashArgs(interaction.options, argsSchema);
  });
}

/** Yalnızca `bot.guild`deki, botun kendisine ait olmayan mesajlardaki prefix komutlarını işler. */
export async function handleMessage(bot: Bot, message: Message): Promise<void> {
  if (message.author.bot) {
    return;
  }
  if (!message.inGuild() || message.guildId !== bot.guild.id) {
    return;
  }

  const prefix = bot.settings.bot.get<string>('prefix') ?? '.';
  if (!message.content.startsWith(prefix)) {
    return;
  }

  const tokens = tokenize(message.content.slice(prefix.length));
  const [name, ...rest] = tokens;
  if (name === undefined) {
    return;
  }

  const def = findCommand(bot.commands, name);
  if (def === undefined) {
    return;
  }

  const member = message.member ?? (await bot.guild.members.fetch(message.author.id));
  const level = memberLevel(bot, member);
  if (level === Level.None) {
    // Yetkisiz kullanıcıların spam'ini önlemek için sessizce yoksayılır.
    return;
  }

  const ctx = prefixContext(bot, message, member, level, def.name, prefix);
  const selection = selectSubcommand(def, rest);

  await runCommand(bot, ctx, def, selection.ok ? selection.sub : undefined, () => {
    if (!selection.ok) {
      throw new UserError(selection.error);
    }
    const sub = selection.sub !== undefined ? def.subcommands?.[selection.sub] : undefined;
    const argsSchema: ArgDefMap = sub?.args ?? def.args ?? {};
    const result = parsePrefixArgs(selection.rest, argsSchema);
    if (!result.ok) {
      throw new UserError(result.error);
    }
    return result.values;
  });
}
