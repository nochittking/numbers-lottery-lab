import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planNotifications } from '../src/notifier/plan.js';
import { SentLog } from '../src/notifier/sentLog.js';
import { buildLineMessage } from '../src/notifier/channels/line.js';

const NOW = new Date('2026-07-16T12:00:00+09:00');

const races = [
  {
    id: 'kyoto-2027',
    name: '京都マラソン2027',
    raceDate: '2027-02-21',
    entryStart: '2026-07-18T00:00:00+09:00', // あと2日 → 計画対象外
    entryEnd: '2026-09-02T23:59:00+09:00',
    entryMethod: '抽選',
    officialUrl: 'https://example.com/kyoto',
  },
  {
    id: 'himeji-2027',
    name: '世界遺産姫路城マラソン2027',
    raceDate: '2027-02-23',
    entryStart: '2026-07-19T00:00:00+09:00', // あと3日 → リマインド対象
    entryEnd: '2026-08-30T23:59:00+09:00',
    entryMethod: '抽選',
    officialUrl: 'https://example.com/himeji',
  },
  {
    id: 'tsukuba-2026',
    name: '第46回つくばマラソン',
    raceDate: '2026-11-22',
    entryStart: '2026-07-05T20:00:00+09:00',
    entryEnd: '2026-07-23T18:00:00+09:00', // 受付中・締切まであと7日 → リマインド対象
    entryMethod: '先着',
    officialUrl: 'https://example.com/tsukuba',
  },
];

test('計画: ウォッチ中の大会のみ・しきい値日数のみリマインドされる', () => {
  const plans = planNotifications(races, ['himeji-2027', 'tsukuba-2026'], NOW);
  const keys = plans.map((p) => p.key).sort();
  assert.deepEqual(keys, ['himeji-2027:entry-start:3', 'tsukuba-2026:entry-end:7']);
});

test('計画: ウォッチしていなければ何も送らない', () => {
  assert.equal(planNotifications(races, [], NOW).length, 0);
});

test('計画: あと2日はしきい値(7/3/1/0)に含まれないので送らない', () => {
  const plans = planNotifications(races, ['kyoto-2027'], NOW);
  assert.equal(plans.length, 0);
});

test('計画: 当日は「本日」表現になり先着警告が付く', () => {
  const now = new Date('2026-07-05T08:00:00+09:00');
  const plans = planNotifications(races, ['tsukuba-2026'], now);
  const start = plans.find((p) => p.kind === 'entry-start');
  assert.ok(start.title.includes('本日'));
  assert.ok(start.body.includes('先着順'));
});

test('計画: 0時開始の大会は開始当日に「受付が始まりました」を送る', () => {
  const now = new Date('2026-07-18T08:00:00+09:00'); // 京都は 7/18 00:00 開始 → すでに受付中
  const plans = planNotifications(races, ['kyoto-2027'], now);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].kind, 'entry-open');
  assert.ok(plans[0].title.includes('始まりました'));
});

test('SentLog: 一度送った通知は再送しない', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sentlog-'));
  const logPath = path.join(dir, 'notified.json');
  const log = new SentLog(logPath);
  assert.equal(log.has('a:entry-start:3'), false);
  log.markSent('a:entry-start:3');
  assert.equal(log.has('a:entry-start:3'), true);
  // 再読込しても永続化されている
  const log2 = new SentLog(logPath);
  assert.equal(log2.has('a:entry-start:3'), true);
});

test('LINEメッセージ: タイトル・本文・URLが結合される', () => {
  const text = buildLineMessage({ title: '🏁 あと3日でエントリー開始！', body: '姫路城マラソン', url: 'https://example.com' });
  assert.equal(text, '🏁 あと3日でエントリー開始！\n姫路城マラソン\nhttps://example.com');
});
