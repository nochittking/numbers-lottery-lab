// どの大会について・いつ・どんなリマインドを送るかの計画ロジック
import { decorateRace, STATUS } from '../raceStatus.js';

export const ENTRY_START_REMIND_DAYS = [7, 3, 1, 0];
export const ENTRY_END_REMIND_DAYS = [7, 3, 1, 0];

function jstDate(isoStr) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).format(new Date(isoStr)).replace(' 0:00', '');
}

function jstYmd(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/**
 * JSTの暦日ベースの残日数（時刻は無視）。
 * 「当日20時エントリー開始」でも朝の時点で残0日=本日として扱うため、
 * raceStatus.daysUntil（時刻込み切り上げ）とは別に持つ。
 */
export function calendarDaysUntil(isoStr, now = new Date()) {
  const target = new Date(`${jstYmd(new Date(isoStr))}T00:00:00Z`);
  const base = new Date(`${jstYmd(now)}T00:00:00Z`);
  return Math.round((target - base) / 864e5);
}

/**
 * ウォッチ中の大会から、いま送るべきリマインド一覧を計画する。
 * 返り値の key は重複送信防止用の一意キー。
 */
export function planNotifications(races, watchIds, now = new Date()) {
  const watched = new Set(watchIds);
  const plans = [];

  for (const race of races) {
    if (!watched.has(race.id)) continue;
    const r = decorateRace(race, now);

    const startDays = r.entryStart ? calendarDaysUntil(r.entryStart, now) : null;
    const endDays = r.entryEnd ? calendarDaysUntil(r.entryEnd, now) : null;

    if (r.status === STATUS.UPCOMING && ENTRY_START_REMIND_DAYS.includes(startDays)) {
      const when = startDays === 0 ? '本日' : `あと${startDays}日で`;
      plans.push({
        raceId: r.id,
        kind: 'entry-start',
        daysLeft: startDays,
        key: `${r.id}:entry-start:${startDays}`,
        title: `🏁 ${when}エントリー開始！`,
        body: `${r.name}\nエントリー開始: ${jstDate(r.entryStart)}${r.entryMethod === '先着' ? '\n⚠️ 先着順！開始直後の申込を推奨' : ''}`,
        url: r.officialUrl ?? null,
      });
    }

    // 開始時刻を過ぎて「受付中」になった当日にも知らせる（0時開始の大会で当日通知が抜けないように）
    if (r.status === STATUS.OPEN && startDays === 0) {
      plans.push({
        raceId: r.id,
        kind: 'entry-open',
        daysLeft: 0,
        key: `${r.id}:entry-open:0`,
        title: '🏁 エントリー受付が始まりました！',
        body: `${r.name}\n${r.entryEnd ? `締切: ${jstDate(r.entryEnd)}` : ''}${r.entryMethod === '先着' ? '\n⚠️ 先着順！お早めに' : ''}`.trim(),
        url: r.officialUrl ?? null,
      });
    }

    if (r.status === STATUS.OPEN && endDays != null && ENTRY_END_REMIND_DAYS.includes(endDays)) {
      const when = endDays === 0 ? '本日締切' : `締切まであと${endDays}日`;
      plans.push({
        raceId: r.id,
        kind: 'entry-end',
        daysLeft: endDays,
        key: `${r.id}:entry-end:${endDays}`,
        title: `⏰ ${when}！`,
        body: `${r.name}\nエントリー締切: ${jstDate(r.entryEnd)}\nまだ申し込んでいなければお早めに！`,
        url: r.officialUrl ?? null,
      });
    }
  }
  return plans;
}
