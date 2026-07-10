import { render, screen } from "@testing-library/react";
import App from "./App";
import { GAMES } from "./games/registry";
import * as combo from "./engine/combination";
import * as digits from "./engine/digits";

test("renders header and game selector", () => {
  render(<App />);
  expect(screen.getByText("数字選択くじ 統計分析")).toBeInTheDocument();
  expect(screen.getByText("ロト7")).toBeInTheDocument();
  expect(screen.getByText("ナンバーズ3")).toBeInTheDocument();
});

describe("combination engine (loto7)", () => {
  const spec = GAMES.loto7;

  test("sample draws respect the spec", () => {
    const sample = combo.makeSample(spec, 30);
    expect(sample).toHaveLength(30);
    sample.forEach((d) => {
      expect(d.numbers).toHaveLength(spec.pick);
      expect(new Set(d.numbers).size).toBe(spec.pick); // 重複なし
      d.numbers.forEach((n) => expect(n).toBeGreaterThanOrEqual(spec.min));
      d.numbers.forEach((n) => expect(n).toBeLessThanOrEqual(spec.max));
    });
  });

  test("generatePrediction returns pick distinct in-range numbers", () => {
    const stats = combo.computeStats(combo.makeSample(spec, 40), spec);
    ["uniform", "hot", "overdue"].forEach((strat) => {
      const p = combo.generatePrediction(strat, stats, spec);
      expect(p).toHaveLength(spec.pick);
      expect(new Set(p).size).toBe(spec.pick);
      p.forEach((n) => { expect(n).toBeGreaterThanOrEqual(spec.min); expect(n).toBeLessThanOrEqual(spec.max); });
    });
  });

  test("parseDraws validates range and rejects bad rows", () => {
    const text = [
      "500, 2023-01-06, 3, 9, 12, 18, 25, 30, 36, 7, 21", // ok
      "501, 2023-01-13, 1, 5, 14, 20, 22, 31, 99, 2, 19", // 99 は範囲外
      "502, 2023-01-20, 1, 1, 2, 3, 4, 5, 6, 7, 8",       // 重複
    ].join("\n");
    const { draws, errors } = combo.parseDraws(text, spec);
    expect(draws).toHaveLength(1);
    expect(errors.length).toBe(2);
  });
});

describe("digits engine (numbers4)", () => {
  const spec = GAMES.numbers4;

  test("generatePrediction returns correct digit count in 0-9", () => {
    const stats = digits.computeStats(digits.makeSample(spec, 50), spec);
    const p = digits.generatePrediction("hot", stats, spec);
    expect(p).toHaveLength(spec.digits);
    p.forEach((d) => { expect(d).toBeGreaterThanOrEqual(0); expect(d).toBeLessThanOrEqual(9); });
  });

  test("parseDraws accepts joined and rejects wrong length", () => {
    const text = ["1000, 2023-01-06, 1234", "1001, 2023-01-07, 12"].join("\n");
    const { draws, errors } = digits.parseDraws(text, spec);
    expect(draws).toHaveLength(1);
    expect(draws[0].digits).toEqual([1, 2, 3, 4]);
    expect(errors.length).toBe(1);
  });
});
