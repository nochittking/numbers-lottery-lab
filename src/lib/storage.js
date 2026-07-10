/*
 * ゲームごとに分離した LocalStorage 永続化。
 * 外部送信は一切なし。ブラウザ内にのみ保存する。
 */
const key = (gameId) => `nll_${gameId}_v1`;

export function loadDraws(gameId) {
  try {
    const raw = localStorage.getItem(key(gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

export function saveDraws(gameId, draws) {
  try {
    localStorage.setItem(key(gameId), JSON.stringify(draws));
  } catch (e) {
    /* storage 無効/満杯時は黙って無視 */
  }
}
