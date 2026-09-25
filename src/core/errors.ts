/** Kullanıcıya olduğu gibi gösterilecek hata (stack trace loglanmaz, mesaj Türkçe). */
export class UserError extends Error {}

/** Yapılandırma dosyası veya ortam değişkeni doğrulama hatası; bot bu hata ile başlamaz. */
export class ConfigError extends Error {}
