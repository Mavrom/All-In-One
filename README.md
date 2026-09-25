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
| 1 | Moderasyon | ✅ Aşama 1 tamamlandı |
| 2 | Guard | 📝 Planlandı |
| 3 | İstatistik | 📝 Planlandı |
| 4 | Özel Oda | 📝 Planlandı |
| 5 | Butonlu Rol Seçme | 📝 Planlandı |
| 6 | Eğlence | 📝 Planlandı |
| 7 | Pinterest | 📝 Planlandı |

> Sıralama ve içerik zamanla değişebilir. Durumlar geliştirme ilerledikçe güncellenecektir.

### 🛡️ Moderasyon
Sunucu yetkililerinin kullanacağı temel yönetim araçları. Aşama 1 tamamlandı:
- **Ceza:** ban, unban, banlist, massban, kick, mute, unmute, chatmute, unchatmute, voicemute, unvoicemute, warn, unwarn, jail, unjail, jaillist
- **Sicil:** sicil, siciltemizle, cezalar, case, modlog
- **Ayar:** kurulum, logkur, ayar, yardım
- 3 kademeli yetki sistemi, saatlik ceza limitleri, sıralı ceza numaraları (`#152`)
- Ceza, komut, mesaj ve ses log kanalları
- Çık-gir koruması, Discord üzerinden (sağ tık) verilen cezaların kayda işlenmesi

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
├── ecosystem.config.cjs    PM2 ayarı
└── .env                    token'lar ve veritabanı adresi (GitHub'a yüklenmez)
```

Moderasyon botunun ayrıntılı tasarımı: [docs/moderasyon-tasarim.md](docs/moderasyon-tasarim.md)

---

## Kurulum

### 1. Discord botunu oluşturma
1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** sekmesi → **Reset Token** ile token'ı alın (bir yere not edin).
3. Aynı sayfada **Privileged Gateway Intents** altında **Server Members Intent** ve **Message Content Intent**'i açın.
4. **OAuth2 → URL Generator**: `bot` ve `applications.commands` seçin, izinlerden **Administrator**'ı işaretleyin. Oluşan linkle botu sunucunuza ekleyin.

### 2. MongoDB Atlas
1. [MongoDB Atlas](https://www.mongodb.com/atlas)'ta ücretsiz (M0) bir cluster oluşturun.
2. **Database Access**'ten bir kullanıcı ekleyin, **Network Access**'ten botun çalışacağı IP'ye izin verin (deneme için `0.0.0.0/0`).
3. **Connect → Drivers**'dan bağlantı adresini kopyalayın.

### 3. Dosyaları doldurma
- `.env.example` dosyasını `.env` adıyla kopyalayın; `MONGODB_URI`, `MODERASYON_TOKEN` ve isterseniz `DEVELOPER_IDS` değerlerini yazın.
- `config/genel.json`: `sunucuId` alanına sunucu ID'sini, `yetkiRolleri` altına düşük/orta/yüksek yetki rol ID'lerini yazın (sonradan `.ayar yetki` ile de ayarlanabilir).
- `config/moderasyon.json`: prefix, saatlik ceza limitleri ve komut kademe değişiklikleri.

> ID'leri kopyalamak için Discord'da **Ayarlar → Gelişmiş → Geliştirici Modu**'nu açıp sağ tık → **ID'yi Kopyala**.

### 4. Çalıştırma
Gerekenler: [Node.js 24](https://nodejs.org) ve pnpm (`npm i -g pnpm`).

```bash
pnpm install
pnpm dev:moderasyon      # geliştirme: değişiklikte yeniden başlar
```

Sürekli çalıştırmak için (Windows veya VDS):

```bash
pnpm build
pnpm start               # PM2 ile arka planda başlatır
pnpm stop                # durdurur
```

### 5. Discord'da ilk ayarlar
1. `.kurulum` — Cezalı, Chat Mute, Voice Mute rollerini ve `#cezalı` kanalını oluşturur, kanal izinlerini ayarlar.
2. `.logkur` — `📁 Loglar` kategorisini ve log kanallarını açar.
3. **Sunucu Ayarları → Entegrasyonlar** → bot: slash komutlarının yalnızca yetkililere görünmesini ayarlayın.
4. Botun rolünü ceza rollerinin ve yetkililerin rollerinin **üstüne** taşıyın.

Tüm komutları görmek için `.yardım`, bir komutun kullanımı için `.yardım <komut>`.

> ⚠️ Bot token'ınızı kimseyle paylaşmayın. `.env` dosyası GitHub'a yüklenmez.

---

## Güncellemeler

Proje sürekli geliştirildiği için yeni özellikler, düzeltmeler ve eklenen altyapılar bu dosyada ve ilgili botun klasöründe belirtilecektir.
