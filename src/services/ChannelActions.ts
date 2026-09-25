import type { Message, VoiceBasedChannel } from 'discord.js';
import { UserError } from '#core/errors.js';
import type { CommandContext } from '#core/types.js';
import { selectForPurge } from '#utils/channelTools.js';
import { success } from '#utils/replies.js';

/**
 * Komutun kanalındaki son 100 mesajdan `predicate`'e uyan en fazla `amount` tanesini toplu
 * siler (komut mesajının kendisi, sabitli ve 14 günden eski mesajlar hariç) ve sonucu bildirir.
 */
export async function purgeAndReply(
  ctx: CommandContext,
  amount: number,
  predicate: (message: Message) => boolean,
  label: string,
): Promise<void> {
  const fetched = await ctx.channel.messages.fetch({ limit: 100 });
  const candidates = [...fetched.values()].filter((m) => m.id !== ctx.sourceMessageId);
  const selected = selectForPurge(candidates, amount, predicate);
  if (selected.length === 0) {
    throw new UserError(
      'Silinecek mesaj bulunamadı. (Sabitli ve 14 günden eski mesajlar silinemez.)',
    );
  }

  const deleted = await ctx.channel.bulkDelete(
    selected.map((m) => m.id),
    true,
  );
  await ctx.reply({ embeds: [success(`${deleted.size} ${label} silindi.`)], ephemeral: true });
}

/** ID'si verilen ses kanalını döner; bulunamazsa veya ses kanalı değilse `UserError`. */
export function requireVoiceChannel(ctx: CommandContext, channelId: string): VoiceBasedChannel {
  const channel = ctx.guild.channels.cache.get(channelId);
  if (!channel?.isVoiceBased()) {
    throw new UserError('Bir ses kanalı belirtmelisin.');
  }
  return channel;
}

/** Kanal verilmişse onu, verilmemişse komutu kullananın bulunduğu ses kanalını döner. */
export function voiceChannelOrOwn(
  ctx: CommandContext,
  channelId: string | undefined,
): VoiceBasedChannel {
  if (channelId !== undefined) return requireVoiceChannel(ctx, channelId);
  const own = ctx.member.voice.channel;
  if (!own) {
    throw new UserError('Bir ses kanalı belirt ya da bir ses kanalında ol.');
  }
  return own;
}
