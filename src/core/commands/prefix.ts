import { parseDuration } from '#utils/duration.js';
import type { ArgDef, ArgDefMap, ArgValues } from './args.js';

const USER_RE = /^(?:<@!?(\d{17,20})>|(\d{17,20}))$/;
const ROLE_RE = /^(?:<@&(\d{17,20})>|(\d{17,20}))$/;
const CHANNEL_RE = /^(?:<#(\d{17,20})>|(\d{17,20}))$/;
const NUMBER_RE = /^#?\d+(?:\.\d+)?$/;

/** `parsePrefixArgs` sonucu: başarılıysa ayrıştırılmış değerler, değilse Türkçe hata mesajı. */
export type ParsePrefixResult<A extends ArgDefMap> =
  | { ok: true; values: ArgValues<A> }
  | { ok: false; error: string };

/** Prefix komut içeriğini boşluklara göre böler; ardışık boşlukları ve baş/son boşlukları atar. */
export function tokenize(content: string): string[] {
  return content
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function matchId(token: string, re: RegExp): string | null {
  const match = re.exec(token);
  if (!match) return null;
  return match[1] ?? match[2] ?? null;
}

function matchNumber(token: string): number | null {
  if (!NUMBER_RE.test(token)) return null;
  const stripped = token.startsWith('#') ? token.slice(1) : token;
  return Number(stripped);
}

/**
 * Tokenleri `args` şemasına göre sırayla ayrıştırır. Opsiyonel bir argümanın sırası geldiğinde
 * elindeki token türe uymuyorsa değeri `undefined` olur ve token tüketilmez (bir sonraki
 * argümana bırakılır); zorunlu bir argüman eksik veya geçersizse ayrıştırma Türkçe bir hata
 * mesajıyla durur.
 */
export function parsePrefixArgs<A extends ArgDefMap>(
  tokens: string[],
  args: A,
): ParsePrefixResult<A> {
  const values: Record<string, unknown> = {};
  let i = 0;

  for (const [key, def] of Object.entries(args) as [string, ArgDef][]) {
    const optional = def.optional === true;

    switch (def.kind) {
      case 'user':
      case 'role':
      case 'channel': {
        const re = def.kind === 'user' ? USER_RE : def.kind === 'role' ? ROLE_RE : CHANNEL_RE;
        const label = def.kind === 'user' ? 'kullanıcı' : def.kind === 'role' ? 'rol' : 'kanal';
        const token = tokens[i];
        if (token === undefined) {
          if (optional) {
            values[key] = undefined;
            break;
          }
          return { ok: false, error: `Eksik argüman: ${key}` };
        }
        const id = matchId(token, re);
        if (id === null) {
          if (optional) {
            values[key] = undefined;
            break;
          }
          return { ok: false, error: `Geçersiz ${label}: ${token}` };
        }
        values[key] = id;
        i += 1;
        break;
      }

      case 'duration': {
        const token = tokens[i];
        if (token === undefined) {
          if (optional) {
            values[key] = undefined;
            break;
          }
          return { ok: false, error: `Eksik argüman: ${key}` };
        }
        const ms = parseDuration(token);
        if (ms === null) {
          if (optional) {
            values[key] = undefined;
            break;
          }
          return { ok: false, error: `Geçersiz süre: ${token}` };
        }
        values[key] = ms;
        i += 1;
        break;
      }

      case 'number': {
        const token = tokens[i];
        if (token === undefined) {
          if (optional) {
            values[key] = undefined;
            break;
          }
          return { ok: false, error: `Eksik argüman: ${key}` };
        }
        const num = matchNumber(token);
        const invalid = num === null || (def.integer === true && !Number.isInteger(num));
        if (invalid) {
          if (optional) {
            values[key] = undefined;
            break;
          }
          return { ok: false, error: `Geçersiz sayı: ${token}` };
        }
        if (def.min !== undefined && num < def.min) {
          return { ok: false, error: `Sayı en az ${def.min} olmalı` };
        }
        if (def.max !== undefined && num > def.max) {
          return { ok: false, error: `Sayı en fazla ${def.max} olmalı` };
        }
        values[key] = num;
        i += 1;
        break;
      }

      case 'string': {
        const token = tokens[i];
        if (token === undefined) {
          if (optional) {
            values[key] = undefined;
            break;
          }
          return { ok: false, error: `Eksik argüman: ${key}` };
        }
        const choices = def.choices;
        if (choices !== undefined && choices.length > 0) {
          // Seçenekler ASCII İngilizce anahtar kelimelerdir (ban, jail, ...); Türkçe kilit
          // harfleme (`trLower`) "I" harfini "ı"ya çevirdiğinden ASCII karşılaştırmayı bozar
          // (örn. "JAIL" ≠ trLower ile "jail"). Bu yüzden burada standart `toLowerCase` kullanılır.
          const match = choices.find((choice) => choice.toLowerCase() === token.toLowerCase());
          if (match === undefined) {
            if (optional) {
              values[key] = undefined;
              break;
            }
            return { ok: false, error: `Geçersiz seçenek: ${token} (${choices.join(', ')})` };
          }
          values[key] = match;
        } else {
          values[key] = token;
        }
        i += 1;
        break;
      }

      case 'users': {
        const collected: string[] = [];
        while (i < tokens.length) {
          const token = tokens[i];
          const id = token === undefined ? null : matchId(token, USER_RE);
          if (id === null) break;
          collected.push(id);
          i += 1;
        }
        if (collected.length === 0) {
          if (optional) {
            values[key] = undefined;
            break;
          }
          return { ok: false, error: `Eksik argüman: ${key}` };
        }
        values[key] = collected;
        break;
      }

      case 'text': {
        const remaining = tokens.slice(i).join(' ');
        if (remaining.length === 0) {
          if (optional) {
            values[key] = undefined;
            break;
          }
          return { ok: false, error: `Eksik argüman: ${key}` };
        }
        values[key] = remaining;
        i = tokens.length;
        break;
      }
    }
  }

  return { ok: true, values: values as ArgValues<A> };
}

function usageLabel(key: string, def: ArgDef): string {
  const label = def.kind === 'users' ? `${key}...` : key;
  return def.optional === true ? `[${label}]` : `<${label}>`;
}

/**
 * Bir komutun kullanım örneğini biçimlendirir (`.ban <kullanici> [sure] [sebep]`). `sub`
 * verilirse alt komut adı komut adından sonra eklenir (`.ayar limit <tur> <sayi>`).
 */
export function usage(name: string, args: ArgDefMap, prefix: string, sub?: string): string {
  const commandPart = sub !== undefined ? `${name} ${sub}` : name;
  const parts = Object.entries(args).map(([key, def]) => usageLabel(key, def));
  return parts.length > 0
    ? `${prefix}${commandPart} ${parts.join(' ')}`
    : `${prefix}${commandPart}`;
}
