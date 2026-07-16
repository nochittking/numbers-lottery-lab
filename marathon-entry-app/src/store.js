// 大会データの読み込みとライブ更新（リモートフィード + ポータル連携）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchSportsEntry } from './sources/sportsentry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, '..', 'data', 'races.json');
const OVERLAY_PATH = path.join(__dirname, '..', 'data', 'races.local.json');
const PORTAL_PATH = path.join(__dirname, '..', 'data', 'portal.local.json');

let cache = null;

function loadFile(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function loadOptional(p) {
  if (!existsSync(p)) return null;
  try {
    return loadFile(p);
  } catch {
    return null; // 壊れたファイルは無視してシードのみ使う
  }
}

/** シード + リモートフィード上書き + ポータル取得分をマージして返す */
export function loadRaces() {
  if (cache) return cache;
  const seed = loadFile(SEED_PATH);
  const overlay = loadOptional(OVERLAY_PATH) ?? { races: [] };
  const portal = loadOptional(PORTAL_PATH) ?? { races: [] };

  const byId = new Map(seed.races.map((r) => [r.id, r]));
  for (const r of overlay.races ?? []) {
    byId.set(r.id, { ...byId.get(r.id), ...r });
  }
  // ポータル取得分は「手元にない大会の追加」のみ（検証済みデータを上書きしない）
  const knownNames = new Set([...byId.values()].map((r) => r.name.replace(/\s/g, '')));
  for (const r of portal.races ?? []) {
    if (byId.has(r.id)) continue;
    if (knownNames.has(r.name.replace(/\s/g, ''))) continue;
    byId.set(r.id, r);
  }

  cache = {
    generatedAt: overlay.generatedAt ?? seed.generatedAt,
    updatedFrom: overlay.updatedFrom ?? null,
    portalFetchedAt: portal.fetchedAt ?? null,
    portalCount: (portal.races ?? []).length,
    races: [...byId.values()],
  };
  return cache;
}

/**
 * ポータルサイト（スポーツエントリー）から大会一覧を取得して保存する。
 * 失敗してもアプリはシードデータで動き続ける。
 */
export async function refreshFromPortals() {
  try {
    const races = await fetchSportsEntry();
    if (races.length === 0) {
      return { updated: false, reason: 'ポータルから大会を取得できませんでした（ネットワーク/HTML構造を確認）' };
    }
    writeFileSync(PORTAL_PATH, JSON.stringify({
      fetchedAt: new Date().toISOString(),
      races,
    }, null, 2));
    cache = null;
    return { updated: true, count: races.length };
  } catch (err) {
    return { updated: false, reason: `ポータル取得エラー: ${err.message}` };
  }
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
