// LINE通知 — LINE Messaging API（LINE公式アカウントからのプッシュ）
//
// ※ LINE Notify は2025年3月末でサービス終了したため、Messaging API を使用。
// 必要な環境変数:
//   LINE_CHANNEL_ACCESS_TOKEN … LINE Developers コンソールで発行（Messaging APIチャネル）
//   LINE_TO                   … 送信先の userId / groupId（未設定なら友だち全員へブロードキャスト）

const API_BASE = 'https://api.line.me/v2/bot/message';

export function isConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

export function buildLineMessage({ title, body, url }) {
  return [title, body, url].filter(Boolean).join('\n');
}

export async function sendLine(notification) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { sent: 0, reason: 'LINE_CHANNEL_ACCESS_TOKEN 未設定' };

  const to = process.env.LINE_TO;
  const endpoint = to ? `${API_BASE}/push` : `${API_BASE}/broadcast`;
  const payload = {
    ...(to ? { to } : {}),
    messages: [{ type: 'text', text: buildLineMessage(notification) }],
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { sent: 0, reason: `LINE API エラー: HTTP ${res.status} ${text.slice(0, 200)}` };
    }
    return { sent: 1 };
  } catch (err) {
    return { sent: 0, reason: `LINE 送信失敗: ${err.message}` };
  }
}
