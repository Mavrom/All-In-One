/** Kümülatif yetki kademesi. */
export const Level = {
  None: 0,
  Low: 1,
  Mid: 2,
  High: 3,
  Owner: 4,
} as const;

export type Level = (typeof Level)[keyof typeof Level];

/** Sunucunun düşük/orta/yüksek yetki rolü ID'leri (kurulmamışsa `null`). */
export interface StaffRoles {
  dusuk: string | null;
  orta: string | null;
  yuksek: string | null;
}

export type Check = { ok: true } | { ok: false; reason: string };

/**
 * Kullanıcının kademesini belirler: sunucu sahibi ve `DEVELOPER_IDS` Owner, aksi halde
 * sahip olduğu yetki rollerinin en yükseği (kümülatif), hiçbiri yoksa None.
 */
export function resolveLevel(input: {
  userId: string;
  roleIds: readonly string[];
  ownerId: string;
  developerIds: readonly string[];
  staffRoles: StaffRoles;
}): Level {
  const { userId, roleIds, ownerId, developerIds, staffRoles } = input;

  if (userId === ownerId || developerIds.includes(userId)) {
    return Level.Owner;
  }

  if (staffRoles.yuksek !== null && roleIds.includes(staffRoles.yuksek)) {
    return Level.High;
  }
  if (staffRoles.orta !== null && roleIds.includes(staffRoles.orta)) {
    return Level.Mid;
  }
  if (staffRoles.dusuk !== null && roleIds.includes(staffRoles.dusuk)) {
    return Level.Low;
  }

  return Level.None;
}

const LEVEL_LABELS: Record<Level, string> = {
  [Level.None]: 'yetki yok',
  [Level.Low]: 'düşük yetki',
  [Level.Mid]: 'orta yetki',
  [Level.High]: 'yüksek yetki',
  [Level.Owner]: 'sahip',
};

/** Kademenin Türkçe kullanıcıya görünen adını döner. */
export function levelLabel(level: Level): string {
  return LEVEL_LABELS[level];
}

/**
 * Bir cezanın hedefine uygulanıp uygulanamayacağını sırayla kontrol eder: kendine, bota,
 * sunucu sahibine ceza verilemez; hedef, uygulayanla eşit veya üst kademedeyse reddedilir
 * (uygulayan Owner ise bu kural uygulanmaz); son olarak botun rolü hedefinkinden yüksek
 * olmalıdır (hedef sunucuda değilse bu kontrol atlanır).
 */
export function checkTarget(input: {
  executorId: string;
  executorLevel: Level;
  targetId: string;
  targetLevel: Level;
  botId: string;
  ownerId: string;
  botTopPosition: number;
  targetTopPosition: number | null;
}): Check {
  const {
    executorId,
    executorLevel,
    targetId,
    targetLevel,
    botId,
    ownerId,
    botTopPosition,
    targetTopPosition,
  } = input;

  if (targetId === executorId) {
    return { ok: false, reason: 'Kendine ceza veremezsin.' };
  }

  if (targetId === botId) {
    return { ok: false, reason: 'Bota ceza verilemez.' };
  }

  if (targetId === ownerId) {
    return { ok: false, reason: 'Sunucu sahibine ceza verilemez.' };
  }

  if (executorLevel !== Level.Owner && targetLevel >= executorLevel) {
    return {
      ok: false,
      reason: 'Kendi kademendeki veya üstündeki bir yetkiliye ceza veremezsin.',
    };
  }

  if (targetTopPosition !== null && botTopPosition <= targetTopPosition) {
    return {
      ok: false,
      reason: 'Botun rolü bu kullanıcının rolünden düşük. Botun rolünü yukarı taşıyın.',
    };
  }

  return { ok: true };
}
