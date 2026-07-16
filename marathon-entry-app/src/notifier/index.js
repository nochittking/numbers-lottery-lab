// リマインド送信の実行本体 — 計画 → 重複チェック → 各チャネルへ配信
import { loadRaces } from '../store.js';
import { getWatchIds } from '../watchlist.js';
import { planNotifications } from './plan.js';
import { SentLog } from './sentLog.js';
import * as webpush from './channels/webpush.js';
import * as line from './channels/line.js';
import * as discord from './channels/discord.js';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6時間ごと

const CHANNELS = [
  { name: 'webpush', mod: webpush, send: webpush.sendWebPush },
  { name: 'line', mod: line, send: line.sendLine },
  { name: 'discord', mod: discord, send: discord.sendDiscord },
];

export function channelStatus() {
  return {
    webpush: { configured: webpush.isConfigured(), detail: `購読ブラウザ ${webpush.getSubscriptions().length}件` },
    line: { configured: line.isConfigured(), detail: line.isConfigured() ? (process.env.LINE_TO ? '個別送信' : 'ブロードキャスト') : 'LINE_CHANNEL_ACCESS_TOKEN 未設定' },
    discord: { configured: discord.isConfigured(), detail: discord.isConfigured() ? 'Webhook設定済み' : 'DISCORD_WEBHOOK_URL 未設定' },
    watchCount: getWatchIds().length,
  };
}

/**
 * ウォッチ中の大会のリマインドをチェックして送信する。
 * dryRun=true なら送信せず計画だけ返す（動作確認用）。
 */
export async function runNotifier({ dryRun = false, sentLog = new SentLog(), now = new Date() } = {}) {
  const { races } = loadRaces();
  const watchIds = getWatchIds();
  const plans = planNotifications(races, watchIds, now);
  const pending = plans.filter((p) => !sentLog.has(p.key));

  if (dryRun) return { planned: plans, pending, sent: [] };

  const results = [];
  for (const notification of pending) {
    const perChannel = {};
    let delivered = false;
    for (const ch of CHANNELS) {
      if (!ch.mod.isConfigured()) continue;
      const result = await ch.send(notification);
      perChannel[ch.name] = result;
      if (result.sent > 0) delivered = true;
    }
    // どこか1チャネルにでも届いたら送信済みとして記録
    if (delivered) sentLog.markSent(notification.key);
    results.push({ key: notification.key, title: notification.title, delivered, perChannel });
  }
  return { planned: plans, pending, sent: results };
}

/** サーバー起動時に呼ぶ: 即時チェック + 6時間ごとの定期チェック */
export function startNotifierSchedule() {
  const run = async () => {
    try {
      const { pending, sent } = await runNotifier();
      if (pending.length > 0) {
        const ok = sent.filter((s) => s.delivered).length;
        console.log(`🔔 リマインド ${pending.length}件中 ${ok}件送信`);
      }
    } catch (err) {
      console.warn(`リマインドチェック失敗: ${err.message}`);
    }
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS).unref();
}
