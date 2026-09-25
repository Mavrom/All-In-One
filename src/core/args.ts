/** Tüm argüman tanımlarının paylaştığı alanlar. */
interface BaseArgDef {
  description: string;
  optional?: boolean;
}

/** Tek bir kullanıcı (etiket veya ID); değeri kullanıcı ID'si. */
export interface UserArgDef extends BaseArgDef {
  kind: 'user';
}

/** Birden çok kullanıcı (ardışık etiket/ID); değeri ID dizisi. */
export interface UsersArgDef extends BaseArgDef {
  kind: 'users';
}

/** Tek bir rol (etiket veya ID); değeri rol ID'si. */
export interface RoleArgDef extends BaseArgDef {
  kind: 'role';
}

/** Tek bir kanal (etiket veya ID); değeri kanal ID'si. */
export interface ChannelArgDef extends BaseArgDef {
  kind: 'channel';
}

/** Türkçe süre metni (`"7g"` gibi); değeri milisaniye. */
export interface DurationArgDef extends BaseArgDef {
  kind: 'duration';
}

/** Bir sayı; `integer` tam sayı zorunluluğu, `min`/`max` sınır kontrolü ekler. */
export interface NumberArgDef extends BaseArgDef {
  kind: 'number';
  integer?: boolean;
  min?: number;
  max?: number;
}

/** Tek kelime; `choices` verilirse yalnızca o seçeneklerden biri kabul edilir. */
export interface StringArgDef extends BaseArgDef {
  kind: 'string';
  choices?: readonly string[];
}

/** Satırın kalan tamamı (boşluklarla birleştirilmiş). */
export interface TextArgDef extends BaseArgDef {
  kind: 'text';
}

/** Bir komutun tek bir argüman tanımı olabilecek türlerin birleşimi. */
export type ArgDef =
  | UserArgDef
  | UsersArgDef
  | RoleArgDef
  | ChannelArgDef
  | DurationArgDef
  | NumberArgDef
  | StringArgDef
  | TextArgDef;

/** Bir komutun (veya alt komutun) argüman şeması: anahtar → argüman tanımı. */
export type ArgDefMap = Record<string, ArgDef>;

type ArgValueOf<D extends ArgDef> = D extends { kind: 'user' | 'role' | 'channel' }
  ? string
  : D extends { kind: 'users' }
    ? string[]
    : D extends { kind: 'duration' | 'number' }
      ? number
      : string;

/**
 * Bir argüman şemasından ayrıştırılmış değerlerin türü: opsiyonel argümanlar `| undefined`
 * içerir. `arg.*` yardımcılarının `const` tür parametreleri sayesinde `optional: true`
 * literal olarak korunur ve bu koşul doğru çalışır.
 */
export type ArgValues<A extends ArgDefMap> = {
  [K in keyof A]: A[K] extends { optional: true } ? ArgValueOf<A[K]> | undefined : ArgValueOf<A[K]>;
};

/** Argüman tanımlarını tür güvenli biçimde oluşturmak için yardımcılar. */
export const arg = {
  user<const O extends Omit<UserArgDef, 'kind'>>(o: O): O & { kind: 'user' } {
    return { ...o, kind: 'user' };
  },
  users<const O extends Omit<UsersArgDef, 'kind'>>(o: O): O & { kind: 'users' } {
    return { ...o, kind: 'users' };
  },
  role<const O extends Omit<RoleArgDef, 'kind'>>(o: O): O & { kind: 'role' } {
    return { ...o, kind: 'role' };
  },
  channel<const O extends Omit<ChannelArgDef, 'kind'>>(o: O): O & { kind: 'channel' } {
    return { ...o, kind: 'channel' };
  },
  duration<const O extends Omit<DurationArgDef, 'kind'>>(o: O): O & { kind: 'duration' } {
    return { ...o, kind: 'duration' };
  },
  number<const O extends Omit<NumberArgDef, 'kind'>>(o: O): O & { kind: 'number' } {
    return { ...o, kind: 'number' };
  },
  string<const O extends Omit<StringArgDef, 'kind'>>(o: O): O & { kind: 'string' } {
    return { ...o, kind: 'string' };
  },
  text<const O extends Omit<TextArgDef, 'kind'>>(o: O): O & { kind: 'text' } {
    return { ...o, kind: 'text' };
  },
};
