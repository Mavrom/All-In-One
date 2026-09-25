import { describe, expect, it } from 'vitest';
import type { PunishmentRecord } from '#models/Punishment.js';
import { punishmentLine, statusLabel } from './punishment.js';

function makeRecord(overrides: Partial<PunishmentRecord> = {}): PunishmentRecord {
  return {
    caseId: 152,
    guildId: 'g1',
    type: 'ban',
    userId: 'user1',
    staffId: 'staff1',
    reason: 'kural ihlali',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    expiresAt: null,
    status: 'active',
    revoked: null,
    source: 'command',
    savedRoles: [],
    ...overrides,
  };
}

describe('statusLabel', () => {
  it('iptal edilmiş kayıt için "İptal edildi" döner', () => {
    expect(
      statusLabel(
        makeRecord({ status: 'revoked', revoked: { by: 'staff1', at: new Date(), reason: 'x' } }),
      ),
    ).toBe('İptal edildi');
  });

  it('kick için durumu ne olursa olsun "Tamamlandı" döner', () => {
    expect(statusLabel(makeRecord({ type: 'kick', status: 'expired' }))).toBe('Tamamlandı');
  });

  it('süresi dolmuş kayıt için "Süresi doldu" döner', () => {
    expect(statusLabel(makeRecord({ type: 'mute', status: 'expired' }))).toBe('Süresi doldu');
  });

  it('aktif kayıt için "Aktif" döner', () => {
    expect(statusLabel(makeRecord({ status: 'active' }))).toBe('Aktif');
  });
});

describe('punishmentLine', () => {
  it('beklenen biçimde bir satır üretir', () => {
    const record = makeRecord();
    const unix = Math.floor(record.createdAt.getTime() / 1000);

    expect(punishmentLine(record)).toBe(`\`#152\` • Ban • <t:${unix}:d> • Aktif — kural ihlali`);
  });

  it('iptal edilmiş kayıt üstü çizili görünür', () => {
    const record = makeRecord({
      status: 'revoked',
      revoked: { by: 'staff1', at: new Date(), reason: 'iyi davrandi' },
    });
    const unix = Math.floor(record.createdAt.getTime() / 1000);

    expect(punishmentLine(record)).toBe(
      `~~\`#152\` • Ban • <t:${unix}:d> • İptal edildi — kural ihlali~~`,
    );
  });

  it('60 karakterden uzun sebebi keser', () => {
    const longReason = 'a'.repeat(80);
    const record = makeRecord({ reason: longReason });

    const line = punishmentLine(record);
    const reasonPart = line.split(' — ')[1];
    expect(reasonPart).toHaveLength(60);
    expect(reasonPart?.endsWith('…')).toBe(true);
  });
});
