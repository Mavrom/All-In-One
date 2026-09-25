import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { punishmentOverwrites, punishmentRoleIds } from './setup.js';

const roles = { cezali: 'C', chatmute: 'M', voicemute: 'V' };

describe('punishmentOverwrites', () => {
  it('metin kanalında Cezalı görmez, Chat Mute yazamaz, Voice Mute etkilenmez', () => {
    const result = punishmentOverwrites(ChannelType.GuildText, false, roles);
    expect(result.map((o) => o.roleId)).toEqual(['C', 'M']);
    expect(result[0]?.deny).toEqual([PermissionFlagsBits.ViewChannel]);
    expect(result[1]?.deny).toContain(PermissionFlagsBits.SendMessages);
  });

  it('ses kanalında Voice Mute konuşamaz', () => {
    const result = punishmentOverwrites(ChannelType.GuildVoice, false, roles);
    expect(result.map((o) => o.roleId)).toEqual(['C', 'M', 'V']);
    expect(result[2]?.deny).toEqual([PermissionFlagsBits.Speak]);
  });

  it('kategoride üç rol de uygulanır', () => {
    expect(punishmentOverwrites(ChannelType.GuildCategory, false, roles)).toHaveLength(3);
  });

  it('jail kanalında Cezalı görebilir ve yazabilir', () => {
    const [cezali] = punishmentOverwrites(ChannelType.GuildText, true, roles);
    expect(cezali?.deny).toEqual([]);
    expect(cezali?.allow).toEqual([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
    ]);
  });

  it('ayarlanmamış roller atlanır', () => {
    const result = punishmentOverwrites(ChannelType.GuildVoice, false, {
      cezali: null,
      chatmute: null,
      voicemute: 'V',
    });
    expect(result.map((o) => o.roleId)).toEqual(['V']);
  });
});

describe('punishmentRoleIds', () => {
  it('ayarlardan rolleri okur, eksikleri null yapar', () => {
    const values: Record<string, unknown> = { 'rol.cezali': 'C' };
    expect(punishmentRoleIds({ get: <T>(key: string) => values[key] as T })).toEqual({
      cezali: 'C',
      chatmute: null,
      voicemute: null,
    });
  });
});
