import type { Guild, GuildMember, User } from 'discord.js';
import { memberLevel } from '#core/dispatcher.js';
import { UserError } from '#core/errors.js';
import type { CommandContext } from '#core/types.js';
import { checkTarget, Level } from '#services/PermissionService.js';

/** `guild`den `userId`'ye ait üyeyi getirir; sunucuda değilse (veya bulunamazsa) `null` döner. */
export async function fetchMember(guild: Guild, userId: string): Promise<GuildMember | null> {
  try {
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}

/**
 * Bir cezanın hedefinin (`userId`) uygun olup olmadığını denetler: kullanıcıyı Discord'dan
 * getirir (bulunamazsa `UserError`), sunucudaki üyeliğini ve kademesini çözer, ardından
 * `checkTarget` ile kendine/bota/sahibe ceza verme ve kademe/rol pozisyonu kurallarını uygular.
 * Kontrol başarısızsa `UserError` fırlatır.
 */
export async function ensureCanPunish(
  ctx: CommandContext,
  userId: string,
): Promise<{ user: User; member: GuildMember | null }> {
  let user: User;
  try {
    user = await ctx.bot.client.users.fetch(userId);
  } catch {
    throw new UserError('Kullanıcı bulunamadı.');
  }

  const member = await fetchMember(ctx.guild, userId);
  const targetLevel = member ? memberLevel(ctx.bot, member) : Level.None;

  const check = checkTarget({
    executorId: ctx.user.id,
    executorLevel: ctx.level,
    targetId: userId,
    targetLevel,
    botId: ctx.bot.client.user.id,
    ownerId: ctx.guild.ownerId,
    botTopPosition: ctx.guild.members.me?.roles.highest.position ?? 0,
    targetTopPosition: member?.roles.highest.position ?? null,
  });

  if (!check.ok) {
    throw new UserError(check.reason);
  }

  return { user, member };
}
