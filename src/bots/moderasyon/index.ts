import { fileURLToPath } from 'node:url';
import { GatewayIntentBits, Partials } from 'discord.js';
import { createBot } from '#core/bot.js';
import { loadJsonConfig } from '#core/config.js';
import { ConfigError } from '#core/errors.js';
import { botDefaults, moderasyonSchema } from '#core/moderasyonConfig.js';
import { DiscordPunishmentActions } from '#services/DiscordPunishmentActions.js';
import { startExpiryScheduler } from '#services/ExpiryScheduler.js';
import { LogService } from '#services/LogService.js';
import { setModServices } from '#services/ModServices.js';
import { PunishmentService } from '#services/PunishmentService.js';
import { parseDuration } from '#utils/duration.js';
import { commandLogEmbed, logPunishmentEvent } from '#utils/logEmbeds.js';

const DEFAULT_WINDOW_MS = 3_600_000;

/** `moderasyon` botunu başlatır: config doğrulama, `createBot` ile giriş, ceza servislerinin kurulması. */
async function main(): Promise<void> {
  const cfg = loadJsonConfig('moderasyon.json', moderasyonSchema);

  await createBot({
    name: 'moderasyon',
    tokenKey: 'MODERASYON_TOKEN',
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
    commandsDir: fileURLToPath(new URL('./commands', import.meta.url)),
    eventsDir: fileURLToPath(new URL('./events', import.meta.url)),
    botDefaults: botDefaults(cfg),
    onReady: async (bot) => {
      const logs = new LogService(bot.guild, bot.settings.genel, bot.logger);
      const punishments = new PunishmentService({
        guildId: bot.guild.id,
        guildName: bot.guild.name,
        actions: new DiscordPunishmentActions(bot.guild, bot.settings.genel),
        limits: (type) => ({
          max: bot.settings.bot.get<number>(`limit.${type}`) ?? 0,
          windowMs:
            parseDuration(bot.settings.bot.get<string>('limit.pencere') ?? '1sa') ??
            DEFAULT_WINDOW_MS,
        }),
        onEvent: (event) => logPunishmentEvent(logs, event),
      });

      setModServices({ punishments, logs });
      startExpiryScheduler({ service: punishments, logger: bot.logger });

      bot.onCommandRun = (info) => void logs.send('komutLog', { embeds: [commandLogEmbed(info)] });

      bot.logger.info(`${bot.client.user.tag} olarak giriş yapıldı`);
    },
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
});
