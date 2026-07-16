// ポータル連携: スポーツエントリー (sportsentry.ne.jp) のフルマラソン一覧を取得
//
// ⚠️ 実験的機能: ポータル側のHTML構造変更で動かなくなる可能性があります。
// 失敗してもアプリ本体は同梱データで動き続けます（このモジュールは空配列を返すだけ）。
// 構造が変わった場合は parseEventList のセレクタを調整してください。
import * as cheerio from 'cheerio';

const LIST_URLS = [
  'https://www.sportsentry.ne.jp/events/full', // フルマラソン
];

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

/** 「2026年11月22日」「2026/11/22」等の表記を YYYY-MM-DD に正規化 */
export function extractDate(text) {
  if (!text) return null;
  const m = text.match(/(20\d{2})[年/\-.]\s*(\d{1,2})[月/\-.]\s*(\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function extractPrefecture(text) {
  if (!text) return null;
  return PREFECTURES.find((p) => text.includes(p)) ?? null;
}

/**
 * イベント一覧HTMLをパースして部分的な大会情報の配列を返す。
 * イベント詳細リンク(/event/t/<id>)を軸に、周辺テキストから開催日・都道府県を推定する。
 */
export function parseEventList(html, baseUrl = 'https://www.sportsentry.ne.jp') {
  const $ = cheerio.load(html);
  const seen = new Map();

  $('a[href*="/event/t/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const idMatch = href.match(/\/event\/t\/(\d+)/);
    if (!idMatch) return;
    const eventId = idMatch[1];

    // リンク自身か祖先ブロックからテキストを収集（カード/リスト行を想定）
    const block = $(el).closest('li, article, section, tr, div');
    const blockText = (block.length ? block.text() : $(el).text()).replace(/\s+/g, ' ').trim();
    const name = $(el).text().replace(/\s+/g, ' ').trim() || blockText.slice(0, 60);
    if (!name || name.length < 4) return;

    const existing = seen.get(eventId);
    const race = {
      id: `se-${eventId}`,
      name,
      prefecture: extractPrefecture(blockText) ?? '不明',
      city: null,
      raceDate: extractDate(blockText),
      dateConfirmed: false,
      events: ['フル'],
      capacity: null,
      fee: null,
      feeNote: 'ポータル参照',
      entryStart: null,
      entryEnd: null,
      entryMethod: '先着',
      entryNote: 'スポーツエントリー掲載中（掲載中=受付中の場合が多い。詳細はリンク先参照）',
      timeLimit: null,
      officialUrl: new URL(href, baseUrl).href,
      note: 'ポータル連携で自動取得した大会です。',
      source: 'sportsentry',
      verifiedAt: new Date().toISOString().slice(0, 10),
    };
    // 同じイベントIDなら情報量の多い方を残す
    if (!existing || (!existing.raceDate && race.raceDate)) seen.set(eventId, race);
  });

  return [...seen.values()];
}

/** 一覧ページ群を取得してパースする。失敗時は空配列（アプリは止めない） */
export async function fetchSportsEntry() {
  const all = [];
  for (const url of LIST_URLS) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (marathon-entry-app; personal use)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.warn(`スポーツエントリー取得失敗: HTTP ${res.status} (${url})`);
        continue;
      }
      all.push(...parseEventList(await res.text()));
    } catch (err) {
      console.warn(`スポーツエントリー取得エラー: ${err.message} (${url})`);
    }
  }
  return all;
}
