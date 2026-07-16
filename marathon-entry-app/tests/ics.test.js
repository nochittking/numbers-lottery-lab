import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar } from '../src/ics.js';
import { buildTrainingPlan } from '../src/trainingPlan.js';

const race = {
  id: 'tsukuba-2026',
  name: '第46回つくばマラソン',
  prefecture: '茨城県',
  city: 'つくば市',
  raceDate: '2026-11-22',
  fee: 12000,
  feeNote: 'フルマラソン',
  entryStart: '2026-07-05T20:00:00+09:00',
  entryEnd: '2026-07-27T18:00:00+09:00',
  entryMethod: '先着',
  timeLimit: '6時間',
  officialUrl: 'https://example.com/tsukuba',
};

test('ICS: カレンダー構造とイベント3種を含む', () => {
  const ics = buildCalendar([race]);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.ok(ics.includes('UID:tsukuba-2026-entry-start@marathon-entry-app'));
  assert.ok(ics.includes('UID:tsukuba-2026-entry-end@marathon-entry-app'));
  assert.ok(ics.includes('UID:tsukuba-2026-race-day@marathon-entry-app'));
});

test('ICS: エントリー開始はUTC変換された日時イベント', () => {
  const ics = buildCalendar([race]);
  // 2026-07-05T20:00+09:00 = 2026-07-05T11:00Z
  assert.ok(ics.includes('DTSTART:20260705T110000Z'));
});

test('ICS: 大会当日は終日イベント + アラーム付き', () => {
  const ics = buildCalendar([race]);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261122'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261123'));
  assert.ok(ics.includes('TRIGGER:-P1D'));
});

test('ICS: テキストのエスケープ', () => {
  const ics = buildCalendar([{ ...race, name: 'テスト,大会;改行\nあり' }]);
  assert.ok(ics.includes('テスト\\,大会\\;改行\\nあり'));
});

test('ICS: 日程未発表の大会はエントリーイベントを出さない', () => {
  const ics = buildCalendar([{ ...race, entryStart: null, entryEnd: null }]);
  assert.ok(!ics.includes('entry-start'));
  assert.ok(!ics.includes('entry-end'));
  assert.ok(ics.includes('race-day'));
});

test('トレーニングプラン: 16週前から前日まで逆算される', () => {
  const plan = buildTrainingPlan('2026-11-22');
  assert.equal(plan.length, 7);
  assert.equal(plan[0].date, '2026-08-02'); // 112日前
  assert.equal(plan.at(-1).date, '2026-11-21'); // 前日
});

test('トレーニングプラン: includePast=false で過去分を除外', () => {
  const plan = buildTrainingPlan('2026-11-22', { now: new Date('2026-10-30T00:00:00+09:00'), includePast: false });
  assert.ok(plan.every((m) => m.date >= '2026-10-30'));
});
