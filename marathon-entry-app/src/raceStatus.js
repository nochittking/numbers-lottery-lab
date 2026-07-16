// エントリー状況の判定と残日数計算

export const STATUS = {
  OPEN: '受付中',
  UPCOMING: '受付前',
  CLOSED: '受付終了',
  UNKNOWN: '未発表',
  FINISHED: '開催済み',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** now から target までの残日数（切り上げ、過去なら負値） */
export function daysUntil(target, now = new Date()) {
  if (!target) return null;
  const t = target instanceof Date ? target : new Date(target);
  return Math.ceil((t.getTime() - now.getTime()) / MS_PER_DAY);
}

/**
 * 大会のエントリー状況を判定する。
 * entryStart が未発表でも entryEnd を過ぎていれば「受付終了」。
 * 開催日を過ぎた大会は「開催済み」。
 */
export function computeStatus(race, now = new Date()) {
  const raceDate = race.raceDate ? new Date(`${race.raceDate}T23:59:59+09:00`) : null;
  if (raceDate && now > raceDate) return STATUS.FINISHED;

  const start = race.entryStart ? new Date(race.entryStart) : null;
  const end = race.entryEnd ? new Date(race.entryEnd) : null;

  if (end && now > end) return STATUS.CLOSED;
  if (start && now < start) return STATUS.UPCOMING;
  if (start && (!end || now <= end)) return STATUS.OPEN;
  // entryStart 不明で entryEnd のみ判明・期限内 → 受付中とみなす
  if (!start && end && now <= end) return STATUS.OPEN;
  return STATUS.UNKNOWN;
}

/** APIレスポンス用に status / countdown を付与した race を返す */
export function decorateRace(race, now = new Date()) {
  const status = computeStatus(race, now);
  const decorated = { ...race, status };

  if (status === STATUS.UPCOMING) {
    decorated.daysToEntryStart = daysUntil(race.entryStart, now);
  }
  if (status === STATUS.OPEN && race.entryEnd) {
    decorated.daysToEntryEnd = daysUntil(race.entryEnd, now);
  }
  if (race.raceDate && status !== STATUS.FINISHED) {
    decorated.daysToRace = daysUntil(`${race.raceDate}T00:00:00+09:00`, now);
  }
  return decorated;
}
