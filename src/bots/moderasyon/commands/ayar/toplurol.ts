import { arg } from '#core/args.js';
import { defineCommand } from '#core/define.js';
import { UserError } from '#core/errors.js';
import type { BulkAction } from '#services/BulkRole.js';
import { startBulkRole } from '#services/BulkRoleCommand.js';
import { openBulkRoleWizard } from '#services/BulkRoleWizard.js';
import { Level } from '#services/PermissionService.js';
import { parseFilter } from '#utils/bulkRoleFilter.js';

/** Slash'taki `hesap`/`katilim` değerinin `<` veya `>` ile başladığını denetler. */
function compare(field: string, value: string): string {
  if (!/^[<>]/.test(value.trim())) {
    throw new UserError(`\`${field}\` için başına < veya > koy: <7g (yeni) ya da >30g (eski).`);
  }
  return `${field}${value.trim()}`;
}

/**
 * `/toplurol` ve `.toplurol`: filtreye uyan üyelere toplu rol verir veya alır; sahip ve
 * Discord Yönetici yetkisi olanlar kullanabilir. İşlem ve rol
 * verilmezse menülü sihirbaz açılır. Slash'taki yapılandırılmış seçenekler filtre diline
 * çevrilip `filtre` metniyle birleştirilir; böylece üç giriş yolu da aynı ayrıştırıcıdan geçer.
 */
export default defineCommand({
  name: 'toplurol',
  description: 'Filtreye uyan üyelere toplu rol verir veya alır.',
  level: Level.Owner,
  allowAdministrator: true,
  args: {
    islem: arg.string({ description: 'ver veya al', choices: ['ver', 'al'], optional: true }),
    rol: arg.role({ description: 'Verilecek / alınacak rol', optional: true }),
    filtre: arg.text({
      description: 'Filtre: üyeler rolde @A hariç @B hesap<7g katılım<1g seste kişiler @a',
      optional: true,
    }),
    hedef: arg.string({
      description: 'Kimlere',
      choices: ['herkes', 'üyeler', 'botlar', 'rolsüz'],
      optional: true,
      slashOnly: true,
    }),
    rolde: arg.role({ description: 'Bu role sahip olanlar', optional: true, slashOnly: true }),
    haric: arg.role({
      description: 'Bu role sahip olanlar hariç',
      optional: true,
      slashOnly: true,
    }),
    hesap: arg.string({
      description: 'Hesap yaşı: <7g (7 günden yeni) veya >30g (30 günden eski)',
      optional: true,
      slashOnly: true,
    }),
    katilim: arg.string({
      description: 'Katılım: <1g (son 1 günde) veya >30g (30 günden önce)',
      optional: true,
      slashOnly: true,
    }),
    seste: arg.string({
      description: 'Ses durumu',
      choices: ['evet', 'hayır'],
      optional: true,
      slashOnly: true,
    }),
    kisiler: arg.users({ description: 'Yalnızca bu kişiler', optional: true, slashOnly: true }),
  },
  async run(ctx, args) {
    const parts: string[] = [];
    if (args.hedef) parts.push(args.hedef);
    if (args.rolde) parts.push('rolde', `<@&${args.rolde}>`);
    if (args.haric) parts.push('hariç', `<@&${args.haric}>`);
    if (args.hesap) parts.push(compare('hesap', args.hesap));
    if (args.katilim) parts.push(compare('katılım', args.katilim));
    if (args.seste) parts.push(args.seste === 'evet' ? 'seste' : 'sestedeğil');
    if (args.kisiler) parts.push('kişiler', ...args.kisiler.map((id) => `<@${id}>`));
    if (args.filtre) parts.push(args.filtre);

    if (args.islem === undefined && args.rol === undefined && parts.length === 0) {
      await openBulkRoleWizard(ctx);
      return;
    }
    if (args.islem === undefined) {
      throw new UserError('`ver` mi `al` mı yapılacağını yazmalısın.');
    }
    if (args.rol === undefined) {
      throw new UserError('Verilecek / alınacak rolü yazmalısın.');
    }

    const filter = parseFilter(parts.join(' '), (id) => ctx.guild.roles.cache.has(id));
    await startBulkRole(ctx, { action: args.islem as BulkAction, roleId: args.rol, filter });
  },
});
