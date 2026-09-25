import { describe, expect, it } from 'vitest';
import { checkTarget, Level, levelLabel, resolveLevel } from './PermissionService.js';

const staffRoles = {
  dusuk: 'role-dusuk',
  orta: 'role-orta',
  yuksek: 'role-yuksek',
};

describe('resolveLevel', () => {
  it('sunucu sahibine Owner kademesi verir', () => {
    const level = resolveLevel({
      userId: 'owner-1',
      roleIds: [],
      ownerId: 'owner-1',
      developerIds: [],
      staffRoles,
    });
    expect(level).toBe(Level.Owner);
  });

  it('DEVELOPER_IDS içindeki kullanıcıya Owner kademesi verir', () => {
    const level = resolveLevel({
      userId: 'dev-1',
      roleIds: [],
      ownerId: 'owner-1',
      developerIds: ['dev-1'],
      staffRoles,
    });
    expect(level).toBe(Level.Owner);
  });

  it('birden fazla yetki rolü varsa en yükseğini seçer (kümülatif)', () => {
    const level = resolveLevel({
      userId: 'user-1',
      roleIds: ['role-dusuk', 'role-yuksek'],
      ownerId: 'owner-1',
      developerIds: [],
      staffRoles,
    });
    expect(level).toBe(Level.High);
  });

  it('tek bir orta yetki rolü Mid kademesi verir', () => {
    const level = resolveLevel({
      userId: 'user-1',
      roleIds: ['role-orta'],
      ownerId: 'owner-1',
      developerIds: [],
      staffRoles,
    });
    expect(level).toBe(Level.Mid);
  });

  it('rolsüz kullanıcı None kademesindedir', () => {
    const level = resolveLevel({
      userId: 'user-1',
      roleIds: [],
      ownerId: 'owner-1',
      developerIds: [],
      staffRoles,
    });
    expect(level).toBe(Level.None);
  });

  it('null rol ID leri yok sayılır', () => {
    const level = resolveLevel({
      userId: 'user-1',
      roleIds: ['role-dusuk'],
      ownerId: 'owner-1',
      developerIds: [],
      staffRoles: { dusuk: null, orta: null, yuksek: null },
    });
    expect(level).toBe(Level.None);
  });
});

describe('levelLabel', () => {
  it('her kademe için doğru Türkçe etiketi döner', () => {
    expect(levelLabel(Level.None)).toBe('yetki yok');
    expect(levelLabel(Level.Low)).toBe('düşük yetki');
    expect(levelLabel(Level.Mid)).toBe('orta yetki');
    expect(levelLabel(Level.High)).toBe('yüksek yetki');
    expect(levelLabel(Level.Owner)).toBe('sahip');
  });
});

describe('checkTarget', () => {
  const base = {
    executorId: 'exec-1',
    executorLevel: Level.High,
    targetId: 'target-1',
    targetLevel: Level.Low,
    botId: 'bot-1',
    ownerId: 'owner-1',
    botTopPosition: 10,
    targetTopPosition: 5,
  };

  it('kendine ceza verilemez', () => {
    const result = checkTarget({ ...base, targetId: 'exec-1', targetLevel: Level.None });
    expect(result).toEqual({ ok: false, reason: 'Kendi üzerinde bu işlemi yapamazsın.' });
  });

  it('bota ceza verilemez', () => {
    const result = checkTarget({ ...base, targetId: 'bot-1' });
    expect(result).toEqual({ ok: false, reason: 'Bot üzerinde bu işlem yapılamaz.' });
  });

  it('sunucu sahibine ceza verilemez', () => {
    const result = checkTarget({ ...base, targetId: 'owner-1', targetLevel: Level.Owner });
    expect(result).toEqual({ ok: false, reason: 'Sunucu sahibi üzerinde bu işlem yapılamaz.' });
  });

  it('eşit kademedeki bir yetkiliye ceza verilemez', () => {
    const result = checkTarget({ ...base, executorLevel: Level.Mid, targetLevel: Level.Mid });
    expect(result).toEqual({
      ok: false,
      reason: 'Kendi kademendeki veya üstündeki bir yetkili üzerinde bu işlemi yapamazsın.',
    });
  });

  it('üst kademedeki bir yetkiliye ceza verilemez', () => {
    const result = checkTarget({ ...base, executorLevel: Level.Low, targetLevel: Level.Mid });
    expect(result).toEqual({
      ok: false,
      reason: 'Kendi kademendeki veya üstündeki bir yetkili üzerinde bu işlemi yapamazsın.',
    });
  });

  it('Owner kademesindeki uygulayıcı eşit kademedeki hedefe (başka bir Owner) ceza verebilir', () => {
    const result = checkTarget({
      ...base,
      executorId: 'dev-1',
      executorLevel: Level.Owner,
      targetId: 'dev-2',
      targetLevel: Level.Owner,
    });
    expect(result).toEqual({ ok: true });
  });

  it('botun rolü hedefin rolünden düşükse reddedilir', () => {
    const result = checkTarget({ ...base, botTopPosition: 3, targetTopPosition: 5 });
    expect(result).toEqual({
      ok: false,
      reason: 'Botun rolü bu kullanıcının rolünden düşük. Botun rolünü yukarı taşıyın.',
    });
  });

  it('botun rolü hedefin rolüne eşitse de reddedilir', () => {
    const result = checkTarget({ ...base, botTopPosition: 5, targetTopPosition: 5 });
    expect(result.ok).toBe(false);
  });

  it('hedef sunucuda değilse (pozisyon null) sadece kademe kontrolleri uygulanır', () => {
    const result = checkTarget({
      ...base,
      botTopPosition: 1,
      targetTopPosition: null,
    });
    expect(result).toEqual({ ok: true });
  });

  it('tüm kontroller geçerse izin verilir', () => {
    const result = checkTarget(base);
    expect(result).toEqual({ ok: true });
  });
});
