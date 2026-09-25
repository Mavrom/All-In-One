import {
  ChannelType,
  type NonThreadGuildBasedChannel,
  PermissionFlagsBits,
  type PermissionOverwriteOptions,
} from 'discord.js';
import type { SettingsService } from '#services/SettingsService.js';

/** `.kurulum`'un oluşturduğu ceza rolleri ve kaydedildikleri ayar anahtarları. */
export const PUNISHMENT_ROLES = [
  { key: 'rol.cezali', name: 'Cezalı', color: 0x2c2f33 },
  { key: 'rol.chatmute', name: 'Chat Mute', color: 0x747f8d },
  { key: 'rol.voicemute', name: 'Voice Mute', color: 0x747f8d },
] as const;

export interface PunishmentRoleIds {
  cezali: string | null;
  chatmute: string | null;
  voicemute: string | null;
}

export interface RoleOverwrite {
  roleId: string;
  allow: bigint[];
  deny: bigint[];
}

/** Ayarlardan ceza rollerinin ID'lerini okur. */
export function punishmentRoleIds(settings: Pick<SettingsService, 'get'>): PunishmentRoleIds {
  return {
    cezali: settings.get<string | null>('rol.cezali') ?? null,
    chatmute: settings.get<string | null>('rol.chatmute') ?? null,
    voicemute: settings.get<string | null>('rol.voicemute') ?? null,
  };
}

const TEXT_LIKE = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
  ChannelType.GuildCategory,
]);

const VOICE_LIKE = new Set<ChannelType>([
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
  ChannelType.GuildCategory,
]);

const CHAT_DENY = [
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.CreatePrivateThreads,
  PermissionFlagsBits.SendMessagesInThreads,
];

/** Bir kanal için ceza rollerinin izin ayarlarını hesaplar (Discord'a dokunmaz). */
export function punishmentOverwrites(
  channelType: ChannelType,
  isJailChannel: boolean,
  roles: PunishmentRoleIds,
): RoleOverwrite[] {
  const result: RoleOverwrite[] = [];

  if (roles.cezali) {
    result.push(
      isJailChannel
        ? {
            roleId: roles.cezali,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
            deny: [],
          }
        : { roleId: roles.cezali, allow: [], deny: [PermissionFlagsBits.ViewChannel] },
    );
  }
  if (roles.chatmute && TEXT_LIKE.has(channelType)) {
    result.push({ roleId: roles.chatmute, allow: [], deny: CHAT_DENY });
  }
  if (roles.voicemute && VOICE_LIKE.has(channelType)) {
    result.push({ roleId: roles.voicemute, allow: [], deny: [PermissionFlagsBits.Speak] });
  }

  return result;
}

const FLAG_NAMES = new Map<bigint, keyof typeof PermissionFlagsBits>(
  (Object.entries(PermissionFlagsBits) as [keyof typeof PermissionFlagsBits, bigint][]).map(
    ([name, bit]) => [bit, name],
  ),
);

function toOptions(overwrite: RoleOverwrite): PermissionOverwriteOptions {
  const options: PermissionOverwriteOptions = {};
  for (const bit of overwrite.allow) {
    const name = FLAG_NAMES.get(bit);
    if (name) options[name] = true;
  }
  for (const bit of overwrite.deny) {
    const name = FLAG_NAMES.get(bit);
    if (name) options[name] = false;
  }
  return options;
}

/** Ceza rollerinin izinlerini bir kanala uygular. */
export async function applyPunishmentOverwrites(
  channel: NonThreadGuildBasedChannel,
  roles: PunishmentRoleIds,
  jailChannelId: string | null,
): Promise<void> {
  const overwrites = punishmentOverwrites(channel.type, channel.id === jailChannelId, roles);
  for (const overwrite of overwrites) {
    await channel.permissionOverwrites.edit(overwrite.roleId, toOptions(overwrite), {
      reason: 'Moderasyon ceza rolleri',
    });
  }
}
