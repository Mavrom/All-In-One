# Moderasyon Botu — Aşama 1 Tasarımı

> Tarih: 2026-09-25 · Durum: Onay bekliyor

Bu doküman All-In-One projesinin ortak çekirdeğini ve moderasyon botunun ilk aşamasını tanımlar. Sonraki botlar (guard, istatistik, özel oda…) bu çekirdeğin üzerine kurulacaktır.

---

## 1. Kapsam

Moderasyon botu 5 aşamada geliştirilir. Bu doküman **Aşama 1, 2, 4 ve 5**'i ve üye logunu kapsar (bkz. 12.–14. bölümler). Aşama 3 (otomatik moderasyon) şimdilik ertelendi.

| Aşama | İçerik |
|---|---|
| **1. Çekirdek + Ceza sistemi** | Ortak altyapı, yetki/limit sistemi, ceza ve sicil komutları, kurulum, logkur, ayar, yardım |
| **2. Kanal + Ses yönetimi** | clear, sil, clearuser, clearbot, clearlinks, slowmode, kilit, move, moveall, disconnect, disconnectall, isim |
| 3. Otomatik moderasyon *(ertelendi)* | küfür-engel, reklam-engel, yasaklı-kelime, görsel-engel, hesap-koruma |
| **4. Otorol** | otorol, otorolkapat |
| **5. Toplu rol** | toplurol (bkz. 14. bölüm) |

**Henüz yapılmayanlar:** Aşama 3, uyarı sayısına göre otomatik ceza, çoklu sunucu desteği, çoklu dil.

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
- Bot klasöründe yalnızca `commands/`, `events/` ve `index.ts` bulunur. Yardımcı kod (ayar şeması, log embed'leri, hedef kontrolü vb.) `core`, `services` veya `utils` altına konur.
- Bir bot başka bir botun klasöründen import yapmaz. Ortak ihtiyaç `src/services/`'e taşınır.
- Her dosyada tek komut veya tek event bulunur; dosya adı komut adıyla aynıdır.
- Komut kategorisi bulunduğu klasörden (`ceza/`, `sicil/`, `ayar/`) otomatik alınır.
- Testler test ettikleri dosyanın yanında durur: `duration.ts` → `duration.test.ts`.
- Klasörler arası import'lar `#` takma adıyla yazılır: `#services/PunishmentService.js`.
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

---

## 12. Aşama 2 — Kanal ve Ses Yönetimi

Komutlar üç yeni kategoride durur: `kanal/`, `ses/`, `uye/`. Kademeler `ayar kademe` ile değiştirilebilir.

| Komut | Kullanım | Kademe |
|---|---|---|
| clear (sil, temizle) | `clear <1-100>` | 1 |
| clearuser | `clearuser <kullanıcı> [sayı]` | 1 |
| clearbot | `clearbot [sayı]` | 1 |
| clearlinks | `clearlinks [sayı]` — bağlantı ve Discord davetleri | 1 |
| slowmode (yavaşmod) | `slowmode <süre\|0> [kanal]` — en fazla 6 saat | 2 |
| kilit (lock) | `kilit [kanal]` — `@everyone` yazma iznini kapatır/açar | 2 |
| move (taşı) | `move <kullanıcı> <ses kanalı>` | 1 |
| moveall | `moveall <hedef> [kaynak]` — kaynak boşsa bulunduğun kanal | 2 |
| disconnect (dc) | `disconnect <kullanıcı>` | 1 |
| disconnectall | `disconnectall [kanal]` — kendin hariç | 2 |
| isim (nick) | `isim <kullanıcı> [yeni isim]` — boşsa sıfırlar | 1 |

**Kurallar**
- Silme komutları son 100 mesaja bakar; sabitli ve 14 günden eski mesajlar (Discord sınırı) silinmez, komut mesajının kendisi sayılmaz.
- move, disconnect ve isim, ceza komutlarıyla aynı hedef kontrolünü kullanır: kendin, bot, sunucu sahibi ve eşit/üst kademedeki yetkililer üzerinde işlem yapılamaz.
- Toplu taşıma/çıkarmada taşınamayan üyeler atlanır, sonuçta `taşınan/toplam` gösterilir.
- Tüm işlemler `komut-log`'a otomatik yazılır.

---

## 13. Aşama 4 — Otorol ve Üye Logu

### Otorol

| Komut | Kullanım | Kademe |
|---|---|---|
| otorol | `otorol <rol> [bot rolü]` | Sahip |
| otorolkapat | `otorolkapat` | Sahip |

- Ayarlar `otorol.uye` ve `otorol.bot` anahtarlarında tutulur (`ayar` ile görünür).
- Rol botun rolünden aşağıda olmalı ve bir entegrasyona ait olmamalıdır; komut bunu kontrol eder.
- Aktif jail cezasıyla sunucuya dönen üyeye otorol verilmez (çık-gir koruması önce çalışır).
- Bot rolü verilmemişse botlara rol verilmez.

### Üye logu
`logkur` artık `üye-log` kanalını da açar (daha önce çalıştırıldıysa tekrar çalıştırmak yalnızca bu kanalı ekler).

| Olay | İçerik |
|---|---|
| Katılma | Üye, hesap oluşturma tarihi (7 günden yeni hesaplar ⚠️ ile işaretlenir), üye sayısı |
| Ayrılma | Üye, ne zaman katıldığı, sahip olduğu roller |
| Üye güncelleme | Takma ad değişikliği, verilen/alınan roller |
| Kullanıcı güncelleme | Kullanıcı adı ve görünen ad değişikliği |

---

## 14. Aşama 5 — Toplu Rol (`toplurol`)

Tek komutla birçok üyeye rol verir veya alır. **Yetki: Sahip veya Discord Yönetici yetkisi olanlar** (komut tanımındaki `allowAdministrator`; bot kademesi olmayan yöneticiler de kullanabilir). Üç giriş yolu vardır; üçü de aynı filtre nesnesini üretir, önizleme/onay ve işlem kısmı ortaktır.

| Giriş | Örnek |
|---|---|
| Filtre dili (prefix + slash `filtre` alanı) | `.toplurol ver @Üye rolde @Kayıtsız hariç @Yetkili` |
| Slash seçenekleri | `/toplurol islem:ver rol:@Üye hedef:üyeler rolde:@Kayıtsız haric:@Yetkili` |
| Sihirbaz | `.toplurol` veya `/toplurol` (işlem/rol verilmeden) → menülerle seçim |

### Filtre dili
Filtreler art arda yazılır ve **hepsi birlikte** (VE) uygulanır. Türkçe karakterler zorunlu değildir (`uyeler` = `üyeler`).

| Filtre | Anlamı |
|---|---|
| `herkes` / `üyeler` / `botlar` | Kapsam (varsayılan `herkes`) |
| `rolde @A @B` | Belirtilen rollerin **hepsine** sahip olanlar |
| `herhangi @A @B` | Belirtilen rollerden **en az birine** sahip olanlar |
| `hariç @A @kişi` | Bu rollere sahip olanlar ve bu kişiler hariç |
| `rolsüz` | @everyone dışında hiç rolü olmayanlar |
| `kişiler @a @b 123…` | Yalnızca bu kişiler (diğer filtreler yine uygulanır) |
| `hesap<7g` / `hesap>30g` | Hesabı 7 günden yeni / 30 günden eski olanlar |
| `katılım<1g` / `katılım>30g` | Sunucuya 1 gün içinde / 30 günden önce katılanlar |
| `seste` / `sestedeğil` | Şu an bir ses kanalında olan / olmayanlar |

Süreler `ceza` komutlarıyla aynı biçimdedir (`30dk`, `12sa`, `7g`, `2hf`). Çelişen filtreler (`seste` + `sestedeğil`, `rolsüz` + `rolde`) hata verir. ID yazıldığında önce rol, sonra kullanıcı olarak aranır.

Slash'ta yapılandırılmış seçenekler (`hedef`, `rolde`, `haric`, `hesap`, `katilim`, `seste`, `kisiler`) ile `filtre` metni birlikte kullanılabilir; ikisi birleştirilir. Bu seçenekler yalnızca slash'ta görünür (`slashOnly`), prefix'te filtre dili kullanılır.

### Sihirbaz
Tek mesajda: verilecek/alınacak rol menüsü, "şu rollerde olanlar" menüsü, "hariç roller" menüsü, ek filtreler menüsü (rolsüz, seste, seste değil, rollerden herhangi biri, hesap 7 günden yeni / 30 günden eski, son 24 saatte / 7 günde katılan) ve düğmeler (`İşlem: Ver/Al`, `Kime: Herkes/Üyeler/Botlar`, `Devam`, `İptal`). 2 dakika işlem yapılmazsa kapanır. Belirli kişiler sihirbazda yoktur; bunun için filtre dili kullanılır.

### Önizleme ve onay
- Rol, otorol ile aynı kontrolden geçer (bot rolünün altında, entegrasyon rolü değil); `@everyone` kullanılamaz.
- Tüm üyeler çekilir, filtre uygulanır; rolü zaten olanlar (`ver`) veya olmayanlar (`al`) sayıdan düşülür.
- Önizleme: işlem, rol, filtre özeti, etkilenecek kişi sayısı (üye/bot dağılımı), ilk 10 kişi, atlanan sayısı, tahmini süre. `Onayla` / `İptal`, 30 sn.
- Hedef yoksa işlem başlamaz. Sunucu başına aynı anda tek toplurol çalışır.

### Hız ve rate limit
Discord rol değiştirme limitini sabit yayınlamaz; her yanıtta kalan hakkı başlıklarla bildirir ve discord.js bu başlıklara göre istekleri kendisi sıraya koyar (429 almadan bekler). Toplurol bunun üstüne kendini ayarlayan bir hız ekler:

| Hedef sayısı | Davranış |
|---|---|
| ≤ 25 | Doğrudan, ara vermeden sırayla uygulanır (discord.js kuyruğu yeterli) |
| > 25 | Gruplar hâlinde: ilk grup 10 kişi, gruplar arası 1 sn |

- Grup sırasında rol isteği için `rateLimited` uyarısı **gelmezse**: grup +5 büyür (en fazla 25), bekleme ×0,75 kısalır (en az 0,5 sn).
- Uyarı **gelirse**: grup yarıya iner (en az 5), bekleme ×2 uzar (en fazla 10 sn).
- Aralardaki boşluk sayesinde diğer komutlar ve botlar toplurol sürerken takılmaz.
- Geçersiz istek gönderilmez (Cloudflare'in 10 dk / 10.000 hatalı istek engeline karşı): rol ve yetki baştan kontrol edilir, zaten rolü olan/olmayan ve sunucudan ayrılmış üyeler atlanır. Art arda 5 hata gelirse işlem durur ve sebebini gösterir.

### İlerleme, durdurma ve log
- Mesaj en fazla 3 sn'de bir güncellenir: `412/1500 · ✅ 410 · ❌ 2 · kalan ~3 dk`, altında `Durdur` düğmesi.
- Bitince özet: başarılı, başarısız, atlanan, ayrılmış, süre. Durdurulduysa kaç kişide kaldığı yazılır.
- İşlem sürerken bu rolün tek tek `üye-log` kayıtları susturulur (yoksa her değişiklik ayrı log mesajı olur ve kanal rate limit'ine takılır); bitince `üye-log`'a tek bir özet yazılır. Komut `komut-log`'a her zamanki gibi düşer.

### Dosyalar
| Dosya | Görev |
|---|---|
| `src/utils/bulkRoleFilter.ts` | Filtre tipi, filtre dili ayrıştırıcı, üye eşleştirme, filtre özeti |
| `src/services/BulkRole.ts` | Hedef toplama, kendini ayarlayan toplu işlem, aktif işlem kaydı |
| `src/services/BulkRoleCommand.ts` | Önizleme/onay, ilerleme mesajı, durdurma, log |
| `src/services/BulkRoleWizard.ts` | Sihirbaz menüleri |
| `src/bots/moderasyon/commands/ayar/toplurol.ts` | Komut tanımı (prefix + slash) |
| `src/core/args.ts`, `src/core/prefix.ts` | `slashOnly` argüman desteği |
