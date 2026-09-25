import type { ClientEvents } from 'discord.js';
import type { Bot } from './types.js';

/** Botun dinleyeceği bir Discord olayı (`client.on`/`client.once`) tanımı. */
export interface EventDef<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  /** `true` ise `client.once` ile dinlenir (varsayılan `client.on`). */
  once?: boolean;
  run(bot: Bot, ...args: ClientEvents[K]): Promise<void> | void;
}

/** Bir event tanımını olduğu gibi döner; asıl amacı `K` türünün çıkarımını sabitlemektir. */
export function defineEvent<K extends keyof ClientEvents>(def: EventDef<K>): EventDef<K> {
  return def;
}
