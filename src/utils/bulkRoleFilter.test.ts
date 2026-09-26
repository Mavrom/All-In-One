import { describe, expect, it } from 'vitest';
import { UserError } from '#core/errors.js';
import {
  type BulkRoleFilter,
  describeFilter,
  emptyFilter,
  type FilterMember,
  matchesFilter,
  parseFilter,
} from './bulkRoleFilter.js';

const A = '111111111111111111';
const B = '222222222222222222';
const C = '333333333333333333';
const U1 = '444444444444444444';
const U2 = '555555555555555555';
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000 * DAY;

const roles = new Set([A, B, C]);
const isRole = (id: string): boolean => roles.has(id);
const parse = (input: string): BulkRoleFilter => parseFilter(input, isRole);

function member(overrides: Partial<FilterMember> = {}): FilterMember {
  return {
    id: U1,
    bot: false,
    createdAt: NOW - 100 * DAY,
    joinedAt: NOW - 50 * DAY,
    roleIds: [],
    inVoice: false,
    ...overrides,
  };
}

describe('parseFilter', () => {
  it('boş metin herkesi seçen filtre döner', () => {
    expect(parse('')).toEqual(emptyFilter());
  });

  it('kapsam kelimelerini Türkçe karaktersiz de tanır', () => {
    expect(parse('üyeler').scope).toBe('uyeler');
    expect(parse('UYELER').scope).toBe('uyeler');
    expect(parse('botlar').scope).toBe('botlar');
  });

  it('rolde, herhangi, hariç ve kişiler etiketleri toplar', () => {
    const filter = parse(
      `rolde <@&${A}> <@&${B}> herhangi ${C} hariç <@&${C}> <@${U2}> kişiler <@!${U1}> ${U2}`,
    );
    expect(filter.allRoles).toEqual([A, B]);
    expect(filter.anyRoles).toEqual([C]);
    expect(filter.excludeRoles).toEqual([C]);
    expect(filter.excludeUsers).toEqual([U2]);
    expect(filter.users).toEqual([U1, U2]);
  });

  it('hesap ve katılım karşılaştırmalarını boşluklu da okur', () => {
    const filter = parse('hesap<7g hesap > 1g katılım<12sa');
    expect(filter.accountNewerThan).toBe(7 * DAY);
    expect(filter.accountOlderThan).toBe(DAY);
    expect(filter.joinedNewerThan).toBe(DAY / 2);
  });

  it('seste, sestedeğil ve rolsüz bayraklarını okur', () => {
    expect(parse('seste').inVoice).toBe(true);
    expect(parse('seste-değil').inVoice).toBe(false);
    expect(parse('rolsüz').noRoles).toBe(true);
  });

  it.each([
    ['bilinmeyen kelime', 'falan'],
    ['sahipsiz etiket', `<@&${A}>`],
    ['boş liste', `rolde hariç <@&${A}>`],
    ['rolde sonrası kullanıcı', `rolde <@${U1}>`],
    ['kişiler sonrası rol', `kişiler <@&${A}>`],
    ['iki farklı kapsam', 'üyeler botlar'],
    ['seste çelişkisi', 'seste sestedeğil'],
    ['rolsüz + rolde', `rolsüz rolde <@&${A}>`],
    ['hesap çelişkisi', 'hesap<1g hesap>7g'],
    ['geçersiz süre', 'hesap<yarın'],
  ])('%s hata verir', (_, input) => {
    expect(() => parse(input)).toThrow(UserError);
  });
});

describe('matchesFilter', () => {
  it('kapsam bot/üye ayrımını uygular', () => {
    const bot = member({ bot: true });
    expect(matchesFilter(bot, parse('üyeler'), NOW)).toBe(false);
    expect(matchesFilter(bot, parse('botlar'), NOW)).toBe(true);
    expect(matchesFilter(member(), parse('botlar'), NOW)).toBe(false);
  });

  it('rolde hepsini, herhangi en az birini ister', () => {
    const m = member({ roleIds: [A] });
    expect(matchesFilter(m, parse(`rolde ${A} ${B}`), NOW)).toBe(false);
    expect(matchesFilter(m, parse(`herhangi ${A} ${B}`), NOW)).toBe(true);
  });

  it('hariç roller ve kişiler eşleşmez', () => {
    expect(matchesFilter(member({ roleIds: [C] }), parse(`hariç ${C}`), NOW)).toBe(false);
    expect(matchesFilter(member(), parse(`hariç <@${U1}>`), NOW)).toBe(false);
  });

  it('kişiler yalnızca listedekileri seçer', () => {
    expect(matchesFilter(member(), parse(`kişiler <@${U2}>`), NOW)).toBe(false);
    expect(matchesFilter(member({ id: U2 }), parse(`kişiler <@${U2}>`), NOW)).toBe(true);
  });

  it('rolsüz yalnızca rolü olmayanları seçer', () => {
    expect(matchesFilter(member(), parse('rolsüz'), NOW)).toBe(true);
    expect(matchesFilter(member({ roleIds: [A] }), parse('rolsüz'), NOW)).toBe(false);
  });

  it('hesap ve katılım yaşını karşılaştırır', () => {
    const fresh = member({ createdAt: NOW - 2 * DAY, joinedAt: NOW - DAY / 4 });
    expect(matchesFilter(fresh, parse('hesap<7g'), NOW)).toBe(true);
    expect(matchesFilter(fresh, parse('hesap>7g'), NOW)).toBe(false);
    expect(matchesFilter(fresh, parse('katılım<1g'), NOW)).toBe(true);
    expect(matchesFilter(member(), parse('katılım<1g'), NOW)).toBe(false);
    expect(matchesFilter(member({ joinedAt: null }), parse('katılım>1g'), NOW)).toBe(false);
  });

  it('ses durumunu karşılaştırır', () => {
    expect(matchesFilter(member({ inVoice: true }), parse('seste'), NOW)).toBe(true);
    expect(matchesFilter(member(), parse('seste'), NOW)).toBe(false);
    expect(matchesFilter(member(), parse('sestedeğil'), NOW)).toBe(true);
  });
});

describe('describeFilter', () => {
  it('boş filtre yalnızca kapsamı yazar', () => {
    expect(describeFilter(emptyFilter())).toEqual(['Kapsam: Herkes']);
  });

  it('dolu filtreyi satırlara çevirir', () => {
    const lines = describeFilter(parse(`üyeler rolde ${A} hariç ${B} hesap<7g seste`));
    expect(lines).toEqual([
      'Kapsam: Üyeler (botlar hariç)',
      `Rollerin hepsinde: <@&${A}>`,
      `Hariç roller: <@&${B}>`,
      'Hesabı 7 gün içinde açılmış',
      'Şu an seste olanlar',
    ]);
  });
});
