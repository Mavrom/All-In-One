# Discord Bot Altyapıları (discord.js v14)

Bu proje, **discord.js v14** ile sıfırdan yazılan Discord bot altyapılarından oluşan bir koleksiyondur. Her bot kendi başına çalışabilen, bağımsız bir altyapı olarak tasarlanır.

Proje **aktif olarak geliştirilmektedir**. Mevcut altyapılar güncellenmeye devam eder, yenileri zamanla eklenir. Listedeki botlar şu anki plandır; ihtiyaca göre eklenebilir veya çıkarılabilir.

---

## Teknolojiler

- **Node.js** (v18 veya üstü)
- **discord.js v14**
- Slash komutları (`/komut`) ve etkileşimler (buton, menü, modal)

---

## Planlanan Altyapılar

Botlar öncelik sırasına göre tek tek geliştirilecektir. **İlk öncelik moderasyon botudur.**

| Sıra | Altyapı | Durum |
|:---:|---|---|
| 1 | Moderasyon | 🔜 Sırada |
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

Her bot kendi klasöründe, bağımsız olarak yer alır:

```
Altyapı Projesi/
├── moderasyon/
├── guard/
├── istatistik/
├── ozel-oda/
├── rol-secme/
├── eglence/
├── pinterest/
└── README.md
```

> Klasör yapısı ilk altyapı yazıldıkça netleşecek ve burada güncellenecektir.

---

## Kurulum (Genel)

Her botun kendi klasöründe ayrıntılı kurulum notları bulunacaktır. Genel adımlar:

1. Kullanmak istediğiniz botun klasörüne girin.
2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
3. Yapılandırma dosyasını doldurun (bot token'ı, sunucu ID'si, kanal ve rol ID'leri vb.).
4. Botu başlatın:
   ```bash
   npm start
   ```

> ⚠️ Bot token'ınızı kimseyle paylaşmayın ve herkese açık bir depoya yüklemeyin.

---

## Güncellemeler

Proje sürekli geliştirildiği için yeni özellikler, düzeltmeler ve eklenen altyapılar bu dosyada ve ilgili botun klasöründe belirtilecektir.
