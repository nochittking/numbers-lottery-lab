#!/usr/bin/env node
/*
 * Tesseract.js の worker / wasm コア / 日本語言語データを
 * node_modules から public/tesseract/ にコピーする。
 *
 * Tesseract.js は既定で CDN（jsDelivr 等）から worker・コア・言語データを
 * 取得するが、本アプリは「外部通信ゼロ」が設計方針のため、すべてローカルに
 * 同梱して配信する（src/lib/ocr.js が workerPath/corePath/langPath で
 * ここを参照する）。npm install 後（postinstall）と build 前（prebuild）に
 * 自動実行される。
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const nm = path.join(root, "node_modules");
const dest = path.join(root, "public", "tesseract");

// [コピー元（node_modules 相対）, コピー先（public/tesseract 相対）]
// wasm コアは LSTM_ONLY モード（src/lib/ocr.js）で使う2種（SIMD対応/非対応）のみ。
const FILES = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm", "tesseract-core-simd-lstm.wasm"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-lstm.wasm", "tesseract-core-lstm.wasm"],
  // LSTM用の軽量・高精度データ（best_int）。tesseract.js が lstmOnly 時に
  // 既定CDNで参照するのと同じ系列のデータをローカル同梱する。
  ["@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz", "lang/jpn.traineddata.gz"],
];

let failed = false;
for (const [src, out] of FILES) {
  const from = path.join(nm, src);
  const to = path.join(dest, out);
  if (!fs.existsSync(from)) {
    console.error(`[tesseract-assets] missing: ${from}（npm install を先に実行してください）`);
    failed = true;
    continue;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

if (failed) process.exit(1);
console.log(`[tesseract-assets] copied ${FILES.length} files -> public/tesseract/`);
