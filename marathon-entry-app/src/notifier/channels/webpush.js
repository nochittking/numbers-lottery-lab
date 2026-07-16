// ブラウザプッシュ通知（Web Push / VAPID）
// VAPID鍵は初回起動時に自動生成して data/vapid.local.json に保存する
import webpush from 'web-push';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');
const VAPID_PATH = path.join(DATA_DIR, 'vapid.local.json');
const SUBS_PATH = path.join(DATA_DIR, 'push-subscriptions.local.json');

let vapidKeys = null;

function loadJson(p, fallback) {
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

export function initWebPush() {
  vapidKeys = loadJson(VAPID_PATH, null);
  if (!vapidKeys) {
    vapidKeys = webpush.generateVAPIDKeys();
    writeFileSync(VAPID_PATH, JSON.stringify(vapidKeys, null, 2));
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey,
  );
  return vapidKeys.publicKey;
}

export function getPublicKey() {
  if (!vapidKeys) initWebPush();
  return vapidKeys.publicKey;
}

export function getSubscriptions() {
  return loadJson(SUBS_PATH, []);
}

function saveSubscriptions(subs) {
  writeFileSync(SUBS_PATH, JSON.stringify(subs, null, 2));
}

export function addSubscription(sub) {
  if (!sub?.endpoint || !sub?.keys) return false;
  const subs = getSubscriptions().filter((s) => s.endpoint !== sub.endpoint);
  subs.push(sub);
  saveSubscriptions(subs);
  return true;
}

export function removeSubscription(endpoint) {
  saveSubscriptions(getSubscriptions().filter((s) => s.endpoint !== endpoint));
}

/** 全購読ブラウザへ送信。無効になった購読(410/404)は自動削除 */
export async function sendWebPush({ title, body, url }) {
  const subs = getSubscriptions();
  if (subs.length === 0) return { sent: 0, reason: 'ブラウザ通知の購読なし' };
  if (!vapidKeys) initWebPush();

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) removeSubscription(sub.endpoint);
      else console.warn(`Web Push 送信失敗: ${err.statusCode ?? err.message}`);
    }
  }
  return { sent };
}

export function isConfigured() {
  return getSubscriptions().length > 0;
}
