import type { Level } from '#services/PermissionService.js';
import type { CommandContext } from '../types.js';
import type { ArgDefMap, ArgValues } from './args.js';

/** Bir komutun alt komutu (`/ayar limit` gibi); ana komutla aynı argüman/çalışma şeklini kullanır. */
export interface SubcommandDef<A extends ArgDefMap = ArgDefMap> {
  name: string;
  description: string;
  args?: A;
  run?(ctx: CommandContext, values: ArgValues<A>): Promise<void> | void;
}

/** Tek bir tanımdan hem `/komut` hem `.komut` üretmeyi sağlayan komut tanımı. */
export interface CommandDef<A extends ArgDefMap = ArgDefMap> {
  name: string;
  aliases?: string[];
  description: string;
  level: Level;
  category?: string;
  args?: A;
  run?(ctx: CommandContext, values: ArgValues<A>): Promise<void> | void;
  subcommands?: Record<string, SubcommandDef>;
  defaultSubcommand?: string;
}

/** Bir komut tanımını olduğu gibi döner; asıl amacı `args` türünün çıkarımını sabitlemektir. */
export function defineCommand<const A extends ArgDefMap>(def: CommandDef<A>): CommandDef<A> {
  return def;
}

/** Bir alt komut tanımını olduğu gibi döner; {@link defineCommand} ile aynı amacı taşır. */
export function defineSubcommand<const A extends ArgDefMap>(
  def: SubcommandDef<A>,
): SubcommandDef<A> {
  return def;
}
