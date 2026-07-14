/*
 * 回号（第○○回）をキーにした二重取込防止マージ。
 *  - 取込済みの回号と同じで数字も同じ → スキップ
 *  - 同じ回号で数字が異なる → conflict（UI側で「上書きしますか？」を確認）
 *  - 未取込の回号 → 新規追加
 */
import { roundKey } from "./text";

// 数字部分が等しいか（round/date の表記揺れは無視）
export function drawsEqual(a, b, spec) {
  if (spec.type === "combination") {
    return sameArr(a.numbers, b.numbers) && sameArr(a.bonus || [], b.bonus || []);
  }
  return sameArr(a.digits, b.digits);
}
const sameArr = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);

/*
 * mergeDraws(existing, incoming, spec)
 *  → { merged, added, skipped, conflicts: [{ key, index, existing, incoming }] }
 * conflicts は未適用のまま返す。UI で確認後 applyMergeResult で確定する。
 */
export function mergeDraws(existing, incoming, spec) {
  const merged = [...existing];
  const idxByKey = new Map();
  existing.forEach((d, i) => {
    const k = roundKey(d.round);
    if (k != null && !idxByKey.has(k)) idxByKey.set(k, i);
  });

  let added = 0, skipped = 0;
  const conflicts = [];
  incoming.forEach((d) => {
    const k = roundKey(d.round);
    const norm = k == null ? d : { ...d, round: k };
    if (k == null || !idxByKey.has(k)) {
      if (k != null) idxByKey.set(k, merged.length);
      merged.push(norm);
      added += 1;
      return;
    }
    const index = idxByKey.get(k);
    if (drawsEqual(merged[index], norm, spec)) skipped += 1;
    else {
      // 同一回号が同ファイル内で複数回衝突した場合は最後の値で上書き候補にする
      const prev = conflicts.findIndex((c) => c.key === k);
      const c = { key: k, index, existing: merged[index], incoming: norm };
      if (prev >= 0) conflicts[prev] = c;
      else conflicts.push(c);
    }
  });
  return { merged, added, skipped, conflicts };
}

/*
 * conflicts を上書き（overwrite=true）またはスキップ（false）して確定。
 *  → { draws（回号昇順）, added, skipped, overwritten }
 */
export function applyMergeResult(result, overwrite) {
  const { merged, conflicts } = result;
  let { added, skipped } = result;
  let overwritten = 0;
  const out = [...merged];
  conflicts.forEach((c) => {
    if (overwrite) { out[c.index] = c.incoming; overwritten += 1; }
    else skipped += 1;
  });
  return { draws: sortByRound(out), added, skipped, overwritten };
}

// 回号昇順ソート（数値化できない回号は末尾・元順維持）
export function sortByRound(draws) {
  return draws
    .map((d, i) => ({ d, i, k: roundKey(d.round) }))
    .sort((a, b) => {
      if (a.k == null && b.k == null) return a.i - b.i;
      if (a.k == null) return 1;
      if (b.k == null) return -1;
      return Number(a.k) - Number(b.k) || a.i - b.i;
    })
    .map((x) => x.d);
}

// 取込済み範囲: { min, max, count } ／ 数値回号が1つもなければ null
export function importedRange(draws) {
  let min = Infinity, max = -Infinity;
  draws.forEach((d) => {
    const k = roundKey(d.round);
    if (k == null) return;
    const n = Number(k);
    if (n < min) min = n;
    if (n > max) max = n;
  });
  if (min === Infinity) return null;
  return { min, max, count: draws.length };
}
