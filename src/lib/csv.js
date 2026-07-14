/*
 * CSV / OCRテキストの取り込みパーサ。
 *
 * みずほ銀行公式サイトで配布される当せん番号CSV（Shift_JISの場合あり）や、
 * 当せん結果一覧のスクリーンショットをOCRしたテキストを、寛容に解釈して
 * 抽せん結果レコードに変換する。列構成の揺れ（回別/抽せん日/本数字/ボーナス数字/
 * 賞金額などの付随列）を吸収するため、ヘッダー位置に依存しないヒューリスティックで
 * 「回号 → 日付 → 数字列」の順に抽出する。
 *
 * すべてブラウザ内で完結し、外部送信は一切行わない。
 */
import { toHalfWidth, normalizeDate } from "./text";

// ─── 文字コード判定 ─────────────────────────────────────
// UTF-8として厳密デコードに失敗したら Shift_JIS として再デコードする。
export function decodeCsvBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) {
    try {
      return new TextDecoder("shift_jis").decode(bytes);
    } catch (e2) {
      return new TextDecoder("utf-8").decode(bytes); // 最終フォールバック
    }
  }
}

// ─── CSV 行分割（ダブルクォート対応）────────────────────
export function splitCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += c;
    } else if (c === '"') inQuote = true;
    else if (c === ",") { fields.push(cur); cur = ""; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

// ─── 行 → 抽せんレコードのヒューリスティック抽出 ─────────
// OCR誤認識しやすい文字を数字に矯正（結果が数字/括弧数字になる場合のみ採用）
function fixOcrToken(t) {
  const fixed = t.replace(/[OoＯｏ〇]/g, "0").replace(/[Il|ｌ]/g, "1");
  return /^\(?\d+\)?$/.test(fixed) ? fixed : t;
}

/*
 * fields（1行ぶんの列配列）から1レコードを抽出する。
 * 返り値: { status: "ok", draw } | { status: "skip" } | { status: "error", message }
 *  - skip  … ヘッダー・空行・注釈などデータらしくない行
 *  - error … データらしいのに仕様を満たさない行
 */
export function extractRow(fields, spec, opts = {}) {
  const raw = fields
    .map((f) => toHalfWidth(f).replace(/^["\s]+|["\s]+$/g, ""))
    .map((f) => (opts.ocr ? fixOcrToken(f) : f));

  // 回号: 「第N回」を最優先、なければ最初の数字のみの列
  let roundIdx = -1, round = null;
  for (let i = 0; i < raw.length; i++) {
    const m = raw[i].match(/第\s*(\d+)\s*回/);
    if (m) { roundIdx = i; round = m[1]; break; }
  }
  if (roundIdx < 0) {
    for (let i = 0; i < raw.length; i++) {
      const m = raw[i].match(/^(\d{1,6})回?$/);
      if (m) { roundIdx = i; round = m[1]; break; }
    }
  }

  // 日付: 回号より後ろの列から探す（見つからなくてもよい）
  let dateIdx = -1, date = "";
  for (let i = Math.max(roundIdx, -1) + 1; i < raw.length; i++) {
    const d = normalizeDate(raw[i]);
    if (d) { dateIdx = i; date = d; break; }
  }

  const numericCount = raw.filter((f) => /^\(?\d+\)?$/.test(f)).length;
  if (round == null) {
    // 回号がなく数字も乏しい行はヘッダー等とみなして黙ってスキップ
    if (numericCount < 2) return { status: "skip" };
    return { status: "error", message: "回号（第○○回）が見つかりません" };
  }

  if (spec.type === "combination") return extractCombination(raw, spec, round, date, roundIdx, dateIdx);
  return extractDigits(raw, spec, round, date, roundIdx, dateIdx);
}

// 組合せ型（ロト系）: 回号・日付の後ろから本数字 pick 個＋ボーナス bonus 個を拾う。
// 「(09)」のような括弧付きはボーナスとして扱う。賞金額（円・カンマ付き）や
// セット球（英字）などの付随列は数字列として成立しないため自然に無視される。
function extractCombination(raw, spec, round, date, roundIdx, dateIdx) {
  const { min, max, pick, bonus } = spec;
  const nums = [];
  const bns = [];
  for (let i = roundIdx + 1; i < raw.length; i++) {
    if (i === dateIdx) continue;
    if (nums.length >= pick && bns.length >= bonus) break; // 数字が揃ったら賞金列等は見ない
    const f = raw[i];
    const bm = f.match(/^\((\d{1,2})\)$/);
    if (bm) {
      const v = +bm[1];
      if (v >= min && v <= max && bns.length < bonus) bns.push(v);
      continue;
    }
    if (/^\d{1,2}$/.test(f)) {
      const v = +f;
      if (v < min || v > max) continue;
      if (nums.length < pick) nums.push(v);
      else if (bns.length < bonus) bns.push(v);
    }
  }
  if (nums.length !== pick) {
    return { status: "error", message: `本数字が ${pick} 個読み取れません（${nums.length} 個検出）` };
  }
  if (new Set(nums).size !== pick) {
    return { status: "error", message: "本数字が重複しています" };
  }
  return {
    status: "ok",
    draw: {
      round, date,
      numbers: [...nums].sort((a, b) => a - b),
      bonus: [...bns].sort((a, b) => a - b),
    },
  };
}

// 桁型（ナンバーズ系）: 回号・日付の後ろで「ちょうど digits 桁」の列を当せん番号とする。
// 見つからない場合は 1桁の列が digits 個連続しているパターンも許容する。
function extractDigits(raw, spec, round, date, roundIdx, dateIdx) {
  const { digits } = spec;
  for (let i = roundIdx + 1; i < raw.length; i++) {
    if (i === dateIdx) continue;
    if (new RegExp(`^\\d{${digits}}$`).test(raw[i])) {
      return { status: "ok", draw: { round, date, digits: raw[i].split("").map(Number) } };
    }
  }
  // 「1 2 3」のように桁が分かれているケース
  const singles = [];
  for (let i = roundIdx + 1; i < raw.length; i++) {
    if (i === dateIdx) continue;
    if (/^\d$/.test(raw[i])) singles.push(+raw[i]);
    else if (singles.length) break;
  }
  if (singles.length === digits) {
    return { status: "ok", draw: { round, date, digits: singles } };
  }
  return { status: "error", message: `当せん番号（${digits}桁）が読み取れません` };
}

// ─── CSVテキスト全体 → レコード群 ────────────────────────
export function parseCsvText(text, spec) {
  const draws = [];
  const errors = [];
  text.split(/\r?\n/).forEach((line, idx) => {
    if (!line.trim()) return;
    const res = extractRow(splitCsvLine(line), spec);
    if (res.status === "ok") draws.push(res.draw);
    else if (res.status === "error") errors.push(`行 ${idx + 1}: ${res.message}`);
  });
  return { draws, errors };
}

// ─── OCRテキスト → 行ごとの読み取り結果（確認画面用）────
// 返り値: [{ line, raw, draw|null, message|null }]（skip行は含めない）
export function parseOcrText(text, spec) {
  const results = [];
  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const normalized = toHalfWidth(rawLine)
      .replace(/第\s*(\d+)\s*回/g, "第$1回") // OCRで割れた「第 123 回」を結合
      // OCRで割れた日付「2023 年 3 月 3 日」を結合（日付中の数字を本数字と誤認しないため）
      .replace(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/g, "$1年$2月$3日")
      .replace(/(令和|平成|昭和)\s*(元|\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/g, "$1$2年$3月$4日")
      .replace(/(\d{4})\s*([/-])\s*(\d{1,2})\s*\2\s*(\d{1,2})/g, "$1$2$3$2$4")
      .trim();
    if (!normalized) return;
    const tokens = normalized.split(/[,、\s]+/).filter(Boolean);
    const res = extractRow(tokens, spec, { ocr: true });
    if (res.status === "skip") return;
    results.push({
      line: idx + 1,
      raw: rawLine.trim(),
      draw: res.status === "ok" ? res.draw : null,
      message: res.status === "error" ? res.message : null,
    });
  });
  return results;
}
