import { UserError } from '#core/errors.js';
import { formatDuration, parseDuration } from './duration.js';
import { foldTurkish, trLower } from './text.js';

/** Toplu rolün hangi üye türlerine uygulanacağı. */
export type BulkScope = 'herkes' | 'uyeler' | 'botlar';

/** `toplurol` hedef filtresi; tüm alanlar birlikte (VE) uygulanır. */
export interface BulkRoleFilter {
  scope: BulkScope;
  /** Bu rollerin hepsine sahip olanlar (`rolde`). */
  allRoles: string[];
  /** Bu rollerden en az birine sahip olanlar (`herhangi`). */
  anyRoles: string[];
  /** Bu rollerden birine sahip olanlar hariç (`hariç`). */
  excludeRoles: string[];
  /** Bu kişiler hariç (`hariç`). */
  excludeUsers: string[];
  /** Yalnızca bu kişiler (`kişiler`); `null` ise kısıt yok. */
  users: string[] | null;
  /** @everyone dışında hiç rolü olmayanlar (`rolsüz`). */
  noRoles: boolean;
  /** Hesap yaşı bu süreden kısa olanlar (`hesap<7g`), ms. */
  accountNewerThan: number | null;
  /** Hesap yaşı bu süreden uzun olanlar (`hesap>30g`), ms. */
  accountOlderThan: number | null;
  /** Bu süre içinde katılanlar (`katılım<1g`), ms. */
  joinedNewerThan: number | null;
  /** Bu süreden önce katılanlar (`katılım>30g`), ms. */
  joinedOlderThan: number | null;
  /** `true`: seste olanlar, `false`: seste olmayanlar, `null`: fark etmez. */
  inVoice: boolean | null;
}

/** Filtre eşleştirmesi için bir üyenin gereken bilgileri. */
export interface FilterMember {
  id: string;
  bot: boolean;
  createdAt: number;
  joinedAt: number | null;
  /** @everyone hariç rol ID'leri. */
  roleIds: readonly string[];
  inVoice: boolean;
}

/** Hiçbir kısıt içermeyen (herkesi seçen) filtre. */
export function emptyFilter(): BulkRoleFilter {
  return {
    scope: 'herkes',
    allRoles: [],
    anyRoles: [],
    excludeRoles: [],
    excludeUsers: [],
    users: null,
    noRoles: false,
    accountNewerThan: null,
    accountOlderThan: null,
    joinedNewerThan: null,
    joinedOlderThan: null,
    inVoice: null,
  };
}

const SCOPE_WORDS: Record<string, BulkScope> = {
  herkes: 'herkes',
  uyeler: 'uyeler',
  insanlar: 'uyeler',
  botlar: 'botlar',
};

type ListMode = 'rolde' | 'herhangi' | 'haric' | 'kisiler';

const LIST_WORDS: Record<string, ListMode> = {
  rolde: 'rolde',
  herhangi: 'herhangi',
  haric: 'haric',
  kisiler: 'kisiler',
};

const ROLE_MENTION_RE = /^<@&(\d{17,20})>$/;
const USER_MENTION_RE = /^<@!?(\d{17,20})>$/;
const ID_RE = /^\d{17,20}$/;
const COMPARE_RE = /^(hesap|katilim)([<>])(.+)$/;

type Mention = { kind: 'role' | 'user'; id: string };

function readMention(token: string, isRole: (id: string) => boolean): Mention | null {
  const role = ROLE_MENTION_RE.exec(token);
  if (role?.[1]) return { kind: 'role', id: role[1] };
  const user = USER_MENTION_RE.exec(token);
  if (user?.[1]) return { kind: 'user', id: user[1] };
  if (ID_RE.test(token)) return { kind: isRole(token) ? 'role' : 'user', id: token };
  return null;
}

function pushUnique(list: string[], id: string): void {
  if (!list.includes(id)) list.push(id);
}

function addMention(filter: BulkRoleFilter, mode: ListMode, mention: Mention, raw: string): void {
  switch (mode) {
    case 'rolde':
    case 'herhangi':
      if (mention.kind !== 'role') {
        throw new UserError(`\`${mode}\` filtresinden sonra rol bekleniyordu: ${raw}`);
      }
      pushUnique(mode === 'rolde' ? filter.allRoles : filter.anyRoles, mention.id);
      return;
    case 'haric':
      pushUnique(mention.kind === 'role' ? filter.excludeRoles : filter.excludeUsers, mention.id);
      return;
    case 'kisiler':
      if (mention.kind !== 'user') {
        throw new UserError(`\`kişiler\` filtresinden sonra kullanıcı bekleniyordu: ${raw}`);
      }
      filter.users ??= [];
      pushUnique(filter.users, mention.id);
      return;
  }
}

function setVoice(filter: BulkRoleFilter, value: boolean): void {
  if (filter.inVoice !== null && filter.inVoice !== value) {
    throw new UserError('`seste` ve `sestedeğil` birlikte kullanılamaz.');
  }
  filter.inVoice = value;
}

function applyCompare(filter: BulkRoleFilter, field: string, op: string, rawValue: string): void {
  const ms = parseDuration(rawValue);
  if (ms === null) {
    throw new UserError(`Geçersiz süre: ${rawValue} (örnek: 30dk, 12sa, 7g, 2hf)`);
  }
  if (field === 'hesap') {
    if (op === '<') filter.accountNewerThan = ms;
    else filter.accountOlderThan = ms;
  } else if (op === '<') {
    filter.joinedNewerThan = ms;
  } else {
    filter.joinedOlderThan = ms;
  }
}

/** Filtredeki çelişkileri denetler; varsa `UserError` fırlatır. */
export function validateFilter(filter: BulkRoleFilter): void {
  if (filter.noRoles && (filter.allRoles.length > 0 || filter.anyRoles.length > 0)) {
    throw new UserError('`rolsüz` ile `rolde`/`herhangi` birlikte kullanılamaz.');
  }
  if (
    filter.accountNewerThan !== null &&
    filter.accountOlderThan !== null &&
    filter.accountOlderThan >= filter.accountNewerThan
  ) {
    throw new UserError('Hesap yaşı filtreleri çelişiyor, kimse eşleşmez.');
  }
  if (
    filter.joinedNewerThan !== null &&
    filter.joinedOlderThan !== null &&
    filter.joinedOlderThan >= filter.joinedNewerThan
  ) {
    throw new UserError('Katılım filtreleri çelişiyor, kimse eşleşmez.');
  }
}

/**
 * Filtre dilini ({@link BulkRoleFilter}) ayrıştırır: `üyeler rolde @A @B hariç @C hesap<7g`.
 * `rolde`/`herhangi`/`hariç`/`kişiler` kendilerinden sonraki etiket ve ID'leri toplar; çıplak
 * bir ID `isRole` doğruysa rol, değilse kullanıcı sayılır. Hatalı veya çelişen girdide
 * `UserError` fırlatır.
 */
export function parseFilter(input: string, isRole: (id: string) => boolean): BulkRoleFilter {
  const filter = emptyFilter();
  let scopeSet = false;
  let mode: ListMode | null = null;
  let modeCount = 0;

  const closeMode = (): void => {
    if (mode !== null && modeCount === 0) {
      throw new UserError(`\`${mode}\` filtresinden sonra en az bir rol veya kişi yazmalısın.`);
    }
    mode = null;
    modeCount = 0;
  };

  const tokens = input
    .replace(/(hesap|kat[ıi]l[ıi]m)\s*([<>])\s*/giu, '$1$2')
    .split(/\s+/)
    .filter((token) => token.length > 0);

  for (const raw of tokens) {
    const mention = readMention(raw, isRole);
    if (mention !== null) {
      if (mode === null) {
        throw new UserError(
          `${raw} hangi filtreye ait belli değil; önüne \`rolde\`, \`hariç\` veya \`kişiler\` yaz.`,
        );
      }
      addMention(filter, mode, mention, raw);
      modeCount += 1;
      continue;
    }

    const word = foldTurkish(trLower(raw)).replace(/-/g, '');
    closeMode();

    const scope = SCOPE_WORDS[word];
    if (scope !== undefined) {
      if (scopeSet && filter.scope !== scope) {
        throw new UserError('Kapsam (`herkes`/`üyeler`/`botlar`) yalnızca bir kez seçilebilir.');
      }
      filter.scope = scope;
      scopeSet = true;
      continue;
    }

    const list = LIST_WORDS[word];
    if (list !== undefined) {
      mode = list;
      continue;
    }

    if (word === 'rolsuz') {
      filter.noRoles = true;
      continue;
    }
    if (word === 'seste') {
      setVoice(filter, true);
      continue;
    }
    if (word === 'sestedegil') {
      setVoice(filter, false);
      continue;
    }

    const compare = COMPARE_RE.exec(word);
    if (compare?.[1] && compare[2] && compare[3]) {
      applyCompare(filter, compare[1], compare[2], compare[3]);
      continue;
    }

    throw new UserError(`Bilinmeyen filtre: ${raw}`);
  }

  closeMode();
  validateFilter(filter);
  return filter;
}

/** Bir üyenin filtreye uyup uymadığını döner; `now` hesap/katılım yaşları için referans. */
export function matchesFilter(member: FilterMember, filter: BulkRoleFilter, now: number): boolean {
  if (filter.scope === 'uyeler' && member.bot) return false;
  if (filter.scope === 'botlar' && !member.bot) return false;
  if (filter.users !== null && !filter.users.includes(member.id)) return false;
  if (filter.excludeUsers.includes(member.id)) return false;

  const roles = new Set(member.roleIds);
  if (filter.noRoles && roles.size > 0) return false;
  if (!filter.allRoles.every((id) => roles.has(id))) return false;
  if (filter.anyRoles.length > 0 && !filter.anyRoles.some((id) => roles.has(id))) return false;
  if (filter.excludeRoles.some((id) => roles.has(id))) return false;

  const accountAge = now - member.createdAt;
  if (filter.accountNewerThan !== null && accountAge >= filter.accountNewerThan) return false;
  if (filter.accountOlderThan !== null && accountAge <= filter.accountOlderThan) return false;

  if (filter.joinedNewerThan !== null || filter.joinedOlderThan !== null) {
    if (member.joinedAt === null) return false;
    const joinedAge = now - member.joinedAt;
    if (filter.joinedNewerThan !== null && joinedAge >= filter.joinedNewerThan) return false;
    if (filter.joinedOlderThan !== null && joinedAge <= filter.joinedOlderThan) return false;
  }

  if (filter.inVoice !== null && member.inVoice !== filter.inVoice) return false;
  return true;
}

const SCOPE_LABELS: Record<BulkScope, string> = {
  herkes: 'Herkes',
  uyeler: 'Üyeler (botlar hariç)',
  botlar: 'Botlar',
};

function roleList(ids: readonly string[]): string {
  return ids.map((id) => `<@&${id}>`).join(' ');
}

function userList(ids: readonly string[]): string {
  return ids.map((id) => `<@${id}>`).join(' ');
}

/** Filtreyi önizleme ve log için okunur satırlara çevirir. */
export function describeFilter(filter: BulkRoleFilter): string[] {
  const lines = [`Kapsam: ${SCOPE_LABELS[filter.scope]}`];
  if (filter.users !== null) lines.push(`Kişiler: ${userList(filter.users)}`);
  if (filter.allRoles.length > 0) lines.push(`Rollerin hepsinde: ${roleList(filter.allRoles)}`);
  if (filter.anyRoles.length > 0) {
    lines.push(`Rollerden herhangi birinde: ${roleList(filter.anyRoles)}`);
  }
  if (filter.noRoles) lines.push('Hiç rolü olmayanlar');
  if (filter.excludeRoles.length > 0) lines.push(`Hariç roller: ${roleList(filter.excludeRoles)}`);
  if (filter.excludeUsers.length > 0) lines.push(`Hariç kişiler: ${userList(filter.excludeUsers)}`);
  if (filter.accountNewerThan !== null) {
    lines.push(`Hesabı ${formatDuration(filter.accountNewerThan)} içinde açılmış`);
  }
  if (filter.accountOlderThan !== null) {
    lines.push(`Hesabı ${formatDuration(filter.accountOlderThan)} önceden eski`);
  }
  if (filter.joinedNewerThan !== null) {
    lines.push(`Son ${formatDuration(filter.joinedNewerThan)} içinde katılmış`);
  }
  if (filter.joinedOlderThan !== null) {
    lines.push(`${formatDuration(filter.joinedOlderThan)} önce veya daha eskiden katılmış`);
  }
  if (filter.inVoice === true) lines.push('Şu an seste olanlar');
  if (filter.inVoice === false) lines.push('Şu an seste olmayanlar');
  return lines;
}
