// 大会データの読み込みとライブ更新（リモートフィード）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'data', 'races.json');
const OVERLAY_PATH = path.join(__dirname, '..', 'data', 'races.local.json');

let cache = null;

function loadFile(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** シードデータ + ローカル上書き（リモートフィード取得結果）をマージして返す */
export function loadRaces() {
  if (cache) return cache;
  const seed = loadFile(SEED_PATH);
  let overlay = { races: [] };
  if (existsSync(OVERLAY_PATH)) {
    try {
      overlay = loadFile(OVERLAY_PATH);
    } catch {
      // 壊れたオーバーレイは無視してシードのみ使う
    }
  }
  const byId = new Map(seed.races.map((r) => [r.id, r]));
  for (const r of overlay.races ?? []) {
    byId.set(r.id, { ...byId.get(r.id), ...r });
  }
  cache = {
    generatedAt: overlay.generatedAt ?? seed.generatedAt,
    updatedFrom: overlay.updatedFrom ?? null,
    races: [...byId.values()],
  };
  return cache;
}

function isValidRace(r) {
  return r && typeof r.id === 'string' && typeof r.name === 'string';
}

/**
 * RACES_FEED_URL からJSONフィードを取得してローカル上書きに保存する。
 * フィードは { races: [...] } 形式（data/races.json と同スキーマ）。
 * 未設定・失敗時は { updated: false, reason } を返す（アプリはシードデータで動き続ける）。
 */
export async function refreshFromFeed(feedUrl = process.env.RACES_FEED_URL) {
  if (!feedUrl) return { updated: false, reason: 'RACES_FEED_URL 未設定（同梱データを使用）' };
  try {
    const res = await fetch(feedUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { updated: false, reason: `フィード取得失敗: HTTP ${res.status}` };
    const body = await res.json();
    const races = (body.races ?? []).filter(isValidRace);
    if (races.length === 0) return { updated: false, reason: 'フィードに有効な大会データがありません' };
    writeFileSync(OVERLAY_PATH, JSON.stringify({
      generatedAt: new Date().toISOString().slice(0, 10),
      updatedFrom: feedUrl,
      races,
    }, null, 2));
    cache = null;
    return { updated: true, count: races.length };
  } catch (err) {
    return { updated: false, reason: `フィード取得エラー: ${err.message}` };
  }
}
