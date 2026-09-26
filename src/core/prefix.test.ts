import { describe, expect, expectTypeOf, it } from 'vitest';
import { type ArgValues, arg } from './args.js';
import { parsePrefixArgs, tokenize, usage } from './prefix.js';

const USER_ID = '123456789012345678';
const USER_ID_2 = '234567890123456789';

const banArgs = {
  kullanici: arg.user({ description: 'Hedef kullanıcı' }),
  sure: arg.duration({ description: 'Süre', optional: true }),
  sebep: arg.text({ description: 'Sebep', optional: true }),
};

describe('tokenize', () => {
  it('boşluklara göre böler ve fazla boşlukları atar', () => {
    expect(tokenize(`  ${USER_ID}   7g   reklam   yapıyor  `)).toEqual([
      USER_ID,
      '7g',
      'reklam',
      'yapıyor',
    ]);
  });

  it('boş girdi için boş dizi döner', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('parsePrefixArgs — ban (user, duration?, text?)', () => {
  it('tüm argümanlar verildiğinde ID, ms ve sebebi ayrıştırır', () => {
    const result = parsePrefixArgs(tokenize(`<@${USER_ID}> 7g reklam yapıyor`), banArgs);
    expect(result).toEqual({
      ok: true,
      values: { kullanici: USER_ID, sure: 604_800_000, sebep: 'reklam yapıyor' },
    });
  });

  it('süre formatına uymayan ilk kelime sebebin parçası sayılır', () => {
    const result = parsePrefixArgs(tokenize(`${USER_ID} reklam`), banArgs);
    expect(result).toEqual({
      ok: true,
      values: { kullanici: USER_ID, sure: undefined, sebep: 'reklam' },
    });
  });

  it('yalnızca kullanıcı verildiğinde diğerleri undefined olur (<@!ID> biçimi)', () => {
    const result = parsePrefixArgs(tokenize(`<@!${USER_ID}>`), banArgs);
    expect(result).toEqual({
      ok: true,
      values: { kullanici: USER_ID, sure: undefined, sebep: undefined },
    });
  });

  it('boş girdide "Eksik argüman: kullanici" döner', () => {
    const result = parsePrefixArgs(tokenize(''), banArgs);
    expect(result).toEqual({ ok: false, error: 'Eksik argüman: kullanici' });
  });

  it('geçersiz kullanıcı için "Geçersiz kullanıcı: abc" döner', () => {
    const result = parsePrefixArgs(tokenize('abc'), banArgs);
    expect(result).toEqual({ ok: false, error: 'Geçersiz kullanıcı: abc' });
  });
});

describe('parsePrefixArgs — mute (user, duration zorunlu)', () => {
  const muteArgs = {
    kullanici: arg.user({ description: 'Hedef kullanıcı' }),
    sure: arg.duration({ description: 'Süre' }),
  };

  it('geçersiz süre için "Geçersiz süre: abc" döner', () => {
    const result = parsePrefixArgs(tokenize(`<@${USER_ID}> abc`), muteArgs);
    expect(result).toEqual({ ok: false, error: 'Geçersiz süre: abc' });
  });
});

describe('parsePrefixArgs — massban (users, text?)', () => {
  const massbanArgs = {
    kullanicilar: arg.users({ description: 'Hedef kullanıcılar' }),
    sebep: arg.text({ description: 'Sebep', optional: true }),
  };

  it('ardışık kullanıcı tokenlerini toplar, kalanı sebep sayar', () => {
    const result = parsePrefixArgs(tokenize(`${USER_ID} <@${USER_ID_2}> spam`), massbanArgs);
    expect(result).toEqual({
      ok: true,
      values: { kullanicilar: [USER_ID, USER_ID_2], sebep: 'spam' },
    });
  });
});

describe('parsePrefixArgs — string choices', () => {
  it('büyük/küçük harf duyarsız eşleşir ve kanonik değeri döner', () => {
    const args = { tur: arg.string({ description: 'Tür', choices: ['ban', 'jail'] }) };
    const result = parsePrefixArgs(tokenize('JAIL'), args);
    expect(result).toEqual({ ok: true, values: { tur: 'jail' } });
  });

  it('Türkçe seçenekler foldTurkish(trLower(...)) ile eşleşir', () => {
    const args = { durum: arg.string({ description: 'Durum', choices: ['kapalı', 'açık'] }) };

    expect(parsePrefixArgs(tokenize('KAPALI'), args)).toEqual({
      ok: true,
      values: { durum: 'kapalı' },
    });
    expect(parsePrefixArgs(tokenize('kapali'), args)).toEqual({
      ok: true,
      values: { durum: 'kapalı' },
    });
    expect(parsePrefixArgs(tokenize('Kapalı'), args)).toEqual({
      ok: true,
      values: { durum: 'kapalı' },
    });
  });

  it('opsiyonel ve eşleşmeyen seçenek atlanır', () => {
    const args = {
      tur: arg.string({ description: 'Tür', choices: ['ban', 'jail'], optional: true }),
    };
    const result = parsePrefixArgs(tokenize('xyz'), args);
    expect(result).toEqual({ ok: true, values: { tur: undefined } });
  });

  it('zorunlu ve eşleşmeyen seçenek için hata döner', () => {
    const args = { tur: arg.string({ description: 'Tür', choices: ['ban', 'jail'] }) };
    const result = parsePrefixArgs(tokenize('xyz'), args);
    expect(result).toEqual({ ok: false, error: 'Geçersiz seçenek: xyz (ban, jail)' });
  });
});

describe('parsePrefixArgs — number', () => {
  const args = { sayi: arg.number({ description: 'Ceza no' }) };

  it('düz sayıyı ayrıştırır', () => {
    expect(parsePrefixArgs(tokenize('152'), args)).toEqual({
      ok: true,
      values: { sayi: 152 },
    });
  });

  it('başındaki # işaretini yoksayar', () => {
    expect(parsePrefixArgs(tokenize('#152'), args)).toEqual({
      ok: true,
      values: { sayi: 152 },
    });
  });

  it('integer:true ile tam sayı olmayanı reddeder', () => {
    const intArgs = { sayi: arg.number({ description: 'Sayı', integer: true }) };
    expect(parsePrefixArgs(tokenize('1.5'), intArgs)).toEqual({
      ok: false,
      error: 'Geçersiz sayı: 1.5',
    });
  });

  it('min altında hata döner', () => {
    const minArgs = { sayi: arg.number({ description: 'Sayı', min: 5 }) };
    expect(parsePrefixArgs(tokenize('3'), minArgs)).toEqual({
      ok: false,
      error: 'Sayı en az 5 olmalı',
    });
  });

  it('max üstünde hata döner', () => {
    const maxArgs = { sayi: arg.number({ description: 'Sayı', max: 5 }) };
    expect(parsePrefixArgs(tokenize('9'), maxArgs)).toEqual({
      ok: false,
      error: 'Sayı en fazla 5 olmalı',
    });
  });

  it('opsiyonel sayı min altında ise undefined olur ve token tüketilmez', () => {
    const optionalArgs = {
      sayi: arg.number({ description: 'Sayı', min: 5, optional: true }),
      metin: arg.text({ description: 'Metin', optional: true }),
    };
    expect(parsePrefixArgs(tokenize('3'), optionalArgs)).toEqual({
      ok: true,
      values: { sayi: undefined, metin: '3' },
    });
  });

  it('opsiyonel sayı max üstünde ise undefined olur ve token tüketilmez', () => {
    const optionalArgs = {
      sayi: arg.number({ description: 'Sayı', max: 5, optional: true }),
      metin: arg.text({ description: 'Metin', optional: true }),
    };
    expect(parsePrefixArgs(tokenize('9'), optionalArgs)).toEqual({
      ok: true,
      values: { sayi: undefined, metin: '9' },
    });
  });
});

describe('parsePrefixArgs — role/channel', () => {
  const ROLE_ID = '345678901234567890';
  const CHANNEL_ID = '456789012345678901';

  it("rol etiketini (<@&ID>) ve düz ID'yi ayrıştırır", () => {
    const args = { rol: arg.role({ description: 'Rol' }) };
    expect(parsePrefixArgs(tokenize(`<@&${ROLE_ID}>`), args)).toEqual({
      ok: true,
      values: { rol: ROLE_ID },
    });
    expect(parsePrefixArgs(tokenize(ROLE_ID), args)).toEqual({
      ok: true,
      values: { rol: ROLE_ID },
    });
  });

  it('geçersiz rol için "Geçersiz rol: abc" döner', () => {
    const args = { rol: arg.role({ description: 'Rol' }) };
    expect(parsePrefixArgs(tokenize('abc'), args)).toEqual({
      ok: false,
      error: 'Geçersiz rol: abc',
    });
  });

  it("kanal etiketini (<#ID>) ve düz ID'yi ayrıştırır", () => {
    const args = { kanal: arg.channel({ description: 'Kanal' }) };
    expect(parsePrefixArgs(tokenize(`<#${CHANNEL_ID}>`), args)).toEqual({
      ok: true,
      values: { kanal: CHANNEL_ID },
    });
    expect(parsePrefixArgs(tokenize(CHANNEL_ID), args)).toEqual({
      ok: true,
      values: { kanal: CHANNEL_ID },
    });
  });

  it('geçersiz kanal için "Geçersiz kanal: abc" döner', () => {
    const args = { kanal: arg.channel({ description: 'Kanal' }) };
    expect(parsePrefixArgs(tokenize('abc'), args)).toEqual({
      ok: false,
      error: 'Geçersiz kanal: abc',
    });
  });
});

describe('usage', () => {
  it('zorunlu ve opsiyonel argümanları doğru biçimlendirir', () => {
    expect(usage('ban', banArgs, '.')).toBe('.ban <kullanici> [sure] [sebep]');
  });

  it('alt komutla birlikte biçimlendirir', () => {
    const args = {
      tur: arg.string({ description: 'Tür' }),
      sayi: arg.number({ description: 'Sayı' }),
    };
    expect(usage('ayar', args, '.', 'limit')).toBe('.ayar limit <tur> <sayi>');
  });

  it('argüman yoksa yalın komut adını döner', () => {
    expect(usage('banlist', {}, '.')).toBe('.banlist');
  });

  it('users tipi için "..." eki ekler', () => {
    const args = { kullanicilar: arg.users({ description: 'Kullanıcılar' }) };
    expect(usage('massban', args, '.')).toBe('.massban <kullanicilar...>');
  });
});

describe('slashOnly argümanlar', () => {
  const args = {
    rol: arg.role({ description: 'Rol', optional: true }),
    rolde: arg.role({ description: 'Rolde', optional: true, slashOnly: true }),
    filtre: arg.text({ description: 'Filtre', optional: true }),
  };

  it('prefix ayrıştırması slashOnly argümanı atlar, token sonrakine kalır', () => {
    const result = parsePrefixArgs(tokenize('<@&111111111111111111> <@&222222222222222222>'), args);
    expect(result).toEqual({
      ok: true,
      values: { rol: '111111111111111111', rolde: undefined, filtre: '<@&222222222222222222>' },
    });
  });

  it('kullanım metninde slashOnly argüman görünmez', () => {
    expect(usage('toplurol', args, '.')).toBe('.toplurol [rol] [filtre]');
  });
});

describe('tür kontrolleri', () => {
  it('ArgValues opsiyonel argümanları | undefined yapar', () => {
    type Values = ArgValues<typeof banArgs>;
    expectTypeOf<Values['kullanici']>().toEqualTypeOf<string>();
    expectTypeOf<Values['sure']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Values['sebep']>().toEqualTypeOf<string | undefined>();
  });
});
