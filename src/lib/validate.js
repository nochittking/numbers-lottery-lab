/*
 * 抽せんレコードの仕様バリデーションと、編集フォーム入力の組み立て。
 * 各くじの仕様（範囲・個数・重複禁止など）は spec（games/registry.js）駆動。
 */
import { toHalfWidth, roundKey } from "./text";

// draw を spec に照らして検証。問題なければ []、あればエラーメッセージ配列。
export function validateDraw(draw, spec) {
  const errors = [];
  if (roundKey(draw.round) == null) errors.push("回号は数字で入力してください");

  if (spec.type === "combination") {
    const { min, max, pick, bonus } = spec;
    const nums = draw.numbers || [];
    const bns = draw.bonus || [];
    if (nums.length !== pick) errors.push(`本数字は ${pick} 個必要です`);
    if (!nums.every((n) => Number.isInteger(n) && n >= min && n <= max)) {
      errors.push(`本数字は ${min}〜${max} の整数で入力してください`);
    }
    if (new Set(nums).size !== nums.length) errors.push("本数字が重複しています");
    if (bns.length > bonus) errors.push(`ボーナス数字は最大 ${bonus} 個です`);
    if (!bns.every((n) => Number.isInteger(n) && n >= min && n <= max)) {
      errors.push(`ボーナス数字は ${min}〜${max} の整数で入力してください`);
    }
    if (new Set([...nums, ...bns]).size !== nums.length + bns.length) {
      errors.push("本数字とボーナス数字が重複しています");
    }
  } else {
    const { digits } = spec;
    const arr = draw.digits || [];
    if (arr.length !== digits || !arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 9)) {
      errors.push(`当せん番号は 0〜9 の ${digits} 桁で入力してください`);
    }
  }
  return errors;
}

/*
 * 編集フォームの文字列入力から draw を組み立てて検証する。
 * fields: { round, date, numbers, bonus }（桁型は numbers に当せん番号）
 *  → { draw, errors }
 */
export function buildDraw(fields, spec) {
  const round = toHalfWidth(fields.round || "").trim();
  const date = toHalfWidth(fields.date || "").trim().slice(0, 12);

  let draw;
  if (spec.type === "combination") {
    draw = {
      round, date,
      numbers: parseIntList(fields.numbers).sort((a, b) => a - b),
      bonus: parseIntList(fields.bonus).sort((a, b) => a - b),
    };
  } else {
    const t = toHalfWidth(fields.numbers || "").replace(/[,\s]/g, "");
    draw = {
      round, date,
      digits: /^\d+$/.test(t) ? t.split("").map(Number) : [],
    };
  }
  return { draw, errors: validateDraw(draw, spec) };
}

function parseIntList(s) {
  return toHalfWidth(s || "")
    .split(/[,、\s]+/)
    .filter(Boolean)
    .map((t) => (/^\d+$/.test(t) ? Number(t) : NaN));
}

// 表示用: 本数字（＋ボーナス）／当せん番号の文字列化
export function drawNumbersText(draw, spec) {
  if (spec.type === "combination") {
    const main = (draw.numbers || []).join(" ");
    const b = draw.bonus && draw.bonus.length ? ` (${draw.bonus.join(" ")})` : "";
    return main + b;
  }
  return (draw.digits || []).join("");
}
