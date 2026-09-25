import type { Guild, GuildMember } from 'discord.js';
import { UserError } from '#core/errors.js';
import type { PunishmentRecord, PunishmentType } from '#models/Punishment.js';
import type { ApplyOptions, PunishmentActions } from './PunishmentService.js';
import type { SettingsService } from './SettingsService.js';

/** Discord API hata kodu: "Unknown Ban" (kullanıcı zaten banlı değil). */
const UNKNOWN_BAN_CODE = 10026;

type RoleSettingKey = 'rol.cezali' | 'rol.chatmute' | 'rol.voicemute';

function isUnknownBanError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNKNOWN_BAN_CODE
  );
}

/**
 * `PunishmentActions` arayüzünü gerçek Discord API çağrılarıyla uygular. Ceza rolleri
 * `settings` üzerinden (`rol.cezali`, `rol.chatmute`, `rol.voicemute`) okunur; ayarlanmamış
 * veya sunucuda artık bulunmuyorsa `UserError` fırlatılır ve `.kurulum` komutu hatırlatılır.
 */
export class DiscordPunishmentActions implements PunishmentActions {
  constructor(
    private readonly guild: Guild,
    private readonly settings: Pick<SettingsService, 'get'>,
  ) {}

  private roleId(key: RoleSettingKey): string {
    const id = this.settings.get<string>(key);
    if (!id || !this.guild.roles.cache.has(id)) {
      throw new UserError('Ceza rolleri ayarlanmamış. Önce `.kurulum` komutunu çalıştırın.');
    }
    return id;
  }

  private async fetchMember(userId: string): Promise<GuildMember | null> {
    try {
      return await this.guild.members.fetch(userId);
    } catch {
      return null;
    }
  }

  private async requireMember(userId: string): Promise<GuildMember> {
    const member = await this.fetchMember(userId);
    if (!member) {
      throw new UserError('Kullanıcı sunucuda bulunamadı.');
    }
    return member;
  }

  private managedRoleIds(member: GuildMember): string[] {
    return member.roles.cache.filter((role) => role.managed).map((role) => role.id);
  }

  /** @inheritdoc */
  async apply(
    type: PunishmentType,
    userId: string,
    opts: ApplyOptions,
  ): Promise<{ savedRoles?: string[] }> {
    switch (type) {
      case 'ban': {
        await this.guild.members.ban(userId, { reason: opts.reason, deleteMessageSeconds: 0 });
        return {};
      }
      case 'kick': {
        const member = await this.requireMember(userId);
        await member.kick(opts.reason);
        return {};
      }
      case 'mute': {
        const member = await this.requireMember(userId);
        await member.timeout(opts.durationMs, opts.reason);
        return {};
      }
      case 'chatmute': {
        const member = await this.requireMember(userId);
        await member.roles.add(this.roleId('rol.chatmute'), opts.reason);
        return {};
      }
      case 'voicemute': {
        const member = await this.requireMember(userId);
        await member.roles.add(this.roleId('rol.voicemute'), opts.reason);
        if (member.voice.channelId) {
          await member.voice.setMute(true, opts.reason);
        }
        return {};
      }
      case 'jail': {
        const member = await this.requireMember(userId);
        const cezaliId = this.roleId('rol.cezali');
        const managedRoleIds = this.managedRoleIds(member);
        const savedRoles = member.roles.cache
          .filter((role) => role.id !== this.guild.id && !role.managed && role.id !== cezaliId)
          .map((role) => role.id);
        await member.roles.set([cezaliId, ...managedRoleIds], opts.reason);
        if (member.voice.channelId) {
          await member.voice.disconnect(opts.reason);
        }
        return { savedRoles };
      }
      case 'warn':
        return {};
    }
  }

  /** @inheritdoc */
  async revoke(record: PunishmentRecord): Promise<void> {
    switch (record.type) {
      case 'ban': {
        try {
          await this.guild.members.unban(record.userId);
        } catch (error) {
          if (!isUnknownBanError(error)) throw error;
        }
        return;
      }
      case 'kick':
      case 'warn':
        return;
      case 'mute': {
        const member = await this.fetchMember(record.userId);
        await member?.timeout(null);
        return;
      }
      case 'chatmute': {
        const member = await this.fetchMember(record.userId);
        if (!member) return;
        await member.roles.remove(this.roleId('rol.chatmute'));
        return;
      }
      case 'voicemute': {
        const member = await this.fetchMember(record.userId);
        if (!member) return;
        await member.roles.remove(this.roleId('rol.voicemute'));
        if (member.voice.channelId) {
          await member.voice.setMute(false);
        }
        return;
      }
      case 'jail': {
        const member = await this.fetchMember(record.userId);
        if (!member) return;
        const existing = record.savedRoles.filter((id) => this.guild.roles.cache.has(id));
        const managedRoleIds = this.managedRoleIds(member);
        await member.roles.set([...existing, ...managedRoleIds]);
        return;
      }
    }
  }

  /** @inheritdoc */
  async reapply(record: PunishmentRecord): Promise<void> {
    const member = await this.fetchMember(record.userId);
    if (!member) return;

    switch (record.type) {
      case 'chatmute':
        await member.roles.add(this.roleId('rol.chatmute'));
        return;
      case 'voicemute':
        await member.roles.add(this.roleId('rol.voicemute'));
        return;
      case 'jail': {
        const cezaliId = this.roleId('rol.cezali');
        const managedRoleIds = this.managedRoleIds(member);
        await member.roles.set([cezaliId, ...managedRoleIds]);
        return;
      }
      default:
        return;
    }
  }

  /** @inheritdoc */
  async notify(userId: string, text: string): Promise<void> {
    try {
      const user = await this.guild.client.users.fetch(userId);
      await user.send(text);
    } catch {
      // Kapalı DM (veya kullanıcının artık ortak sunucusu olmaması) beklenen bir durumdur.
    }
  }
}
