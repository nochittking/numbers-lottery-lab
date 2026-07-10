/*
 * 組合せ型くじ（ロト7/6・ミニロト）の統計エンジン。
 * spec = { min, max, pick, bonus } を受け取って汎用的に処理する。
 *
 * 数学的前提: 各回は独立した乱数抽選。過去から次回は予測不可。
 * 本エンジンは「傾向の可視化」と「傾向に沿った数字生成（エンタメ）」のためのもの。
 */
import { makePrng } from "../lib/prng";

const SAMPLE_DATE = "サンプル";

// ─── パース＆バリデーション ──────────────────────────────
// 1行形式: round,date,n1..n{pick}[,b1..b{bonus}]（カンマ/空白/タブ区切り）
export function parseDraws(text, spec) {
  const { min, max, pick, bonus } = spec;
  const draws = [];
  const errors = [];
  text.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (/^(round|回|#|\/\/)/i.test(line)) return; // ヘッダー/注釈行はスキップ

    const t = line.split(/[,\s\t]+/).filter(Boolean);
    if (t.length < 2 + pick) {
      errors.push(`行 ${idx + 1}: 列が不足（最低 ${2 + pick} 列必要）`);
      return;
    }
    const round = String(t[0]).slice(0, 12);
    const date = String(t[1]).slice(0, 12);
    const nums = t.slice(2, 2 + pick).map(Number);
    const bns = t.slice(2 + pick, 2 + pick + bonus).map(Number);

    if (!nums.every((n) => Number.isInteger(n) && n >= min && n <= max)) {
      errors.push(`行 ${idx + 1}: 本数字は ${min}〜${max} の整数で ${pick} 個必要`);
      return;
    }
    if (new Set(nums).size !== pick) {
      errors.push(`行 ${idx + 1}: 本数字が重複しています`);
      return;
    }
    const validBonus = bns.filter(
      (n) => Number.isInteger(n) && n >= min && n <= max
    );
    draws.push({
      round, date,
      numbers: [...nums].sort((a, b) => a - b),
      bonus: validBonus.sort((a, b) => a - b),
    });
  });
  return { draws, errors };
}

// ─── 統計計算 ───────────────────────────────────────────
export function computeStats(draws, spec) {
  const { min, max, pick } = spec;
  const size = max + 1;
  const freq = new Array(size).fill(0);
  const lastSeen = new Array(size).fill(-1);
  const lowThreshold = Math.floor((min + max) / 2); // 低位/高位の境界

  let oddSum = 0, lowSum = 0, sumSum = 0;
  const pairCount = {};

  draws.forEach((d, i) => {
    d.numbers.forEach((n) => { freq[n] += 1; lastSeen[n] = i; });
    oddSum += d.numbers.filter((n) => n % 2 === 1).length;
    lowSum += d.numbers.filter((n) => n <= lowThreshold).length;
    sumSum += d.numbers.reduce((a, b) => a + b, 0);
    for (let a = 0; a < d.numbers.length; a++) {
      for (let b = a + 1; b < d.numbers.length; b++) {
        const key = `${d.numbers[a]}-${d.numbers[b]}`;
        pairCount[key] = (pairCount[key] || 0) + 1;
      }
    }
  });

  const total = draws.length;
  const gap = new Array(size).fill(total);
  for (let n = min; n <= max; n++) {
    if (lastSeen[n] >= 0) gap[n] = total - 1 - lastSeen[n];
  }

  const nums = [];
  for (let n = min; n <= max; n++) nums.push({ n, freq: freq[n], gap: gap[n] });

  const byFreq = [...nums].sort((a, b) => b.freq - a.freq || a.n - b.n);
  const byGap = [...nums].sort((a, b) => b.gap - a.gap || a.n - b.n);
  const topPairs = Object.entries(pairCount)
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const span = max - min + 1;
  return {
    total, freq, gap, nums, byFreq, byGap, topPairs, lowThreshold,
    maxFreq: Math.max(1, ...freq.slice(min, max + 1)),
    avgOdd: total ? oddSum / total : 0,
    avgLow: total ? lowSum / total : 0,
    avgSum: total ? sumSum / total : 0,
    expectedFreq: total ? (total * pick) / span : 0,
  };
}

// ─── 重み付き非復元抽出 ─────────────────────────────────
function weightedSample(weights, min, max, k) {
  const w = weights.slice();
  const picked = [];
  for (let i = 0; i < k; i++) {
    let total = 0;
    for (let n = min; n <= max; n++) if (w[n] > 0) total += w[n];
    if (total <= 0) break;
    let r = Math.random() * total;
    let chosen = -1;
    for (let n = min; n <= max; n++) {
      if (w[n] <= 0) continue;
      r -= w[n];
      if (r <= 0) { chosen = n; break; }
    }
    if (chosen === -1) for (let n = min; n <= max; n++) if (w[n] > 0) { chosen = n; break; }
    picked.push(chosen);
    w[chosen] = 0;
  }
  return picked.sort((a, b) => a - b);
}

export const STRATEGIES = {
  uniform: { label: "均等ランダム", sub: "数学的に最も公正（全数字を等確率で）" },
  hot: { label: "高頻度バイアス", sub: "過去によく出ている数字を重めに" },
  overdue: { label: "ご無沙汰バイアス", sub: "しばらく出ていない数字を重めに" },
};

export function generatePrediction(strategy, stats, spec) {
  const { min, max, pick } = spec;
  const weights = new Array(max + 1).fill(0);
  for (let n = min; n <= max; n++) {
    if (strategy === "hot") weights[n] = (stats.freq[n] || 0) + 1;
    else if (strategy === "overdue") weights[n] = (stats.gap[n] || 0) + 1;
    else weights[n] = 1;
  }
  return weightedSample(weights, min, max, pick);
}

// ─── 架空サンプル（実在の当選番号ではありません）──────────
export function makeSample(spec, count = 60) {
  const { min, max, pick, bonus } = spec;
  const rnd = makePrng(spec.max * 7 + spec.pick);
  const draws = [];
  for (let i = 0; i < count; i++) {
    const pool = [];
    for (let n = min; n <= max; n++) pool.push(n);
    const take = (k) => {
      const out = [];
      for (let p = 0; p < k; p++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
      return out.sort((a, b) => a - b);
    };
    const numbers = take(pick);
    const bns = take(bonus);
    draws.push({ round: `S${i + 1}`, date: SAMPLE_DATE, numbers, bonus: bns });
  }
  return draws;
}

export const isSample = (draws) => draws.length > 0 && draws[0]?.date === SAMPLE_DATE;
