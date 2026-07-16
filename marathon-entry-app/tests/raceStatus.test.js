import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStatus, decorateRace, daysUntil, STATUS } from '../src/raceStatus.js';

const NOW = new Date('2026-07-16T12:00:00+09:00');

test('受付中: エントリー期間内', () => {
  const race = {
    raceDate: '2026-11-22',
    entryStart: '2026-07-05T20:00:00+09:00',
    entryEnd: '2026-07-27T18:00:00+09:00',
  };
  assert.equal(computeStatus(race, NOW), STATUS.OPEN);
  const d = decorateRace(race, NOW);
  assert.equal(d.daysToEntryEnd, 12);
});

test('受付前: エントリー開始前', () => {
  const race = {
    raceDate: '2027-02-21',
    entryStart: '2026-07-18T00:00:00+09:00',
    entryEnd: '2026-09-02T23:59:00+09:00',
  };
  assert.equal(computeStatus(race, NOW), STATUS.UPCOMING);
  assert.equal(decorateRace(race, NOW).daysToEntryStart, 2);
});

test('受付終了: 締切を過ぎた', () => {
  const race = {
    raceDate: '2026-10-25',
    entryStart: '2026-04-10T00:00:00+09:00',
    entryEnd: '2026-05-20T23:59:00+09:00',
  };
  assert.equal(computeStatus(race, NOW), STATUS.CLOSED);
});

test('受付終了: 開始日未発表でも締切超過なら終了', () => {
  const race = { raceDate: '2026-10-25', entryStart: null, entryEnd: '2026-05-07T23:59:00+09:00' };
  assert.equal(computeStatus(race, NOW), STATUS.CLOSED);
});

test('未発表: エントリー日程が両方null', () => {
  const race = { raceDate: '2027-03-07', entryStart: null, entryEnd: null };
  assert.equal(computeStatus(race, NOW), STATUS.UNKNOWN);
});

test('開催済み: 大会日を過ぎた', () => {
  const race = { raceDate: '2026-03-01', entryStart: null, entryEnd: null };
  assert.equal(computeStatus(race, NOW), STATUS.FINISHED);
});

test('daysUntil: 当日は0', () => {
  assert.equal(daysUntil('2026-07-16T12:00:00+09:00', NOW), 0);
  assert.equal(daysUntil(null, NOW), null);
});
