// iCalendar (.ics) 生成 — Google カレンダー / Apple カレンダー / Outlook 対応
import { buildTrainingPlan } from './trainingPlan.js';

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 の75オクテット行折り返し（簡易版・文字数ベース） */
function foldLine(line) {
  const chunks = [];
  let rest = line;
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = ' ' + rest.slice(73);
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

function toIcsDate(dateStr) {
  return dateStr.replace(/-/g, '');
}

function toIcsDateTimeUtc(isoStr) {
  const d = new Date(isoStr);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

let dtstampCache = null;
function dtstamp() {
  if (!dtstampCache) dtstampCache = toIcsDateTimeUtc(new Date().toISOString());
  return dtstampCache;
}

function vevent({ uid, summary, description, location, url, allDayDate, startDateTime, alarms = [] }) {
  const lines = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${dtstamp()}`];
  if (allDayDate) {
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(allDayDate)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(nextDay(allDayDate))}`);
  } else if (startDateTime) {
    lines.push(`DTSTART:${toIcsDateTimeUtc(startDateTime)}`);
  }
  lines.push(`SUMMARY:${escapeText(summary)}`);
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (location) lines.push(`LOCATION:${escapeText(location)}`);
  if (url) lines.push(`URL:${url}`);
  for (const trigger of alarms) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(summary)}`, `TRIGGER:${trigger}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

/**
 * 大会リストからICSカレンダー文字列を生成する。
 * 各大会につき: エントリー開始 / エントリー締切 / 大会当日 のイベント（判明分のみ）。
 * includeTraining=true で逆算トレーニング予定も追加。
 */
export function buildCalendar(races, { includeTraining = false } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//marathon-entry-app//JP',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:マラソン大会エントリー予定',
    'X-WR-TIMEZONE:Asia/Tokyo',
  ];

  for (const race of races) {
    const location = `${race.prefecture}${race.city ? ' ' + race.city : ''}`;
    const baseDesc = [
      race.entryMethod ? `エントリー方式: ${race.entryMethod}` : null,
      race.fee ? `参加費: ${race.fee.toLocaleString('ja-JP')}円（${race.feeNote || 'フル'}）` : null,
      race.timeLimit ? `制限時間: ${race.timeLimit}` : null,
      race.officialUrl ? `公式: ${race.officialUrl}` : null,
    ].filter(Boolean).join('\n');

    if (race.entryStart) {
      lines.push(...vevent({
        uid: `${race.id}-entry-start@marathon-entry-app`,
        summary: `🏁【エントリー開始】${race.name}`,
        description: `${race.name} のエントリー受付が始まります。先着順の大会は開始直後の申込を推奨！\n${baseDesc}`,
        location,
        url: race.officialUrl,
        startDateTime: race.entryStart,
        alarms: ['-P1D', '-PT1H'],
      }));
    }
    if (race.entryEnd) {
      lines.push(...vevent({
        uid: `${race.id}-entry-end@marathon-entry-app`,
        summary: `⏰【エントリー締切】${race.name}`,
        description: `${race.name} のエントリー締切日です。申し込み忘れに注意！\n${baseDesc}`,
        location,
        url: race.officialUrl,
        startDateTime: race.entryEnd,
        alarms: ['-P3D', '-P1D'],
      }));
    }
    if (race.raceDate) {
      lines.push(...vevent({
        uid: `${race.id}-race-day@marathon-entry-app`,
        summary: `🏃【大会当日】${race.name}`,
        description: baseDesc,
        location,
        url: race.officialUrl,
        allDayDate: race.raceDate,
        alarms: ['-P7D', '-P1D'],
      }));

      if (includeTraining) {
        for (const m of buildTrainingPlan(race.raceDate, { includePast: false })) {
          lines.push(...vevent({
            uid: `${race.id}-training-${m.offsetDays}@marathon-entry-app`,
            summary: `🏋️ ${m.title}｜${race.name}`,
            description: m.detail,
            allDayDate: m.date,
          }));
        }
      }
    }
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
