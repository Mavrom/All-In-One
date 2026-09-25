import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ClientEvents } from 'discord.js';
import { foldTurkish, trLower } from '#utils/text.js';
import type { EventDef } from '../events.js';
import type { Bot, CommandRegistry } from '../types.js';
import type { CommandDef } from './define.js';

/** `.test.` içeren veya `.d.ts` ile biten dosyalar hariç, `.ts`/`.js` uzantılı dosyaları seçer. */
function isLoadableFile(name: string): boolean {
  if (name.endsWith('.d.ts')) return false;
  if (name.includes('.test.')) return false;
  return name.endsWith('.ts') || name.endsWith('.js');
}

function isCommandDef(value: unknown): value is CommandDef {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.level === 'number'
  );
}

/**
 * `dir` altındaki her alt klasörü bir kategori sayarak içindeki komut dosyalarını
 * (`default` dışa aktarımı) yükler. Komut adı ve alias'lar Türkçe katlanmış biçimde tüm
 * kayıt boyunca tekil olmalıdır; çakışma veya geçersiz `default` dışa aktarımı, ilgili dosya
 * adını içeren bir hata fırlatır.
 */
export async function loadCommands(dir: string): Promise<CommandRegistry> {
  const registry: CommandRegistry = new Map();
  const seen = new Map<string, string>();

  const entries = await readdir(dir, { withFileTypes: true });
  const categoryDirs = entries.filter((entry) => entry.isDirectory());

  for (const categoryDir of categoryDirs) {
    const categoryPath = path.join(dir, categoryDir.name);
    const files = await readdir(categoryPath, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile() || !isLoadableFile(file.name)) continue;

      const filePath = path.join(categoryPath, file.name);
      const mod = (await import(pathToFileURL(filePath).href)) as { default?: unknown };
      const def = mod.default;

      if (!isCommandDef(def)) {
        throw new Error(`${filePath}: geçerli bir komut tanımı (default export) içermiyor`);
      }

      def.category = categoryDir.name;

      for (const name of [def.name, ...(def.aliases ?? [])]) {
        const folded = foldTurkish(trLower(name));
        const existing = seen.get(folded);
        if (existing !== undefined) {
          throw new Error(`Komut adı/alias çakışması: "${name}" (${existing} ve ${filePath})`);
        }
        seen.set(folded, filePath);
      }

      registry.set(trLower(def.name), def);
    }
  }

  return registry;
}

function isEventDef(value: unknown): value is EventDef<keyof ClientEvents> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.name === 'string' && typeof candidate.run === 'function';
}

/**
 * `dir` içindeki her dosyanın `default` dışa aktarımını ({@link EventDef}) `bot.client`e bağlar.
 * `run` içindeki hatalar yakalanıp `bot.logger`a yazılır; olay dinleyicileri bu yüzden asla
 * fırlatmaz.
 */
export async function loadEvents(bot: Bot, dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !isLoadableFile(entry.name)) continue;

    const filePath = path.join(dir, entry.name);
    const mod = (await import(pathToFileURL(filePath).href)) as { default?: unknown };
    const def = mod.default;

    if (!isEventDef(def)) {
      throw new Error(`${filePath}: geçerli bir olay tanımı (default export) içermiyor`);
    }

    const handler = (...args: unknown[]): void => {
      Promise.resolve(def.run(bot, ...(args as ClientEvents[typeof def.name]))).catch(
        (err: unknown) => {
          bot.logger.error({ err, event: def.name }, 'Olay işleme hatası');
        },
      );
    };

    const on = bot.client.on.bind(bot.client) as (
      event: keyof ClientEvents,
      listener: (...args: unknown[]) => void,
    ) => void;
    const once = bot.client.once.bind(bot.client) as (
      event: keyof ClientEvents,
      listener: (...args: unknown[]) => void,
    ) => void;

    if (def.once === true) {
      once(def.name, handler);
    } else {
      on(def.name, handler);
    }
  }
}
