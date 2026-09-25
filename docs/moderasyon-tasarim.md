# Moderasyon Botu — Aşama 1 Tasarımı

> Tarih: 2026-09-25 · Durum: Onay bekliyor

Bu doküman All-In-One projesinin ortak çekirdeğini ve moderasyon botunun ilk aşamasını tanımlar. Sonraki botlar (guard, istatistik, özel oda…) bu çekirdeğin üzerine kurulacaktır.

---

## 1. Kapsam

Moderasyon botu 4 aşamada geliştirilir. Bu doküman yalnızca **Aşama 1**'i kapsar.

| Aşama | İçerik |
|---|---|
| **1. Çekirdek + Ceza sistemi** | Ortak altyapı, yetki/limit sistemi, ceza ve sicil komutları, kurulum, logkur, ayar, yardım |
| 2. Kanal + Ses yönetimi | clear, sil, clearuser, clearbot, clearlinks, slowmode, kilit, move, moveall, disconnect, disconnectall, isim |
| 3. Otomatik moderasyon | küfür-engel, reklam-engel, yasaklı-kelime, görsel-engel, hesap-koruma |
| 4. Otorol | otorol, otorolkapat |

**Aşama 1 dışında kalanlar:** yukarıdaki diğer aşamalar, üye logu (giriş-çıkış, rol, isim), uyarı sayısına göre otomatik ceza, çoklu sunucu desteği, çoklu dil.

---

## 2. Teknolojiler

| Konu | Seçim |
|---|---|
| Çalışma ortamı | Node.js 24 LTS |
| Dil | TypeScript (`strict`), ES modules |
| Discord | discord.js v14 |
| Veritabanı | MongoDB Atlas + Mongoose |
| Paket yöneticisi | pnpm |
| Ayar doğrulama | Zod |
| Loglama | Pino (geliştirmede okunaklı çıktı, yayında `logs/` klasörüne dosya) |
| Lint + format | Biome |
| Test | Vitest + mongodb-memory-server |
| Geliştirme | tsx (watch modu) |
| Süreç yöneticisi | PM2 |
| CI | GitHub Actions (her push'ta `check` + `test`) |

Kod Windows'ta ve Linux'ta değişiklik gerektirmeden çalışır (geliştirme Windows'ta, yayın ileride VDS'te).

---

## 3. Klasör Yapısı

```
All-In-One/
├── src/
│   ├── bots/
│   │   └── moderasyon/
│   │       ├── commands/
│   │       │   ├── ceza/      ban, unban, banlist, massban, kick, mute, unmute,
│   │       │   │              chatmute, unchatmute, voicemute, unvoicemute,
│   │       │   │              warn, unwarn, jail, unjail, jaillist
│   │       │   ├── sicil/     sicil, siciltemizle, cezalar, case, modlog
│   │       │   └── ayar/      kurulum, logkur, ayar, yardım
│   │       ├── events/
│   │       └── index.ts
│   ├── core/                  bot başlatma, komut/event yükleyici, config okuma, veritabanı bağlantısı
│   ├── models/                veritabanı şemaları
│   ├── services/              ceza, yetki, limit, log, ayar
│   └── utils/                 embed, logger, süre çözücü, Türkçe metinler
├── config/
│   ├── genel.json
│   └── moderasyon.json
├── docs/
├── .env
├── ecosystem.config.cjs
└── package.json · tsconfig.json · biome.json · README.md
```

**Kurallar**
- `src/` altındaki `core`, `models`, `services`, `utils` yalnızca **ortak** kod içerir. Bir bota özel kod o botun klasöründe kalır.
- Bir bot başka bir botun klasöründen import yapmaz. Ortak ihtiyaç `src/services/`'e taşınır.
- Her dosyada tek komut veya tek event bulunur; dosya adı komut adıyla aynıdır.
- Komut kategorisi bulunduğu klasörden (`ceza/`, `sicil/`, `ayar/`) otomatik alınır.
- Testler test ettikleri dosyanın yanında durur: `duration.ts` → `duration.test.ts`.
- Import yolları `@/` takma adıyla yazılır: `@/services/PunishmentService`.
- Kod içi isimler İngilizce, kullanıcıya görünen tüm metinler Türkçe.

---

## 4. Ayarlar

Ayarlar üç kaynaktan gelir. Kod ayarlara tek bir erişim noktasından (ayar servisi) ulaşır.

| Kaynak | İçerik | GitHub'a gider mi? |
|---|---|---|
| `.env` | `MONGODB_URI`, `MODERASYON_TOKEN`, `DEVELOPER_IDS` (virgülle ayrılmış kullanıcı ID'leri) | **Hayır** (`.gitignore`) |
| `config/genel.json` | Sunucu ID'si, düşük/orta/yüksek yetki rol ID'leri — tüm botlar ortak kullanır | Evet (boş değerlerle) |
| `config/moderasyon.json` | Prefix, limit başlangıç değerleri, komut kademe değişiklikleri | Evet |
| Veritabanı (dinamik) | `.ayar` ile değiştirilen değerler, `kurulum`/`logkur` ile oluşan rol ve kanal ID'leri | — |

**Okuma sırası:** önce veritabanındaki dinamik değer, yoksa config dosyasındaki değer. Tüm dosyalar bot açılırken Zod ile doğrulanır; eksik veya hatalı alan varsa bot net bir hata mesajıyla açılmaz.

`config/genel.json`
```json
{
  "sunucuId": "",
  "yetkiRolleri": { "dusuk": "", "orta": "", "yuksek": "" }
}
```

`config/moderasyon.json`
```json
{
  "prefix": ".",
  "limitler": { "pencere": "1sa", "ban": 10, "kick": 10, "jail": 20 },
  "kademeler": {}
}
```
`kademeler`, komut dosyasındaki varsayılan kademeyi değiştirmek içindir: `{ "kick": 3 }`.

---

## 5. Komut Sistemi

Her komut tek bir tanımla yazılır; aynı tanımdan hem slash (`/ban`) hem prefix (`.ban`) komutu üretilir.

```ts
export default defineCommand({
  name: 'ban',
  aliases: ['yasakla'],
  description: 'Kullanıcıyı sunucudan yasaklar',
  level: 3,
  args: {
    user:     arg.user({ description: 'Banlanacak kullanıcı' }),
    duration: arg.duration({ description: 'Süre (örn. 7g)', optional: true }),
    reason:   arg.text({ description: 'Sebep', optional: true }),
  },
  async run(ctx, { user, duration, reason }) { /* ... */ },
});
```

- **Argüman türleri:** `user` (etiket veya ID), `role`, `channel`, `number`, `duration`, `string` (tek kelime / seçenek listesi), `text` (satırın geri kalanı). Alt komutlar (`/ayar limit`) desteklenir.
- **`ctx`** slash ve prefix için aynı arayüzü sunar: `ctx.reply()`, `ctx.defer()`, `ctx.member`, `ctx.guild`, `ctx.channel`.

**Çalışma akışı**
1. Komut bulunur (slash: ad; prefix: ad veya alias, Türkçe büyük/küçük harf duyarsız — `.UYARI` = `.uyarı`; Türkçe karakterli komutların ASCII alias'ı olur: `uyari`).
2. Yetki kontrolü → yetersizse "Bu komut için **yüksek yetki** gerekli" (slash'ta yalnızca kullanıcıya görünür).
3. Argüman ayrıştırma → hatalıysa doğru kullanım örneği gösterilir. Prefix'te isteğe bağlı süre, ilk kelime süre formatına uyuyorsa süre, uymuyorsa sebebin parçası sayılır.
4. Komut çalıştırılır. 3 saniyeden uzun sürebilecek işlemler önce `defer` eder.
5. `komut-log` kanalına kayıt.
6. Beklenmeyen hata → kullanıcıya "Bir hata oluştu", ayrıntı dosya loguna; bot çökmez.

**Slash kaydı:** Komutlar bot açılırken sunucuya özel (guild) kaydedilir; tanımlar değişmediyse kayıt atlanır.

**Görünürlük:** Komutlar `default_member_permissions = 0` ile kaydedilir → yalnızca sunucu sahibi ve Yöneticiler görür. Yetki rolleri ve developer, sunucu sahibi tarafından **Sunucu Ayarları → Entegrasyonlar → Bot → Rol veya Üye Ekle** üzerinden bir kez eklenir (Discord bu ayarı botların yapmasına izin vermez). `.kurulum` sonunda bu adım hatırlatılır. Prefix komutları bu ayardan etkilenmez.

**Süre formatı:** `sn`, `dk`, `sa`, `g`, `hf` ve birleşimleri (`1g12sa`). Büyük/küçük harf duyarsız.

---

## 6. Yetki Sistemi

| Kademe | Kimler |
|---|---|
| **Sahip** | Sunucu sahibi + `DEVELOPER_IDS`. Tüm komutlar, limitsiz, ayar komutları yalnızca bu kademede |
| **Yüksek (3)** | Yüksek yetki rolü |
| **Orta (2)** | Orta yetki rolü |
| **Düşük (1)** | Düşük yetki rolü |
| **Yok (0)** | Diğer herkes — **Yöneticiler dahil** |

- **Kümülatif:** kullanıcının kademesi sahip olduğu en yüksek yetki rolüdür; `kademe ≥ komutun kademesi` ise izin verilir.
- Komut kademesi önceliği: `.ayar kademe` (veritabanı) → `config/moderasyon.json` → komut dosyasındaki `level`.

**Hedef kontrolleri** (sırayla, biri geçmezse işlem yapılmaz ve sebep yazılır)
1. Kendine, bota veya sunucu sahibine ceza verilemez.
2. Hedefin kademesi uygulayanınkine eşit veya yüksekse reddedilir.
3. Botun en yüksek rolü hedefin en yüksek rolünden aşağıdaysa "Botun rolünü yukarı taşıyın" uyarısı verilir.

**Limitler**
- Başlangıç: **ban 10, kick 10, jail 20 — 1 saatlik kayan pencerede**, ceza türü başına ayrı sayılır. mute/chatmute/voicemute/warn limitsiz.
- Komutu kullanabilen tüm kademeler için aynıdır; Sahip kademesi limitsizdir.
- Ayrı sayaç tutulmaz; pencere içindeki ceza kayıtları sayılır.
- `massban`'daki her kişi limitten ayrı düşer.
- Limit aşılırsa işlem engellenir, `ceza-log`'a "@yetkili saatlik ban limitine ulaştı" uyarısı düşer.
- `.ayar limit <tür> <sayı>` ve `.ayar limit-süre <süre>` ile değiştirilir; `0` limiti kapatır.

---

## 7. Ceza ve Sicil Sistemi

### Veri modeli

**Punishment (ceza kaydı)**

| Alan | Açıklama |
|---|---|
| `caseId` | Sıralı ceza numarası (`#152`), tekrarsız |
| `guildId` | Sunucu (tek sunucu olsa da tutulur) |
| `type` | `ban` · `kick` · `mute` · `chatmute` · `voicemute` · `jail` · `warn` |
| `userId`, `staffId` | Hedef ve uygulayan |
| `reason` | Girilmezse "Sebep belirtilmedi" |
| `createdAt`, `expiresAt` | Süreli cezalarda bitiş |
| `status` | `active` · `expired` · `revoked` |
| `revoked` | `{ by, at, reason }` |
| `source` | `command` · `discord` (sağ tık ile verilen) |
| `savedRoles` | Jail'de alınan roller |

**Counter** — ceza numarası için atomik sayaç (`findOneAndUpdate` + `$inc`).

**Settings** — dinamik ayarlar ve kurulumda oluşan rol/kanal ID'leri.

İndeksler: `caseId` (tekil), `{ userId, status }`, `{ staffId, type, createdAt }`, `{ status, expiresAt }`.

### Ceza verme akışı
1. Yetki, hedef ve limit kontrolleri.
2. Aynı türde aktif ceza varsa → "Bu kullanıcı zaten jailde (#148)".
3. Ban/kick ise **önce** kullanıcıya DM (DM kapalıysa sessizce atlanır).
4. Discord işlemi. Başarısızsa kayıt oluşturulmaz, sebep gösterilir.
5. Ceza numarası alınır, kayıt yazılır.
6. `ceza-log`'a embed + komut kanalına onay mesajı. Ban/kick dışındaki cezalarda DM bu adımda (ceza numarasıyla) gönderilir.

### Ceza türleri

| Tür | Uygulama |
|---|---|
| ban | Discord ban; süre verilirse süreli |
| kick | Discord kick |
| mute | Discord timeout; süre **zorunlu**, en fazla 28 gün |
| chatmute | `Chat Mute` rolü |
| voicemute | `Voice Mute` rolü + kullanıcı sesteyse anında sunucu susturması |
| jail | Tüm roller alınıp `savedRoles`'a kaydedilir, `Cezalı` rolü verilir |
| warn | Yalnızca kayıt + DM |

### İptal
- unban, unmute, unchatmute, unvoicemute, unjail, unwarn: kayıt silinmez, `status = revoked` ve `revoked` doldurulur; Discord tarafı geri alınır.
- unjail: kayıtlı roller geri verilir, silinmiş roller atlanır.
- siciltemizle: kişinin tüm kayıtları iptal edilir; sicilde üstü çizili görünür, silinmez.

### Süreli cezalar
- Zamanlayıcı 30 saniyede bir `status = active` ve `expiresAt ≤ şimdi` olan kayıtları kaldırır, `status = expired` yapar.
- Bot açılırken bu kontrol hemen bir kez çalışır (kapalıyken dolan cezalar).
- mute için Discord timeout'u kendiliğinden bitirir; zamanlayıcı yalnızca kaydı günceller.

### Çık-gir koruması
Aktif jail/chatmute/voicemute cezası olan biri sunucuya tekrar girerse rolü geri verilir ve `ceza-log`'a "cezadan kaçmaya çalıştı" notu düşer.

### Discord üzerinden verilen cezalar
`guildBanAdd`, `guildBanRemove`, üye çıkışı (kick) ve timeout değişikliklerinde audit log okunur; uygulayan kişi bulunur ve kayıt `source = discord` ile oluşturulur. Botun kendi işlemleri tekrar kaydedilmez.

---

## 8. Komut Listesi (Aşama 1)

| Komut | Kullanım | Kademe |
|---|---|---|
| ban | `ban <kullanıcı> [süre] [sebep]` | 3 |
| unban | `unban <kullanıcı ID> [sebep]` | 3 |
| banlist | `banlist` | 3 |
| massban | `massban <kullanıcılar…> [sebep]` — onay butonu ile | 3 |
| kick | `kick <kullanıcı> [sebep]` | 2 |
| mute | `mute <kullanıcı> <süre> [sebep]` | 1 |
| unmute | `unmute <kullanıcı> [sebep]` | 1 |
| chatmute | `chatmute <kullanıcı> [süre] [sebep]` | 1 |
| unchatmute | `unchatmute <kullanıcı> [sebep]` | 1 |
| voicemute | `voicemute <kullanıcı> [süre] [sebep]` | 1 |
| unvoicemute | `unvoicemute <kullanıcı> [sebep]` | 1 |
| warn | `warn <kullanıcı> <sebep>` | 1 |
| unwarn | `unwarn <ceza no> [sebep]` | 2 |
| jail | `jail <kullanıcı> [süre] [sebep]` | 2 |
| unjail | `unjail <kullanıcı> [sebep]` | 2 |
| jaillist | `jaillist` | 2 |
| sicil | `sicil <kullanıcı>` — sayfalı, butonlu | 1 |
| siciltemizle | `siciltemizle <kullanıcı> [sebep]` | 3 |
| cezalar | `cezalar [tür]` — aktif cezalar | 2 |
| case | `case <ceza no>` | 1 |
| modlog | `modlog <yetkili>` — yetkilinin cezaları ve toplamları | 2 |
| yardım | `yardım [komut]` — yalnızca kullanılabilen komutlar | 1 |
| kurulum | `kurulum` | Sahip |
| logkur | `logkur` | Sahip |
| ayar | `ayar [alt komut]` | Sahip |

---

## 9. Kurulum, Log ve Ayar Komutları

### kurulum
1. `Cezalı`, `Chat Mute`, `Voice Mute` rollerini oluşturur (botun rolünün altına).
2. Tüm kanallara izinleri uygular: Cezalı hiçbir kanalı göremez; Chat Mute mesaj/tepki/thread yasak; Voice Mute konuşma yasak.
3. `#cezalı` kanalını açar (yalnızca Cezalı rolü ve yetkililer görür).
4. Rol ve kanal ID'lerini Settings'e kaydeder.
5. Entegrasyonlar adımını hatırlatır.
- Tekrar çalıştırılırsa yalnızca eksikleri oluşturur ve izinleri düzeltir.
- Sonradan açılan kanallara izinler `channelCreate` event'i ile otomatik uygulanır.

### logkur
1. `📁 Loglar` kategorisini açar; yalnızca sunucu sahibi, yüksek yetki rolü ve bot görür.
2. Sırayla kanalları açar ve Settings'e kaydeder:

| Kanal | İçerik |
|---|---|
| `ceza-log` | Cezalar, iptaller, limit uyarıları, cezadan kaçma girişimleri |
| `komut-log` | Kim, hangi komutu, nerede, hangi argümanlarla kullandı |
| `mesaj-log` | Silinen (içerik, yazan, kanal, ekler) ve düzenlenen (eski/yeni) mesajlar |
| `ses-log` | Sese giriş/çıkış, kanal değiştirme, sunucu susturma/sağırlaştırma |

- Tekrar çalıştırılırsa yalnızca eksik kanalları açar.
- Bot mesajları loglanmaz. Önbellekte olmayan silinen mesajlar için "içerik alınamadı" yazılır. Kişinin kendi mikrofon/kulaklık değişiklikleri loglanmaz.

### ayar
`ayar` tek başına tüm güncel ayarları gösterir (değiştirilmiş olanlar işaretli).

| Alt komut | Örnek |
|---|---|
| `limit <tür> <sayı>` | `ayar limit ban 5` |
| `limit-süre <süre>` | `ayar limit-süre 2sa` |
| `kademe <komut> <1-3>` | `ayar kademe kick 3` |
| `yetki <dusuk\|orta\|yuksek> <rol>` | `ayar yetki orta @Moderatör` |
| `prefix <prefix>` | `ayar prefix !` |
| `sıfırla <ayar>` | Config dosyasındaki değere döndürür |

---

## 10. Teknik Konular

**Discord intent'leri:** Guilds, GuildMembers*, GuildMessages, MessageContent*, GuildVoiceStates, GuildModeration. (* Developer Portal'da açılması gereken ayrıcalıklı intent'ler.)

**Hata yönetimi**
- Beklenen hatalar (kullanıcı bulunamadı, rol yetersiz, limit doldu) kullanıcıya açık mesajla gösterilir, hata olarak loglanmaz.
- Beklenmeyen hatalar dosya loguna yazılır, kullanıcıya genel mesaj gösterilir; bot çökmez.
- Veritabanı erişilemezse komutlar "Veritabanına ulaşılamıyor, birazdan tekrar deneyin" yanıtı verir.
- Kapatılırken (SIGINT/SIGTERM) veritabanı bağlantısı kapatılıp bot düzgünce sonlandırılır.

**Komutlar (package.json)**

| Komut | İşlev |
|---|---|
| `pnpm dev:moderasyon` | Geliştirme (değişiklikte yeniden başlar) |
| `pnpm build` | `dist/` klasörüne derleme |
| `pnpm start` | PM2 ile derlenmiş botları başlatır |
| `pnpm test` | Testler |
| `pnpm check` | Tip kontrolü + Biome |

**Testler** (dosyaların yanında): süre çözücü, yetki/hiyerarşi kontrolü, limit hesabı, ceza numarası üretimi, prefix argüman ayrıştırıcı, ayar okuma önceliği. Discord arayüzü test edilmez.

**Git:** Conventional Commits (`feat(moderasyon): jail komutu`), her özellik ayrı commit. Commit e-postası GitHub noreply adresi.

---

## 11. Kurulum Rehberi (README'ye eklenecek)
1. Discord Developer Portal'da bot oluşturma, ayrıcalıklı intent'leri açma, davet linki (Yönetici izni).
2. MongoDB Atlas'ta ücretsiz cluster, kullanıcı ve IP izni, bağlantı adresini alma.
3. `.env` ve `config/*.json` dosyalarını doldurma.
4. `pnpm install` → `pnpm dev:moderasyon`.
5. Discord'da `.kurulum` → `.logkur` → Entegrasyonlar adımı.
