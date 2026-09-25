import { describe, expect, it } from 'vitest';
import { UserError } from '#core/errors.js';
import { useTestDatabase } from '#core/testing.js';
import type { PunishmentRecord, PunishmentType } from '#models/Punishment.js';
import { Level } from '#services/PermissionService.js';
import type { ApplyOptions, PunishmentActions, PunishmentEvent } from './PunishmentService.js';
import { PunishmentService } from './PunishmentService.js';

useTestDatabase();

/** Testler için gerçek Discord etkisi olmayan sahte aksiyon uygulayıcısı. */
class FakeActions implements PunishmentActions {
  calls: Array<{ method: string; args: unknown[] }> = [];
  applyResult: { savedRoles?: string[] } = {};
  applyError: Error | null = null;

  async notify(userId: string, text: string): Promise<void> {
    this.calls.push({ method: 'notify', args: [userId, text] });
  }

  async apply(
    type: PunishmentType,
    userId: string,
    opts: ApplyOptions,
  ): Promise<{ savedRoles?: string[] }> {
    this.calls.push({ method: 'apply', args: [type, userId, opts] });
    if (this.applyError) throw this.applyError;
    return this.applyResult;
  }

  async revoke(record: PunishmentRecord): Promise<void> {
    this.calls.push({ method: 'revoke', args: [record] });
  }

  async reapply(record: PunishmentRecord): Promise<void> {
    this.calls.push({ method: 'reapply', args: [record] });
  }
}

function createService(overrides?: {
  actions?: FakeActions;
  limits?: (type: 'ban' | 'kick' | 'jail') => { max: number; windowMs: number };
  onEvent?: (event: PunishmentEvent) => void;
}) {
  const actions = overrides?.actions ?? new FakeActions();
  const events: PunishmentEvent[] = [];
  const service = new PunishmentService({
    guildId: 'g1',
    guildName: 'Test Sunucu',
    actions,
    limits: overrides?.limits ?? (() => ({ max: 0, windowMs: 60 * 60 * 1000 })),
    onEvent: (event) => {
      events.push(event);
      overrides?.onEvent?.(event);
    },
  });
  return { service, actions, events };
}

describe('PunishmentService.punish', () => {
  it('ceza numaraları artan sırada verilir', async () => {
    const { service } = createService();

    const first = await service.punish({
      type: 'warn',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Low,
      reason: 'sebep',
    });
    const second = await service.punish({
      type: 'warn',
      userId: 'user2',
      staffId: 'staff1',
      staffLevel: Level.Low,
      reason: 'sebep',
    });

    expect(second.caseId).toBe(first.caseId + 1);
  });

  it('aktif çift ONGOING ceza tam mesajla reddedilir', async () => {
    const { service } = createService();

    const first = await service.punish({
      type: 'jail',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Mid,
      reason: 'sebep',
    });

    await expect(
      service.punish({
        type: 'jail',
        userId: 'user1',
        staffId: 'staff1',
        staffLevel: Level.Mid,
        reason: 'baska sebep',
      }),
    ).rejects.toThrow(
      new UserError(`Bu kullanıcının zaten aktif bir Jail cezası var (#${first.caseId}).`),
    );
  });

  it('ban DM apply öncesinde, warn DM ise ceza numarasıyla sonra gönderilir', async () => {
    const { service, actions } = createService();

    await service.punish({
      type: 'ban',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.High,
      reason: 'kural ihlali',
    });

    expect(actions.calls[0]?.method).toBe('notify');
    expect(actions.calls[1]?.method).toBe('apply');
    expect(actions.calls[0]?.args[1]).toBe(
      '**Test Sunucu** sunucusundan Ban cezası aldın.\nSebep: kural ihlali',
    );

    actions.calls = [];
    const record = await service.punish({
      type: 'warn',
      userId: 'user2',
      staffId: 'staff1',
      staffLevel: Level.Low,
      reason: 'kural ihlali',
    });

    expect(actions.calls[0]?.method).toBe('apply');
    expect(actions.calls[1]?.method).toBe('notify');
    expect(actions.calls[1]?.args[1]).toBe(
      `**Test Sunucu** sunucusunda Uyarı cezası aldın (#${record.caseId}).\nSebep: kural ihlali`,
    );
  });

  it('mute için süre zorunludur', async () => {
    const { service } = createService();

    await expect(
      service.punish({
        type: 'mute',
        userId: 'user1',
        staffId: 'staff1',
        staffLevel: Level.Low,
        reason: 'sebep',
      }),
    ).rejects.toThrow(new UserError('Mute için süre gerekli.'));
  });

  it('mute 28 günden uzun olamaz', async () => {
    const { service } = createService();

    await expect(
      service.punish({
        type: 'mute',
        userId: 'user1',
        staffId: 'staff1',
        staffLevel: Level.Low,
        reason: 'sebep',
        durationMs: 29 * 24 * 60 * 60 * 1000,
      }),
    ).rejects.toThrow(new UserError('Mute en fazla 28 gün olabilir.'));
  });

  it('apply başarısız olursa kayıt oluşturulmaz', async () => {
    const actions = new FakeActions();
    actions.applyError = new Error('discord hatasi');
    const { service } = createService({ actions });

    await expect(
      service.punish({
        type: 'jail',
        userId: 'user1',
        staffId: 'staff1',
        staffLevel: Level.Mid,
        reason: 'sebep',
      }),
    ).rejects.toThrow('discord hatasi');

    const active = await service.findActive('user1', 'jail');
    expect(active).toBeNull();
  });

  it('limit aşılırsa limit olayı yayınlanır ve UserError fırlatılır; Owner limitten muaf', async () => {
    const limits = () => ({ max: 1, windowMs: 60 * 60 * 1000 });
    const { service, events } = createService({ limits });

    await service.punish({
      type: 'ban',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.High,
      reason: 'sebep',
    });

    await expect(
      service.punish({
        type: 'ban',
        userId: 'user2',
        staffId: 'staff1',
        staffLevel: Level.High,
        reason: 'sebep',
      }),
    ).rejects.toThrow(new UserError('1 saat içindeki Ban limitine ulaştın (1/1).'));

    const limitEvents = events.filter((event) => event.kind === 'limit');
    expect(limitEvents).toHaveLength(1);

    // Owner limitten muaf: aynı durumda hata almamalı.
    await expect(
      service.punish({
        type: 'ban',
        userId: 'user3',
        staffId: 'staff1',
        staffLevel: Level.Owner,
        reason: 'sebep',
      }),
    ).resolves.toMatchObject({ userId: 'user3' });
  });

  it('discord kaynağında aksiyon/DM çağrılmaz ve aktif kayıt varsa çoğaltılmaz', async () => {
    const { service, actions } = createService();

    const first = await service.punish({
      type: 'jail',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.None,
      reason: 'sebep',
      source: 'discord',
    });

    expect(actions.calls).toHaveLength(0);
    expect(first.source).toBe('discord');

    const second = await service.punish({
      type: 'jail',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.None,
      reason: 'baska',
      source: 'discord',
    });

    expect(second.caseId).toBe(first.caseId);
    expect(actions.calls).toHaveLength(0);
  });
});

describe('PunishmentService.revoke', () => {
  it('alanları set eder ve yalnızca aktif ONGOING cezalar için actions.revoke çağırır', async () => {
    const { service, actions } = createService();

    const record = await service.punish({
      type: 'jail',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Mid,
      reason: 'sebep',
    });
    actions.calls = [];

    const revoked = await service.revoke({ caseId: record.caseId }, 'staff2', 'iyi davrandi');

    expect(revoked.status).toBe('revoked');
    expect(revoked.revoked).toMatchObject({ by: 'staff2', reason: 'iyi davrandi' });
    expect(actions.calls).toHaveLength(1);
    expect(actions.calls[0]?.method).toBe('revoke');
  });

  it('caseId bulunamazsa hata verir', async () => {
    const { service } = createService();

    await expect(service.revoke({ caseId: 999 }, 'staff1')).rejects.toThrow(
      new UserError('#999 numaralı ceza bulunamadı.'),
    );
  });

  it('userId+type ile aktif kayıt yoksa hata verir', async () => {
    const { service } = createService();

    await expect(service.revoke({ userId: 'user1', type: 'jail' }, 'staff1')).rejects.toThrow(
      new UserError('Bu kullanıcının aktif bir Jail cezası yok.'),
    );
  });

  it('zaten iptal edilmiş kaydı tekrar iptal etmeye çalışınca hata verir', async () => {
    const { service } = createService();
    const record = await service.punish({
      type: 'warn',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Low,
      reason: 'sebep',
    });
    await service.revoke({ caseId: record.caseId }, 'staff1');

    await expect(service.revoke({ caseId: record.caseId }, 'staff1')).rejects.toThrow(
      new UserError(`#${record.caseId} zaten iptal edilmiş.`),
    );
  });

  it('skipAction ile actions.revoke çağrılmaz', async () => {
    const { service, actions } = createService();
    const record = await service.punish({
      type: 'jail',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Mid,
      reason: 'sebep',
    });
    actions.calls = [];

    await service.revoke({ caseId: record.caseId }, 'staff1', 'sebep', { skipAction: true });

    expect(actions.calls).toHaveLength(0);
  });
});

describe('PunishmentService.revokeAll', () => {
  it('aktif kayıtları geri alır ve sayıyı döner', async () => {
    const { service, actions } = createService();

    await service.punish({
      type: 'jail',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Mid,
      reason: 'sebep',
    });
    await service.punish({
      type: 'warn',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Low,
      reason: 'sebep',
    });
    actions.calls = [];

    const count = await service.revokeAll('user1', 'staff2', 'temizlik');

    expect(count).toBe(2);
    // yalnızca jail (ONGOING + aktif) için actions.revoke çağrılmalı
    expect(actions.calls.filter((c) => c.method === 'revoke')).toHaveLength(1);

    const active = await service.findActive('user1', 'jail');
    expect(active).toBeNull();
  });

  it('kayıt yoksa 0 döner ve log olayı yayınlamaz', async () => {
    const { service, events } = createService();
    const count = await service.revokeAll('user-yok', 'staff1');
    expect(count).toBe(0);
    expect(events).toEqual([]);
  });
});

describe('PunishmentService.expireDue', () => {
  it('yalnızca süresi dolan kayıtları sonlandırır ve bir hatada diğerlerini etkilemez', async () => {
    const actions = new FakeActions();
    const { service } = createService({ actions });

    const dueOne = await service.punish({
      type: 'jail',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Mid,
      reason: 'sebep',
      durationMs: 1000,
    });
    const dueTwo = await service.punish({
      type: 'chatmute',
      userId: 'user2',
      staffId: 'staff1',
      staffLevel: Level.Low,
      reason: 'sebep',
      durationMs: 1000,
    });
    const notDue = await service.punish({
      type: 'jail',
      userId: 'user3',
      staffId: 'staff1',
      staffLevel: Level.Mid,
      reason: 'sebep',
      durationMs: 60 * 60 * 1000,
    });

    let callCount = 0;
    const originalRevoke = actions.revoke.bind(actions);
    actions.revoke = async (record: PunishmentRecord) => {
      callCount += 1;
      if (record.caseId === dueOne.caseId) {
        throw new Error('revoke basarisiz');
      }
      return originalRevoke(record);
    };

    const result = await service.expireDue(new Date(Date.now() + 2000));

    expect(result.expired).toBe(1);
    expect(result.failed).toEqual([{ caseId: dueOne.caseId, error: expect.any(Error) }]);
    expect(callCount).toBe(2);

    const stillActive = await service.findActive('user3', 'jail');
    expect(stillActive?.caseId).toBe(notDue.caseId);

    const chatmuteActive = await service.findActive('user2', 'chatmute');
    expect(chatmuteActive).toBeNull();
    expect(dueTwo.type).toBe('chatmute');
  });
});

describe('PunishmentService.handleRejoin', () => {
  it('aktif chatmute/voicemute/jail cezalarını yeniden uygular ve evade olayı yayınlar', async () => {
    const { service, actions, events } = createService();

    await service.punish({
      type: 'jail',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Mid,
      reason: 'sebep',
    });
    actions.calls = [];

    const result = await service.handleRejoin('user1');

    expect(result).toHaveLength(1);
    expect(actions.calls).toHaveLength(1);
    expect(actions.calls[0]?.method).toBe('reapply');
    expect(events.some((event) => event.kind === 'evade')).toBe(true);
  });
});

describe('PunishmentService.findCase / listActive', () => {
  it('ceza numarasıyla kaydı bulur, olmayan numara için null döner', async () => {
    const { service } = createService();
    const record = await service.punish({
      type: 'warn',
      userId: 'user1',
      staffId: 'staff1',
      staffLevel: Level.Low,
      reason: 'sebep',
    });

    expect((await service.findCase(record.caseId))?.userId).toBe('user1');
    expect(await service.findCase(record.caseId + 100)).toBeNull();
  });

  it('yalnızca istenen türdeki aktif kayıtları en yeniden eskiye döner', async () => {
    const { service } = createService();
    const input = { staffId: 'staff1', staffLevel: Level.Mid, reason: 'sebep' };
    const first = await service.punish({ ...input, type: 'jail', userId: 'user1' });
    const second = await service.punish({ ...input, type: 'jail', userId: 'user2' });
    await service.punish({ ...input, type: 'jail', userId: 'user3' });
    await service.punish({ ...input, type: 'chatmute', userId: 'user4' });
    await service.revoke({ userId: 'user3', type: 'jail' }, 'staff1');

    const active = await service.listActive('jail');
    expect(active.map((r) => r.caseId)).toEqual([second.caseId, first.caseId]);
  });
});

describe('PunishmentService.listByUser / listByStaff / listActive', () => {
  it('kullanıcıya ve yetkiliye göre tüm kayıtları, türsüz aktif listeyi döner', async () => {
    const { service } = createService();
    const base = { reason: 'sebep', staffLevel: Level.Mid };
    const a = await service.punish({ ...base, type: 'warn', userId: 'u1', staffId: 's1' });
    const b = await service.punish({ ...base, type: 'jail', userId: 'u1', staffId: 's2' });
    const c = await service.punish({ ...base, type: 'chatmute', userId: 'u2', staffId: 's1' });
    await service.revoke({ caseId: a.caseId }, 's1');

    expect((await service.listByUser('u1')).map((r) => r.caseId)).toEqual([b.caseId, a.caseId]);
    expect((await service.listByStaff('s1')).map((r) => r.caseId)).toEqual([c.caseId, a.caseId]);
    expect((await service.listActive()).map((r) => r.caseId)).toEqual([c.caseId, b.caseId]);
  });
});
