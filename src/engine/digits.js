/*
 * 桁型くじ（ナンバーズ3/4）の統計エンジン。
 * spec = { digits } を受け取る。各桁 0〜9 が独立・重複可。
 *
 * 数学的前提: 各桁は独立した乱数抽選。過去から次回は予測不可。
 */
import { makePrng } from "../lib/prng";

const SAMPLE_DATE = "サンプル";

// 当選数字の文字列（例 "0-1-2-3" のトークン列 or "0123"）→ 桁配列に正規化
function toDigitArray(tokens, digits) {
  // まず1トークンにまとまった数字列を優先（例: 0123）
  const joined = tokens.join("");
  if (/^[0-9]+$/.test(joined) && joined.length === digits) {
    return joined.split("").map(Number);
  }
  // 桁がトークンで分かれている場合
  const arr = tokens.map(Number);
  if (arr.length === digits && arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 9)) {
    return arr;
  }
  return null;
}

// 1行形式: round,date,number（"123" もしくは "1 2 3"）
export function parseDraws(text, spec) {
  const { digits } = spec;
  const draws = [];
  const errors = [];
  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (/^(round|回|#|\/\/)/i.test(line)) return;

    const t = line.split(/[,\s\t]+/).filter(Boolean);
    if (t.length < 3) {
      errors.push(`行 ${idx + 1}: 列が不足（回号, 日付, 当選番号 が必要）`);
      return;
    }
    const round = String(t[0]).slice(0, 12);
    const date = String(t[1]).slice(0, 12);
    const arr = toDigitArray(t.slice(2), digits);
    if (!arr) {
      errors.push(`行 ${idx + 1}: 当選番号は 0〜9 の ${digits} 桁で入力してください`);
      return;
    }
    draws.push({ round, date, digits: arr });
  });
  return { draws, errors };
}

export function computeStats(draws, spec) {
  const { digits } = spec;
  // freqPos[pos][d] = 位置posで数字dが出た回数
  const freqPos = Array.from({ length: digits }, () => new Array(10).fill(0));
  const freqAll = new Array(10).fill(0); // 桁を問わない合計
  let sumSum = 0;

  draws.forEach((d) => {
    d.digits.forEach((v, pos) => {
      freqPos[pos][v] += 1;
      freqAll[v] += 1;
    });
    sumSum += d.digits.reduce((a, b) => a + b, 0);
  });

  const total = draws.length;
  const overallByFreq = freqAll
    .map((freq, d) => ({ d, freq }))
    .sort((a, b) => b.freq - a.freq || a.d - b.d);

  return {
    total, freqPos, freqAll, overallByFreq,
    maxPos: Math.max(1, ...freqPos.flat()),
    avgSum: total ? sumSum / total : 0,
    expectedPerDigit: total ? total / 10 : 0, // 各桁で各数字が出る理論回数
  };
}

export const STRATEGIES = {
  uniform: { label: "均等ランダム", sub: "数学的に最も公正（各桁 0〜9 を等確率で）" },
  hot: { label: "高頻度バイアス", sub: "各桁でよく出た数字を重めに" },
  overdue: { label: "低頻度バイアス", sub: "各桁で出ていない数字を重めに" },
};

function pickDigit(weights) {
  let total = 0;
  for (let d = 0; d <= 9; d++) total += weights[d];
  let r = Math.random() * total;
  for (let d = 0; d <= 9; d++) { r -= weights[d]; if (r <= 0) return d; }
  return 9;
}

export function generatePrediction(strategy, stats, spec) {
  const { digits } = spec;
  const out = [];
  for (let pos = 0; pos < digits; pos++) {
    const f = stats.freqPos[pos];
    const maxF = Math.max(1, ...f);
    const weights = new Array(10);
    for (let d = 0; d <= 9; d++) {
      if (strategy === "hot") weights[d] = (f[d] || 0) + 1;
      else if (strategy === "overdue") weights[d] = (maxF - (f[d] || 0)) + 1;
      else weights[d] = 1;
    }
    out.push(pickDigit(weights));
  }
  return out;
}

export function makeSample(spec, count = 80) {
  const { digits } = spec;
  const rnd = makePrng(digits * 131 + 17);
  const draws = [];
  for (let i = 0; i < count; i++) {
    const arr = [];
    for (let p = 0; p < digits; p++) arr.push(Math.floor(rnd() * 10));
    draws.push({ round: `S${i + 1}`, date: SAMPLE_DATE, digits: arr });
  }
  return draws;
}

export const isSample = (draws) => draws.length > 0 && draws[0]?.date === SAMPLE_DATE;
