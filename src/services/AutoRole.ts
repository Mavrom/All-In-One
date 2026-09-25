import type { GuildMember, Role } from 'discord.js';
import { UserError } from '#core/errors.js';
import type { CommandContext } from '#core/types.js';

/** Otorol için bir rolün verilebilir olduğunu denetler; değilse `UserError` fırlatır. */
export function assertAssignableRole(ctx: CommandContext, roleId: string): Role {
  const role = ctx.guild.roles.cache.get(roleId);
  if (!role || role.id === ctx.guild.id) {
    throw new UserError('Geçerli bir rol belirtmelisin.');
  }
  if (role.managed) {
    throw new UserError('Bir bota/entegrasyona ait rol otorol olarak verilemez.');
  }
  const botTop = ctx.guild.members.me?.roles.highest.position ?? 0;
  if (role.position >= botTop) {
    throw new UserError('Bu rol botun rolünden yüksek. Botun rolünü yukarı taşıyın.');
  }
  return role;
}

/**
 * Yeni katılan üyeye ayardaki otorolü verir (botlara `otorol.bot`, diğerlerine `otorol.uye`).
 * Rol ayarlanmamışsa veya sunucuda yoksa hiçbir şey yapmaz; Discord hatası çağırana bırakılır.
 * Verilen rolün ID'sini, rol verilmediyse `null` döner.
 */
export async function giveAutoRole(
  member: GuildMember,
  settings: { get<T>(key: string): T | undefined },
): Promise<string | null> {
  const roleId = settings.get<string | null>(member.user.bot ? 'otorol.bot' : 'otorol.uye');
  if (!roleId || !member.guild.roles.cache.has(roleId)) return null;
  await member.roles.add(roleId, 'Otorol');
  return roleId;
}
