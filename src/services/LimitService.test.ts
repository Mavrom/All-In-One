import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '#core/testing.js';
import type { PunishmentStatus, PunishmentType } from '#models/Punishment.js';
import { Punishment } from '#models/Punishment.js';
import { checkLimit, countRecent, LIMITED_TYPES } from './LimitService.js';

useTestDatabase();

let caseSeq = 0;

async function createRecord(overrides: {
  guildId?: string;
  staffId?: string;
  type?: PunishmentType;
  status?: PunishmentStatus;
  createdAt?: Date;
}) {
  caseSeq += 1;
  await Punishment.create({
    caseId: caseSeq,
    guildId: overrides.guildId ?? 'g1',
    type: overrides.type ?? 'ban',
    userId: 'user1',
    staffId: overrides.staffId ?? 'staff1',
    status: overrides.status ?? 'active',
    createdAt: overrides.createdAt ?? new Date(),
  });
}

describe('LIMITED_TYPES', () => {
  it('ban, kick, jail içerir', () => {
    expect(LIMITED_TYPES).toEqual(['ban', 'kick', 'jail']);
  });
});

describe('countRecent', () => {
  it('pencere içindeki kayıtları sayar, dışındakileri saymaz', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    await createRecord({ createdAt: new Date(now.getTime() - 30 * 60 * 1000) });
    await createRecord({ createdAt: new Date(now.getTime() - 90 * 60 * 1000) });

    const count = await countRecent({
      guildId: 'g1',
      staffId: 'staff1',
      type: 'ban',
      windowMs: 60 * 60 * 1000,
      now,
    });

    expect(count).toBe(1);
  });

  it('iptal edilmiş kayıtlar da sayılır', async () => {
    await createRecord({ status: 'revoked' });
    await createRecord({ status: 'active' });

    const count = await countRecent({
      guildId: 'g1',
      staffId: 'staff1',
      type: 'ban',
      windowMs: 60 * 60 * 1000,
    });

    expect(count).toBe(2);
  });

  it('başka yetkilinin kaydı sayılmaz', async () => {
    await createRecord({ staffId: 'staff1' });
    await createRecord({ staffId: 'staff2' });

    const count = await countRecent({
      guildId: 'g1',
      staffId: 'staff1',
      type: 'ban',
      windowMs: 60 * 60 * 1000,
    });

    expect(count).toBe(1);
  });

  it('başka türün kaydı sayılmaz', async () => {
    await createRecord({ type: 'ban' });
    await createRecord({ type: 'kick' });

    const count = await countRecent({
      guildId: 'g1',
      staffId: 'staff1',
      type: 'ban',
      windowMs: 60 * 60 * 1000,
    });

    expect(count).toBe(1);
  });
});

describe('checkLimit', () => {
  it('max 0 her zaman izin verir', async () => {
    for (let i = 0; i < 5; i += 1) {
      await createRecord({});
    }

    const result = await checkLimit({
      guildId: 'g1',
      staffId: 'staff1',
      type: 'ban',
      max: 0,
      windowMs: 60 * 60 * 1000,
    });

    expect(result.allowed).toBe(true);
  });

  it('used + incoming max ı aşarsa izin vermez', async () => {
    for (let i = 0; i < 3; i += 1) {
      await createRecord({});
    }

    const result = await checkLimit({
      guildId: 'g1',
      staffId: 'staff1',
      type: 'ban',
      max: 3,
      windowMs: 60 * 60 * 1000,
    });

    expect(result).toEqual({ allowed: false, used: 3, max: 3 });
  });

  it('used + incoming max ı aşmazsa izin verir', async () => {
    for (let i = 0; i < 2; i += 1) {
      await createRecord({});
    }

    const result = await checkLimit({
      guildId: 'g1',
      staffId: 'staff1',
      type: 'ban',
      max: 3,
      windowMs: 60 * 60 * 1000,
    });

    expect(result).toEqual({ allowed: true, used: 2, max: 3 });
  });

  it('incoming birden fazla olabilir (massban)', async () => {
    await createRecord({});

    const result = await checkLimit({
      guildId: 'g1',
      staffId: 'staff1',
      type: 'ban',
      max: 3,
      windowMs: 60 * 60 * 1000,
      incoming: 3,
    });

    expect(result).toEqual({ allowed: false, used: 1, max: 3 });
  });
});
