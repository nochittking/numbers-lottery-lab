// Discord通知 — Webhook URL を貼るだけで使える一番手軽なチャネル
// 環境変数: DISCORD_WEBHOOK_URL（サーバー設定 > 連携サービス > ウェブフック で発行）

export function isConfigured() {
  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}

export async function sendDiscord({ title, body, url }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return { sent: 0, reason: 'DISCORD_WEBHOOK_URL 未設定' };

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: [`**${title}**`, body, url].filter(Boolean).join('\n'),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { sent: 0, reason: `Discord Webhook エラー: HTTP ${res.status}` };
    return { sent: 1 };
  } catch (err) {
    return { sent: 0, reason: `Discord 送信失敗: ${err.message}` };
  }
}
