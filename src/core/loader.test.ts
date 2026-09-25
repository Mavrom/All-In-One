import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadCommands } from './loader.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'loader-test-'));
  // Node'un düz `.js` dosyalarını ESM olarak yorumlaması için gerekli.
  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeCommandFile(
  filePath: string,
  name: string,
  aliases: string[] = [],
): Promise<void> {
  await writeFile(
    filePath,
    `export default ${JSON.stringify({ name, description: 'test', level: 1, aliases })};\n`,
  );
}

describe('loadCommands', () => {
  it('kategori klasörlerindeki komutları yükler, category alanını doldurur, .test. dosyalarını atlar', async () => {
    const moderasyonDir = path.join(dir, 'moderasyon');
    const ayarDir = path.join(dir, 'ayar');
    await mkdir(moderasyonDir);
    await mkdir(ayarDir);

    await writeCommandFile(path.join(moderasyonDir, 'ban.js'), 'ban');
    await writeCommandFile(path.join(moderasyonDir, 'ban.test.js'), 'sahte-komut');
    await writeCommandFile(path.join(ayarDir, 'ayar.js'), 'ayar');

    const registry = await loadCommands(dir);

    expect([...registry.keys()].sort()).toEqual(['ayar', 'ban']);
    expect(registry.get('ban')?.category).toBe('moderasyon');
    expect(registry.get('ayar')?.category).toBe('ayar');
  });

  it('ad/alias çakışmasında iki dosyayı da adlandıran bir hata fırlatır', async () => {
    const moderasyonDir = path.join(dir, 'moderasyon');
    await mkdir(moderasyonDir);

    await writeCommandFile(path.join(moderasyonDir, 'ban.js'), 'ban');
    await writeCommandFile(path.join(moderasyonDir, 'yasakla.js'), 'yasakla', ['ban']);

    await expect(loadCommands(dir)).rejects.toThrow(/çakışma/);
  });
});
