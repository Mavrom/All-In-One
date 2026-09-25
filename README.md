# Discord Bot Altyapıları (discord.js v14)

Bu proje, **discord.js v14** ile sıfırdan yazılan Discord bot altyapılarından oluşan bir koleksiyondur. Tüm botlar ortak bir çekirdeği (yetki sistemi, veritabanı, loglama, komut sistemi) paylaşır ve her biri ayrı bir süreç olarak çalışır.

Proje **aktif olarak geliştirilmektedir**. Mevcut altyapılar güncellenmeye devam eder, yenileri zamanla eklenir. Listedeki botlar şu anki plandır; ihtiyaca göre eklenebilir veya çıkarılabilir.

---

## Teknolojiler

- **Node.js 24 LTS** + **TypeScript**
- **discord.js v14** — slash (`/komut`) ve prefix (`.komut`) desteği
- **MongoDB Atlas** + Mongoose
- **pnpm**, **PM2**, Zod, Pino, Biome, Vitest

---

## Planlanan Altyapılar

Botlar öncelik sırasına göre tek tek geliştirilecektir. **İlk öncelik moderasyon botudur.**

| Sıra | Altyapı | Durum |
|:---:|---|---|
| 1 | Moderasyon | 🚧 Geliştiriliyor |
| 2 | Guard | 📝 Planlandı |
| 3 | İstatistik | 📝 Planlandı |
| 4 | Özel Oda | 📝 Planlandı |
| 5 | Butonlu Rol Seçme | 📝 Planlandı |
| 6 | Eğlence | 📝 Planlandı |
| 7 | Pinterest | 📝 Planlandı |

> Sıralama ve içerik zamanla değişebilir. Durumlar geliştirme ilerledikçe güncellenecektir.

### 🛡️ Moderasyon
Sunucu yetkililerinin kullanacağı temel yönetim araçları.
- Ban / unban, kick, timeout (mute) / unmute
- Uyarı sistemi (uyarı verme, listeleme, silme)
- Mesaj temizleme
- Ceza geçmişi ve sicil
- Moderasyon işlemleri için log kanalı

### 🔒 Guard
Sunucuyu yetkisiz veya zararlı işlemlere karşı koruyan altyapı.
- Kanal / rol oluşturma, silme ve düzenleme koruması
- Toplu ban / kick koruması
- Sunucu ayarları ve webhook koruması
- Bot ekleme koruması
- Güvenli liste (whitelist) sistemi
- Yapılan işlemi geri alma ve işlemi yapanı cezalandırma

### 📊 İstatistik
Sunucudaki üye aktivitesini takip eden altyapı.
- Mesaj ve ses süresi istatistikleri
- Kullanıcı ve sunucu bazlı istatistik görüntüleme
- Sıralama tabloları (günlük / haftalık / tüm zamanlar)

### 🎙️ Özel Oda
Üyelerin kendi ses odalarını oluşturup yönetebildiği altyapı.
- Belirli bir kanala girince otomatik özel oda oluşturma
- Oda sahibi için kontrol paneli (kilitleme, gizleme, limit, isim değiştirme, üye ekleme/atma)
- Oda boşalınca otomatik silme

### 🎭 Butonlu Rol Seçme
Üyelerin butonlar veya menüler aracılığıyla kendilerine rol alabildiği altyapı.
- Buton ve seçim menüsü ile rol alma / bırakma
- Yetkililerin panel oluşturup düzenleyebilmesi
- Tekli veya çoklu seçim desteği

### 🎉 Eğlence
Sunucuyu hareketlendirecek eğlence komutları.
- Mini oyunlar ve eğlence komutları
- İçerik zamanla belirlenecek

### 📌 Pinterest
Pinterest içerikleriyle çalışan altyapı.
- İçerik zamanla belirlenecek

---

## Proje Yapısı

```
All-In-One/
├── src/
│   ├── bots/
│   │   └── moderasyon/     commands/ (kategorilere ayrılmış) + events/ + index.ts
│   ├── core/               bot başlatma, komut/event yükleyici, config, veritabanı
│   ├── models/             ortak veritabanı şemaları
│   ├── services/           ortak servisler (ceza, yetki, limit, log, ayar)
│   └── utils/              yardımcılar
├── config/                 genel.json (sunucu + yetki rolleri), <bot>.json
├── docs/                   tasarım dokümanları
└── .env                    token'lar ve veritabanı adresi (GitHub'a yüklenmez)
```

Moderasyon botunun ayrıntılı tasarımı: [docs/moderasyon-tasarim.md](docs/moderasyon-tasarim.md)

---

## Kurulum

Ayrıntılı kurulum rehberi moderasyon botunun ilk aşaması tamamlandığında eklenecektir.

> ⚠️ Bot token'ınızı kimseyle paylaşmayın. `.env` dosyası GitHub'a yüklenmez.

---

## Güncellemeler

Proje sürekli geliştirildiği için yeni özellikler, düzeltmeler ve eklenen altyapılar bu dosyada ve ilgili botun klasöründe belirtilecektir.
