import { Setting } from '#models/Setting.js';

/** `SettingsService` yapıcısına verilen seçenekler. */
export interface SettingsServiceOptions {
  guildId: string;
  scope: string;
  defaults: Record<string, unknown>;
}

/** Bir ayarın çözümlenmiş görünümü ({@link SettingsService.entries}). */
export interface SettingEntry {
  key: string;
  value: unknown;
  overridden: boolean;
}

/**
 * Bir sunucu ve kapsam (`scope`) için ayarları katmanlı okur: önce veritabanındaki
 * (`Setting` koleksiyonu) dinamik değer, yoksa `defaults`'taki kod varsayılanı. Okumalar
 * bellekteki önbellekten yapılır; güncel kalması için {@link load} çağrılmalıdır.
 */
export class SettingsService {
  private readonly guildId: string;
  private readonly scope: string;
  private readonly defaults: Record<string, unknown>;
  private readonly overrides = new Map<string, unknown>();

  constructor(opts: SettingsServiceOptions) {
    this.guildId = opts.guildId;
    this.scope = opts.scope;
    this.defaults = opts.defaults;
  }

  /** Veritabanındaki override'ları önbelleğe yükler. */
  async load(): Promise<void> {
    const docs = await Setting.find({ guildId: this.guildId, scope: this.scope }).lean();
    this.overrides.clear();
    for (const doc of docs) {
      this.overrides.set(doc.key, doc.value);
    }
  }

  /** `key` için override varsa onu, yoksa kod varsayılanını (bulunamazsa `undefined`) döner. */
  get<T = unknown>(key: string): T | undefined {
    if (this.overrides.has(key)) {
      return this.overrides.get(key) as T;
    }
    return this.defaults[key] as T | undefined;
  }

  /** `key` için çözümlenmiş bir değer (override veya varsayılan) var mı. */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /** `key` veritabanında override edilmiş mi (değeri `null` olsa dahi). */
  isOverridden(key: string): boolean {
    return this.overrides.has(key);
  }

  /** `key`'i veritabanına yazar (upsert) ve önbelleği günceller. */
  async set(key: string, value: unknown, updatedBy?: string): Promise<void> {
    await Setting.findOneAndUpdate(
      { guildId: this.guildId, scope: this.scope, key },
      { $set: { value, updatedBy: updatedBy ?? null, updatedAt: new Date() } },
      { upsert: true },
    );
    this.overrides.set(key, value);
  }

  /** `key`'in override kaydını siler; sonraki okumalar kod varsayılanına döner. */
  async reset(key: string): Promise<void> {
    await Setting.deleteOne({ guildId: this.guildId, scope: this.scope, key });
    this.overrides.delete(key);
  }

  /** Varsayılan ve override edilmiş anahtarların birleşimini, anahtara göre sıralı döner. */
  entries(): SettingEntry[] {
    const keys = new Set<string>([...Object.keys(this.defaults), ...this.overrides.keys()]);
    return [...keys].sort().map((key) => ({
      key,
      value: this.get(key),
      overridden: this.isOverridden(key),
    }));
  }
}
