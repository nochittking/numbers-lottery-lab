/*
 * DataPanel（取込・二重取込防止・管理画面）のUIテスト。
 */
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DataPanel from "./DataPanel";
import { GAMES } from "../games/registry";
import { makeSample } from "../engine/combination";

function Harness({ spec, initial }) {
  const [draws, setDraws] = useState(initial);
  return <DataPanel spec={spec} draws={draws} onChange={setDraws} />;
}

const spec = GAMES.loto6;
const openPanel = () => fireEvent.click(screen.getByText("開く"));
const goTab = (label) => fireEvent.click(screen.getByText(label));
const pasteAndImport = (text) => {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  fireEvent.click(screen.getByText("取り込む（重複は自動スキップ）"));
};

const ROW1 = "1, 2023-01-05, 1, 2, 3, 4, 5, 6, 7";
const ROW2 = "2, 2023-01-12, 10, 11, 12, 13, 14, 15, 16";

test("text import replaces sample, shows result counts and imported range", () => {
  render(<Harness spec={spec} initial={makeSample(spec)} />);
  expect(screen.getByText(/架空のサンプル/)).toBeInTheDocument();

  openPanel();
  pasteAndImport(`${ROW1}\n${ROW2}`);

  expect(screen.getByText(/新規 2 件・スキップ 0 件・上書き 0 件/)).toBeInTheDocument();
  expect(screen.getByText("取込済み: 第1回〜第2回（計2件）")).toBeInTheDocument();
});

test("re-importing the same rounds skips them", () => {
  render(<Harness spec={spec} initial={makeSample(spec)} />);
  openPanel();
  pasteAndImport(ROW1);
  pasteAndImport(ROW1);
  expect(screen.getByText(/新規 0 件・スキップ 1 件・上書き 0 件/)).toBeInTheDocument();
});

test("conflicting round asks for confirmation and overwrites on approval", () => {
  render(<Harness spec={spec} initial={makeSample(spec)} />);
  openPanel();
  pasteAndImport(ROW1);
  pasteAndImport("1, 2023-01-05, 21, 22, 23, 24, 25, 26, 27"); // 同回号・数字違い

  expect(screen.getByText(/上書きしますか？/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("上書きして取り込む"));
  expect(screen.getByText(/新規 0 件・スキップ 0 件・上書き 1 件/)).toBeInTheDocument();

  goTab("🗂 一覧・編集");
  expect(screen.getByText("21 22 23 24 25 26 (27)")).toBeInTheDocument();
});

test("CSV file import decodes Shift_JIS mizuho-style rows", async () => {
  render(<Harness spec={spec} initial={makeSample(spec)} />);
  openPanel();
  goTab("📄 CSV");

  // "第1回,平成12年10月5日,02,08,10,13,27,30,39,(43)\n" の Shift_JIS バイト列
  const sjis = new Uint8Array([
    145, 230, 49, 137, 241, 44, 149, 189, 144, 172, 49, 50, 148, 78, 49, 48,
    140, 142, 53, 147, 250, 44, 48, 50, 44, 48, 56, 44, 49, 48, 44, 49, 51,
    44, 50, 55, 44, 51, 48, 44, 51, 57, 44, 40, 52, 51, 41, 10,
  ]);
  const fakeFile = {
    name: "loto6.csv",
    type: "text/csv",
    arrayBuffer: async () => sjis.buffer,
  };
  fireEvent.change(screen.getByTestId("file-input"), { target: { files: [fakeFile] } });

  await waitFor(() =>
    expect(screen.getByText(/新規 1 件・スキップ 0 件・上書き 0 件/)).toBeInTheDocument()
  );
  expect(screen.getByText("取込済み: 第1回〜第1回（計1件）")).toBeInTheDocument();
});

test("manage tab edits a row with validation and deletes rows", () => {
  render(<Harness spec={spec} initial={makeSample(spec)} />);
  openPanel();
  pasteAndImport(`${ROW1}\n${ROW2}`);
  goTab("🗂 一覧・編集");

  // 編集: 範囲外の数字はエラー、修正すれば保存できる
  fireEvent.click(screen.getAllByTitle("編集")[0]); // 新しい順なので第2回
  const numbersInput = screen.getByDisplayValue("10 11 12 13 14 15");
  fireEvent.change(numbersInput, { target: { value: "10 11 12 13 14 99" } });
  fireEvent.click(screen.getByText("保存"));
  expect(screen.getByText(/1〜43/)).toBeInTheDocument();

  fireEvent.change(numbersInput, { target: { value: "10 11 12 13 14 43" } });
  fireEvent.click(screen.getByText("保存"));
  expect(screen.getByText(/第2回を更新しました/)).toBeInTheDocument();
  expect(screen.getByText("10 11 12 13 14 43 (16)")).toBeInTheDocument();

  // 削除
  fireEvent.click(screen.getAllByTitle("削除")[0]);
  expect(screen.getByText("取込済み: 第1回〜第1回（計1件）")).toBeInTheDocument();

  // 全削除（サンプルに戻す）
  jest.spyOn(window, "confirm").mockReturnValue(true);
  fireEvent.click(screen.getByText("全削除（サンプルに戻す）"));
  expect(screen.getByText(/※ 現在は架空のサンプル/)).toBeInTheDocument();
  window.confirm.mockRestore();
});

test("digits game imports and lists numbers with leading zeros", () => {
  render(<Harness spec={GAMES.numbers3} initial={[]} />);
  openPanel();
  pasteAndImport("6001, 2022-07-01, 047");
  expect(screen.getByText(/新規 1 件/)).toBeInTheDocument();
  goTab("🗂 一覧・編集");
  expect(screen.getByText("047")).toBeInTheDocument();
});
