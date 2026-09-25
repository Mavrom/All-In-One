import type { ApplicationCommandDataResolvable } from 'discord.js';
import type { Bot } from '../types.js';
import { buildSlash, hashCommands } from './slash.js';

/** `registerSlashCommands` sonucu: kayıt atlandıysa `'unchanged'`, gerçekten kaydedildiyse `'updated'`. */
export type RegisterResult = 'unchanged' | 'updated';

/**
 * Kayıtlı tüm komutlardan slash komut gövdelerini üretip `bot.guild`e kaydeder. Gövdelerin
 * özeti (`hashCommands`) son kaydedilenle aynıysa (`_slashHash` ayarı) Discord'a istek atmadan
 * atlar.
 */
export async function registerSlashCommands(bot: Bot): Promise<RegisterResult> {
  const bodies = [...bot.commands.values()].map((def) => buildSlash(def));
  const hash = hashCommands(bodies);

  if (bot.settings.bot.get<string>('_slashHash') === hash) {
    return 'unchanged';
  }

  await bot.guild.commands.set(bodies as ApplicationCommandDataResolvable[]);
  await bot.settings.bot.set('_slashHash', hash);
  return 'updated';
}
