import { createHash } from 'node:crypto';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  InteractionContextType,
} from 'discord.js';
import { parseDuration } from '#utils/duration.js';
import { truncate } from '#utils/text.js';
import { UserError } from '../errors.js';
import type { ArgDef, ArgDefMap, ArgValues } from './args.js';
import type { CommandDef } from './define.js';

const NAME_RE = /^[-_\p{L}\p{N}]{1,32}$/u;
const USER_ID_RE = /\d{17,20}/g;

/** Bir slash komut/seçenek seçeneği (`choices`) girdisi. */
export interface SlashOptionChoice {
  name: string;
  value: string;
}

/** Bir slash komut seçeneği (argüman veya alt komut) için JSON gövdesi. */
export interface SlashOption {
  name: string;
  description: string;
  type: ApplicationCommandOptionType;
  required?: boolean;
  min_value?: number;
  max_value?: number;
  choices?: SlashOptionChoice[];
  options?: SlashOption[];
}

/** Discord'a kaydedilecek bir slash komutunun tam JSON gövdesi. */
export interface SlashCommandBody {
  name: string;
  description: string;
  type: ApplicationCommandType.ChatInput;
  default_member_permissions: string;
  contexts: InteractionContextType[];
  options?: SlashOption[];
}

/**
 * discord.js'in `CommandInteractionOptionResolver`'ının kullandığımız kısmı; testlerin sahte
 * bir okuyucu geçirebilmesi için ayrı bir arayüz olarak tutulur.
 */
export interface SlashOptionReader {
  getUser(name: string): { id: string } | null;
  getRole(name: string): { id: string } | null;
  getChannel(name: string): { id: string } | null;
  getString(name: string): string | null;
  getNumber(name: string): number | null;
  getInteger(name: string): number | null;
}

function validateName(raw: string): string {
  const lowered = raw.toLocaleLowerCase('tr-TR');
  if (!NAME_RE.test(lowered)) {
    throw new Error(`Geçersiz slash adı: ${raw}`);
  }
  return lowered;
}

function optionType(def: ArgDef): ApplicationCommandOptionType {
  switch (def.kind) {
    case 'user':
      return ApplicationCommandOptionType.User;
    case 'role':
      return ApplicationCommandOptionType.Role;
    case 'channel':
      return ApplicationCommandOptionType.Channel;
    case 'number':
      return def.integer === true
        ? ApplicationCommandOptionType.Integer
        : ApplicationCommandOptionType.Number;
    case 'string':
      return ApplicationCommandOptionType.String;
    case 'duration':
    case 'users':
    case 'text':
      return ApplicationCommandOptionType.String;
  }
}

function buildOptions(errorContext: string, args: ArgDefMap): SlashOption[] {
  let seenOptional = false;
  const options: SlashOption[] = [];

  for (const [key, def] of Object.entries(args)) {
    const required = def.optional !== true;
    if (required && seenOptional) {
      throw new Error(`${errorContext}: zorunlu seçenekler opsiyonellerden önce gelmeli`);
    }
    if (!required) seenOptional = true;

    const option: SlashOption = {
      name: validateName(key),
      description: truncate(def.description, 100),
      type: optionType(def),
      required,
    };

    if (def.kind === 'number') {
      if (def.min !== undefined) option.min_value = def.min;
      if (def.max !== undefined) option.max_value = def.max;
    }

    if (def.kind === 'string' && def.choices !== undefined && def.choices.length > 0) {
      option.choices = def.choices.map((choice) => ({ name: choice, value: choice }));
    }

    options.push(option);
  }

  return options;
}

/**
 * Bir {@link CommandDef}'ten Discord'a kaydedilecek slash komut JSON gövdesini üretir.
 * `subcommands` varsa üst komutun kendi `args`/`run` alanları yoksayılır ve her alt komut bir
 * `Subcommand` tipi seçenek olarak eklenir.
 */
export function buildSlash(def: CommandDef): SlashCommandBody {
  const body: SlashCommandBody = {
    name: validateName(def.name),
    description: truncate(def.description, 100),
    type: ApplicationCommandType.ChatInput,
    default_member_permissions: '0',
    contexts: [InteractionContextType.Guild],
  };

  if (def.subcommands !== undefined) {
    if (def.defaultSubcommand !== undefined && !(def.defaultSubcommand in def.subcommands)) {
      throw new Error(`${def.name}: defaultSubcommand "${def.defaultSubcommand}" bulunamadı`);
    }

    body.options = Object.entries(def.subcommands).map(([subKey, sub]) => ({
      name: validateName(subKey),
      description: truncate(sub.description, 100),
      type: ApplicationCommandOptionType.Subcommand,
      options: sub.args !== undefined ? buildOptions(`${def.name} ${subKey}`, sub.args) : [],
    }));

    return body;
  }

  if (def.args !== undefined) {
    body.options = buildOptions(def.name, def.args);
  }

  return body;
}

/**
 * Slash etkileşiminin `options` çözümleyicisinden `args` şemasına göre değerleri okur.
 * `duration` için `parseDuration`, `users` için metindeki tüm snowflake'ler kullanılır.
 */
export function readSlashArgs<A extends ArgDefMap>(
  options: SlashOptionReader,
  args: A,
): ArgValues<A> {
  const values: Record<string, unknown> = {};

  for (const [key, def] of Object.entries(args) as [string, ArgDef][]) {
    switch (def.kind) {
      case 'user': {
        const value = options.getUser(key);
        values[key] = value ? value.id : undefined;
        break;
      }
      case 'role': {
        const value = options.getRole(key);
        values[key] = value ? value.id : undefined;
        break;
      }
      case 'channel': {
        const value = options.getChannel(key);
        values[key] = value ? value.id : undefined;
        break;
      }
      case 'duration': {
        const raw = options.getString(key);
        if (raw === null) {
          values[key] = undefined;
          break;
        }
        const ms = parseDuration(raw);
        if (ms === null) {
          throw new UserError(`Geçersiz süre: ${raw}`);
        }
        values[key] = ms;
        break;
      }
      case 'number': {
        const value = def.integer === true ? options.getInteger(key) : options.getNumber(key);
        values[key] = value === null ? undefined : value;
        break;
      }
      case 'string': {
        const value = options.getString(key);
        values[key] = value === null ? undefined : value;
        break;
      }
      case 'users': {
        const raw = options.getString(key);
        const matches = raw !== null ? raw.match(USER_ID_RE) : null;
        if (matches === null) {
          if (def.optional === true) {
            values[key] = undefined;
            break;
          }
          throw new UserError('Geçersiz kullanıcı listesi');
        }
        values[key] = matches;
        break;
      }
      case 'text': {
        const value = options.getString(key);
        values[key] = value === null ? undefined : value;
        break;
      }
    }
  }

  return values as ArgValues<A>;
}

/** Komut gövdelerinin sha256 hex özetini üretir; kayıtlı komutların değişip değişmediğini anlamak için. */
export function hashCommands(bodies: unknown): string {
  return createHash('sha256').update(JSON.stringify(bodies)).digest('hex');
}
