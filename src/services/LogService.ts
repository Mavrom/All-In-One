import type { Guild, GuildBasedChannel, MessageCreateOptions } from 'discord.js';
import type { Logger } from 'pino';
import type { SettingsService } from './SettingsService.js';

/** Log kanalı anahtarı → `.logkur` ile oluşturulan varsayılan kanal adı. */
export const LOG_CHANNELS = {
  cezaLog: 'ceza-log',
  komutLog: 'komut-log',
  mesajLog: 'mesaj-log',
  sesLog: 'ses-log',
} as const;

export type LogChannelKey = keyof typeof LOG_CHANNELS;

/**
 * `.logkur` ile oluşturulan log kanallarına mesaj gönderir. Kanal ayarlanmamışsa sessizce
 * döner; kanal bulunamaz, metin tabanlı değil veya gönderim başarısız olursa `logger.warn`
 * ile loglar. `send` hiçbir durumda hata fırlatmaz.
 */
export class LogService {
  constructor(
    private readonly guild: Guild,
    private readonly settings: Pick<SettingsService, 'get'>,
    private readonly logger: Pick<Logger, 'warn'>,
  ) {}

  /** `key` kanalına `payload`'ı gönderir. */
  async send(key: LogChannelKey, payload: MessageCreateOptions): Promise<void> {
    const channelId = this.settings.get<string>(`kanal.${key}`);
    if (!channelId) return;

    let channel: GuildBasedChannel | null;
    try {
      channel = await this.guild.channels.fetch(channelId);
    } catch (error) {
      this.logger.warn({ err: error, key, channelId }, 'Log kanalı alınamadı');
      return;
    }

    if (!channel?.isTextBased()) {
      this.logger.warn({ key, channelId }, 'Log kanalı metin tabanlı değil');
      return;
    }

    try {
      await channel.send(payload);
    } catch (error) {
      this.logger.warn({ err: error, key, channelId }, 'Log mesajı gönderilemedi');
    }
  }
}
