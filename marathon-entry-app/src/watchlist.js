// 通知対象（ウォッチ中）の大会IDリスト — サーバー側で永続化
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WATCH_PATH = path.join(__dirname, '..', 'data', 'watch.local.json');

export function getWatchIds() {
  if (!existsSync(WATCH_PATH)) return [];
  try {
    const ids = JSON.parse(readFileSync(WATCH_PATH, 'utf8')).ids;
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setWatchIds(ids) {
  const clean = [...new Set(ids.filter((x) => typeof x === 'string'))];
  writeFileSync(WATCH_PATH, JSON.stringify({ ids: clean, updatedAt: new Date().toISOString() }, null, 2));
  return clean;
}
