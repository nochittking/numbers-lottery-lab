/*
 * 文字列の正規化ユーティリティ。
 * CSV/OCR 取り込みで、全角数字・全角記号・和暦日付などを揃えるために使う。
 */

// 全角英数・記号（！-～）→ 半角、全角スペース → 半角スペース
export function toHalfWidth(s) {
  return String(s ?? "")
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

// 「第123回」「０１２３回」「123」などから回号を数値文字列に正規化。数字がなければ null。
export function roundKey(round) {
  const digits = toHalfWidth(round).replace(/\D/g, "");
  if (!digits) return null;
  const stripped = digits.replace(/^0+/, "");
  return stripped || "0";
}

const ERA_BASE = { 令和: 2018, 平成: 1988, 昭和: 1925 };

// 日付らしい文字列を YYYY-MM-DD に正規化。日付でなければ null。
export function normalizeDate(s) {
  const t = toHalfWidth(s).trim();
  let m = t.match(/^(\d{4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})日?$/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = t.match(/^(令和|平成|昭和)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日?$/);
  if (m) {
    const n = m[2] === "元" ? 1 : +m[2];
    return isoDate(ERA_BASE[m[1]] + n, +m[3], +m[4]);
  }
  return null;
}

function isoDate(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}`;
}
