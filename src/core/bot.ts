import type { Client, GatewayIntentBits, Guild, Partials } from 'discord.js';
import { Client as DiscordClient } from 'discord.js';
import { SettingsService } from '#services/SettingsService.js';
import { handleInteraction, handleMessage } from './commands/dispatcher.js';
import { loadCommands, loadEvents } from './commands/loader.js';
import { registerSlashCommands } from './commands/register.js';
import { type Env, type GenelConfig, genelSchema, loadEnv, loadJsonConfig } from './config.js';
import { connectDatabase, disconnectDatabase } from './database.js';
import { ConfigError } from './errors.js';
import { createLogger } from './logger.js';
import type { Bot } from './types.js';

/** `genel` kapsamındaki ayarların varsayılan anahtarları (kurulum/logkur ile doldurulur). */
export const GENEL_DEFAULT_KEYS = [
  'yetki.dusuk',
  'yetki.orta',
  'yetki.yuksek',
  'rol.cezali',
  'rol.chatmute',
  'rol.voicemute',
  'kanal.jail',
  'kanal.cezaLog',
  'kanal.komutLog',
  'kanal.mesajLog',
  'kanal.sesLog',
  'kategori.log',
] as const;

/**
 * `genel` kapsamı için kod varsayılanlarını üretir: yetki rolleri `config/genel.json`dan gelir,
 * kurulum/logkur ile oluşan rol ve kanal ID'leri henüz kurulmamışsa `null`dır.
 */
export function genelDefaults(genel: GenelConfig): Record<string, unknown> {
  return {
    'yetki.dusuk': genel.yetkiRolleri.dusuk,
    'yetki.orta': genel.yetkiRolleri.orta,
    'yetki.yuksek': genel.yetkiRolleri.yuksek,
    'rol.cezali': null,
    'rol.chatmute': null,
    'rol.voicemute': null,
    'kanal.jail': null,
    'kanal.cezaLog': null,
    'kanal.komutLog': null,
    'kanal.mesajLog': null,
    'kanal.sesLog': null,
    'kategori.log': null,
  };
}

/** {@link createBot} çağrısına verilen seçenekler. */
export interface CreateBotOptions {
  /** Bot adı: logger adı ve bot'a özel `Settings` kapsamı (`scope`) olarak kullanılır. */
  name: string;
  /** `.env`deki bu botun tokenını tutan değişken adı (örn. `MODERASYON_TOKEN`). */
  tokenKey: string;
  intents: GatewayIntentBits[];
  partials?: Partials[];
  /** Komut dosyalarının bulunduğu klasörün mutlak yolu (alt klasörler = kategori). */
  commandsDir: string;
  /** Olay dosyalarının bulunduğu klasörün mutlak yolu. */
  eventsDir: string;
  /** Bota özel `Settings` kapsamının kod varsayılanları. */
  botDefaults: Record<string, unknown>;
  onReady?: (bot: Bot) => void | Promise<void>;
}

/**
 * Bir moderasyon botunu uçtan uca başlatır: `.env`/config doğrulama, veritabanı bağlantısı,
 * komutların yüklenmesi, Discord'a giriş, ayarların okunması, dispatcher'ın bağlanması, olay
 * dosyalarının yüklenmesi ve slash komutlarının kaydı. Döndürülen {@link Bot} her yerde aynı
 * şekilde kullanılır; projedeki tüm botlar bu fonksiyonla başlar.
 */
export async function createBot(opts: CreateBotOptions): Promise<Bot> {
  const env: Env & { token: string } = loadEnv(process.env, opts.tokenKey);
  const genel = loadJsonConfig('genel.json', genelSchema);
  const logger = createLogger(opts.name, env);

  await connectDatabase(env.MONGODB_URI, logger);

  const commands = await loadCommands(opts.commandsDir);

  const client: Client<boolean> = new DiscordClient({
    intents: opts.intents,
    partials: opts.partials,
  });

  const readyPromise = new Promise<Client<true>>((resolve) => {
    client.once('ready', (readyClient) => resolve(readyClient));
  });
  await client.login(env.token);
  const readyClient = await readyPromise;

  let guild: Guild;
  try {
    guild = await readyClient.guilds.fetch(genel.sunucuId);
  } catch {
    throw new ConfigError(`Bot config/genel.json içindeki sunucuda değil: ${genel.sunucuId}`);
  }

  const genelSettings = new SettingsService({
    guildId: genel.sunucuId,
    scope: 'genel',
    defaults: genelDefaults(genel),
  });
  const botSettings = new SettingsService({
    guildId: genel.sunucuId,
    scope: opts.name,
    defaults: opts.botDefaults,
  });
  await genelSettings.load();
  await botSettings.load();

  const bot: Bot = {
    name: opts.name,
    client: readyClient,
    logger,
    env,
    genel,
    guild,
    settings: { genel: genelSettings, bot: botSettings },
    commands,
  };

  readyClient.on('interactionCreate', (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    handleInteraction(bot, interaction).catch((err: unknown) => {
      logger.error({ err }, 'Etkileşim işleme hatası');
    });
  });

  readyClient.on('messageCreate', (message) => {
    handleMessage(bot, message).catch((err: unknown) => {
      logger.error({ err }, 'Mesaj işleme hatası');
    });
  });

  await loadEvents(bot, opts.eventsDir);

  const registerResult = await registerSlashCommands(bot);
  logger.info({ result: registerResult }, 'Slash komutları kaydedildi');

  await opts.onReady?.(bot);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Bot kapatılıyor');
    void (async () => {
      readyClient.destroy();
      await disconnectDatabase();
      process.exit(0);
    })();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error({ err: reason }, 'Yakalanmamış promise reddi');
  });

  return bot;
}
