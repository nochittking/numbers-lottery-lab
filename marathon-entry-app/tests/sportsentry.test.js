import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEventList, extractDate, extractPrefecture } from '../src/sources/sportsentry.js';

test('extractDate: 各種日付表記を正規化', () => {
  assert.equal(extractDate('開催日: 2026年11月22日(日)'), '2026-11-22');
  assert.equal(extractDate('2027/2/23 開催'), '2027-02-23');
  assert.equal(extractDate('日付なし'), null);
});

test('extractPrefecture: 都道府県名を抽出', () => {
  assert.equal(extractPrefecture('茨城県 つくば市で開催'), '茨城県');
  assert.equal(extractPrefecture('京都府京都市'), '京都府');
  assert.equal(extractPrefecture('どこか'), null);
});

test('parseEventList: イベントカードから大会情報を組み立てる', () => {
  const html = `
    <ul>
      <li>
        <a href="/event/t/105804">第40回 青島太平洋マラソン2026</a>
        <p>2026年12月13日(日) 宮崎県 宮崎市</p>
      </li>
      <li>
        <a href="/event/t/102978">THE CHALLENGE RACE KOBE 1 in 2026</a>
        <p>2026/9/6 兵庫県 神戸市</p>
      </li>
      <li><a href="/event/t/102978">重複リンク（同一ID）</a></li>
      <li><a href="/other/link">対象外リンク</a></li>
    </ul>`;
  const races = parseEventList(html);
  assert.equal(races.length, 2);

  const aotai = races.find((r) => r.id === 'se-105804');
  assert.equal(aotai.name, '第40回 青島太平洋マラソン2026');
  assert.equal(aotai.raceDate, '2026-12-13');
  assert.equal(aotai.prefecture, '宮崎県');
  assert.equal(aotai.source, 'sportsentry');
  assert.equal(aotai.officialUrl, 'https://www.sportsentry.ne.jp/event/t/105804');
});

test('parseEventList: 想定外のHTMLでも例外を出さず空配列', () => {
  assert.deepEqual(parseEventList('<html><body>メンテナンス中</body></html>'), []);
  assert.deepEqual(parseEventList(''), []);
});
