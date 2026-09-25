/** `ayar sıfırla` ile config değerine döndürülebilen anahtar önekleri. */
const RESETTABLE_PREFIXES = ['limit.', 'kademe.', 'yetki.'];

/**
 * Bir ayarın `ayar sıfırla` ile sıfırlanıp sıfırlanamayacağı. Kurulum/logkur'un oluşturduğu
 * rol ve kanal ID'leri ile iç anahtarlar (`_` ile başlayan) sıfırlanamaz.
 */
export function isResettableKey(key: string): boolean {
  return key === 'prefix' || RESETTABLE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Bir ayar değerini Discord'da okunur hale getirir: rol/kanal ID'lerini etiketler. */
export function formatSettingValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key.startsWith('yetki.') || key.startsWith('rol.')) return `<@&${String(value)}>`;
  if (key.startsWith('kanal.') || key.startsWith('kategori.')) return `<#${String(value)}>`;
  return `\`${String(value)}\``;
}
