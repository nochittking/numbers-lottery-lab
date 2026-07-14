/*
 * CSV/OCR取り込み・二重取込防止マージ・バリデーションのテスト。
 */
import { GAMES } from "../games/registry";
import { toHalfWidth, roundKey, normalizeDate } from "./text";
import { decodeCsvBuffer, splitCsvLine, parseCsvText, parseOcrText } from "./csv";
import { mergeDraws, applyMergeResult, sortByRound, importedRange, drawsEqual } from "./merge";
import { validateDraw, buildDraw, drawNumbersText } from "./validate";

describe("text utils", () => {
  test("toHalfWidth converts zenkaku digits and symbols", () => {
    expect(toHalfWidth("第１２３回（０７）")).toBe("第123回(07)");
  });
  test("roundKey normalizes round labels", () => {
    expect(roundKey("第123回")).toBe("123");
    expect(roundKey("０４５６")).toBe("456");
    expect(roundKey("S1")).toBe("1");
    expect(roundKey("abc")).toBeNull();
  });
  test("normalizeDate handles western and era formats", () => {
    expect(normalizeDate("2023年1月6日")).toBe("2023-01-06");
    expect(normalizeDate("2023/1/6")).toBe("2023-01-06");
    expect(normalizeDate("令和5年1月6日")).toBe("2023-01-06");
    expect(normalizeDate("平成12年10月5日")).toBe("2000-10-05");
    expect(normalizeDate("12345")).toBeNull();
  });
});

describe("decodeCsvBuffer", () => {
  test("decodes UTF-8", () => {
    const bytes = new TextEncoder().encode("第1回,2023年1月6日,01");
    expect(decodeCsvBuffer(bytes.buffer)).toContain("第1回");
  });
  test("falls back to Shift_JIS when UTF-8 fails", () => {
    // "第1回,平成12年10月5日,02,08,10,13,27,30,39,(43)\n" の Shift_JIS バイト列
    const sjis = new Uint8Array([
      145, 230, 49, 137, 241, 44, 149, 189, 144, 172, 49, 50, 148, 78, 49, 48,
      140, 142, 53, 147, 250, 44, 48, 50, 44, 48, 56, 44, 49, 48, 44, 49, 51,
      44, 50, 55, 44, 51, 48, 44, 51, 57, 44, 40, 52, 51, 41, 10,
    ]);
    const text = decodeCsvBuffer(sjis.buffer);
    expect(text).toContain("第1回");
    expect(text).toContain("平成12年10月5日");
  });
});

describe("splitCsvLine", () => {
  test("handles quoted fields with commas", () => {
    expect(splitCsvLine('"第1回","2億円","200,000,000",02')).toEqual([
      "第1回", "2億円", "200,000,000", "02",
    ]);
  });
});

describe("parseCsvText (combination / loto6)", () => {
  const spec = GAMES.loto6;

  test("parses mizuho-style rows with header, bonus parens, prize columns", () => {
    const csv = [
      "回別,抽せん日,本数字1,本数字2,本数字3,本数字4,本数字5,本数字6,ボーナス数字,1等賞金",
      '第1回,2000年10月5日,02,08,10,13,27,30,(39),"104,000,000円"',
      '第2回,2000年10月12日,01,09,16,20,21,43,(05),"83,638,600円"',
    ].join("\n");
    const { draws, errors } = parseCsvText(csv, spec);
    expect(errors).toEqual([]);
    expect(draws).toHaveLength(2);
    expect(draws[0]).toEqual({
      round: "1", date: "2000-10-05",
      numbers: [2, 8, 10, 13, 27, 30], bonus: [39],
    });
  });

  test("parses era dates and unquoted bonus", () => {
    const csv = "第100回,平成14年5月2日,03,05,17,28,30,43,12";
    const { draws } = parseCsvText(csv, spec);
    expect(draws[0].date).toBe("2002-05-02");
    expect(draws[0].numbers).toEqual([3, 5, 17, 28, 30, 43]);
    expect(draws[0].bonus).toEqual([12]);
  });

  test("also accepts the plain paste format (round, date, numbers)", () => {
    const csv = "500, 2023-01-06 のような行は列不足だが CSV では 500,2023-01-06,3,9,12,18,25,30,7";
    const ok = parseCsvText("500,2023-01-06,3,9,12,18,25,30,7", spec);
    expect(ok.draws[0].numbers).toEqual([3, 9, 12, 18, 25, 30]);
    expect(ok.draws[0].bonus).toEqual([7]);
    expect(csv).toBeTruthy();
  });

  test("reports rows that look like data but are incomplete", () => {
    const { draws, errors } = parseCsvText("第3回,2000年10月19日,01,05,15", spec);
    expect(draws).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("本数字");
  });

  test("silently skips headers and titles", () => {
    const { draws, errors } = parseCsvText("ロト6当せん番号案内\n回別,抽せん日\n", spec);
    expect(draws).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  test("rejects duplicated main numbers", () => {
    const { errors } = parseCsvText("第9回,2020/1/1,01,01,02,03,04,05,06", spec);
    expect(errors[0]).toContain("重複");
  });
});

describe("parseCsvText (digits / numbers3)", () => {
  const spec = GAMES.numbers3;

  test("parses mizuho-style numbers rows with prize columns", () => {
    const csv = [
      "回別,抽せん日,抽せん数字,ストレート,ボックス",
      '第6001回,2022年7月1日,123,"90,000円","15,000円"',
      "第6002回,2022年7月4日,047,該当なし,該当なし",
    ].join("\n");
    const { draws, errors } = parseCsvText(csv, spec);
    expect(errors).toEqual([]);
    expect(draws[0].digits).toEqual([1, 2, 3]);
    expect(draws[1].digits).toEqual([0, 4, 7]); // 先頭ゼロ保持
  });

  test("keeps zenkaku input working", () => {
    const { draws } = parseCsvText("第６００３回,２０２２年７月５日,８９０", spec);
    expect(draws[0]).toEqual({ round: "6003", date: "2022-07-05", digits: [8, 9, 0] });
  });
});

describe("parseOcrText", () => {
  test("parses screenshot-like lines and flags unreadable ones (loto7)", () => {
    const spec = GAMES.loto7;
    const text = [
      "当せん番号一覧",
      "第 512 回 2023年3月3日 03 09 12 18 25 30 36 (07) (21)",
      "第513回 2023年3月10日 O1 05 14 2O 22 31 33 (02) (19)", // O→0 の矯正
      "第514回 2023年3月17日 12 34 ??",
    ].join("\n");
    const rows = parseOcrText(text, spec);
    expect(rows).toHaveLength(3);
    expect(rows[0].draw).toEqual({
      round: "512", date: "2023-03-03",
      numbers: [3, 9, 12, 18, 25, 30, 36], bonus: [7, 21],
    });
    expect(rows[1].draw.numbers).toEqual([1, 5, 14, 20, 22, 31, 33]);
    expect(rows[2].draw).toBeNull();
    expect(rows[2].message).toContain("本数字");
  });

  test("joins OCR-split dates so date digits are not mistaken for numbers", () => {
    const spec = GAMES.loto7;
    const rows = parseOcrText(
      "第 513 回 2023 年 3 月 10 日 01 05 14 20 22 31 33 (02) (19)", spec
    );
    expect(rows[0].draw).toEqual({
      round: "513", date: "2023-03-10",
      numbers: [1, 5, 14, 20, 22, 31, 33], bonus: [2, 19],
    });
  });

  test("parses zenkaku digits lines (numbers4)", () => {
    const rows = parseOcrText("第６１００回 ２０２３年４月１日 １２３４", GAMES.numbers4);
    expect(rows[0].draw.digits).toEqual([1, 2, 3, 4]);
  });
});

describe("mergeDraws / applyMergeResult", () => {
  const spec = GAMES.miniloto;
  const d = (round, nums, bonus = [7]) => ({ round, date: "2023-01-01", numbers: nums, bonus });

  test("adds new rounds, skips identical rounds, detects conflicts", () => {
    const existing = [d("1", [1, 2, 3, 4, 5]), d("2", [2, 3, 4, 5, 6])];
    const incoming = [
      d("第2回", [2, 3, 4, 5, 6]),   // 同一 → スキップ
      d("3", [3, 4, 5, 6, 7], [1]),  // 新規
      d("1", [10, 11, 12, 13, 14]),  // 競合
    ];
    const res = mergeDraws(existing, incoming, spec);
    expect(res.added).toBe(1);
    expect(res.skipped).toBe(1);
    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].key).toBe("1");

    const kept = applyMergeResult(res, false);
    expect(kept.overwritten).toBe(0);
    expect(kept.skipped).toBe(2);
    expect(kept.draws.find((x) => x.round === "1").numbers).toEqual([1, 2, 3, 4, 5]);

    const over = applyMergeResult(res, true);
    expect(over.overwritten).toBe(1);
    expect(over.draws.find((x) => x.round === "1").numbers).toEqual([10, 11, 12, 13, 14]);
  });

  test("dedupes within the same import batch", () => {
    const res = mergeDraws([], [d("5", [1, 2, 3, 4, 5]), d("第5回", [1, 2, 3, 4, 5])], spec);
    expect(res.added).toBe(1);
    expect(res.skipped).toBe(1);
  });

  test("sortByRound orders numerically", () => {
    const sorted = sortByRound([d("10", [1, 2, 3, 4, 5]), d("2", [1, 2, 3, 4, 5])]);
    expect(sorted.map((x) => x.round)).toEqual(["2", "10"]);
  });

  test("importedRange reports min/max/count", () => {
    const r = importedRange([d("3", [1, 2, 3, 4, 5]), d("11", [1, 2, 3, 4, 5])]);
    expect(r).toEqual({ min: 3, max: 11, count: 2 });
    expect(importedRange([])).toBeNull();
  });

  test("drawsEqual compares digits draws", () => {
    const s4 = GAMES.numbers4;
    expect(drawsEqual({ digits: [1, 2, 3, 4] }, { digits: [1, 2, 3, 4] }, s4)).toBe(true);
    expect(drawsEqual({ digits: [1, 2, 3, 4] }, { digits: [1, 2, 3, 5] }, s4)).toBe(false);
  });
});

describe("validateDraw / buildDraw", () => {
  test("combination validation enforces range, count, uniqueness", () => {
    const spec = GAMES.loto6;
    const ok = { round: "1", date: "", numbers: [1, 2, 3, 4, 5, 6], bonus: [7] };
    expect(validateDraw(ok, spec)).toEqual([]);
    expect(validateDraw({ ...ok, numbers: [1, 2, 3, 4, 5, 99] }, spec).join()).toContain("1〜43");
    expect(validateDraw({ ...ok, numbers: [1, 1, 2, 3, 4, 5] }, spec).join()).toContain("重複");
    expect(validateDraw({ ...ok, bonus: [1] }, spec).join()).toContain("重複");
    expect(validateDraw({ ...ok, bonus: [7, 8] }, spec).join()).toContain("最大 1");
    expect(validateDraw({ ...ok, round: "x" }, spec).join()).toContain("回号");
  });

  test("digits validation enforces exact length", () => {
    const spec = GAMES.numbers3;
    expect(validateDraw({ round: "1", digits: [0, 5, 9] }, spec)).toEqual([]);
    expect(validateDraw({ round: "1", digits: [0, 5] }, spec)).toHaveLength(1);
  });

  test("buildDraw assembles combination draw from form strings", () => {
    const spec = GAMES.miniloto;
    const { draw, errors } = buildDraw(
      { round: "第12回", date: "2023年2月1日", numbers: "5, 3 11 20 31", bonus: "8" }, spec
    );
    expect(errors).toEqual([]);
    expect(draw.numbers).toEqual([3, 5, 11, 20, 31]);
    expect(draw.bonus).toEqual([8]);
    expect(drawNumbersText(draw, spec)).toBe("3 5 11 20 31 (8)");
  });

  test("buildDraw assembles digits draw and rejects bad input", () => {
    const spec = GAMES.numbers4;
    const ok = buildDraw({ round: "6100", date: "", numbers: "0123" }, spec);
    expect(ok.errors).toEqual([]);
    expect(ok.draw.digits).toEqual([0, 1, 2, 3]);
    expect(drawNumbersText(ok.draw, spec)).toBe("0123");
    const bad = buildDraw({ round: "6100", date: "", numbers: "12a4" }, spec);
    expect(bad.errors).toHaveLength(1);
  });
});
