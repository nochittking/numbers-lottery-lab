/*
 * Tesseract.js によるスクリーンショットOCR。
 *
 * 【重要・外部通信ゼロの担保】
 * Tesseract.js は既定で CDN から worker / コアwasm / 言語データを取得するが、
 * 本アプリは「外部送信ゼロ」が設計方針のため、すべて public/tesseract/ に
 * ローカル同梱したものを参照する（scripts/copy-tesseract-assets.js が
 * node_modules からコピーする）。実行時に外部への通信は一切発生しない。
 *
 * 本体ライブラリも動的 import にして、OCR を使わない限りロードしない。
 */

const BASE = `${process.env.PUBLIC_URL || ""}/tesseract`;

let workerPromise = null;
let currentOnProgress = null; // worker は使い回すため、進捗コールバックだけ差し替える

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import("tesseract.js");
      return createWorker("jpn", OEM.LSTM_ONLY, {
        workerPath: `${BASE}/worker.min.js`, // ローカル同梱 worker
        corePath: BASE,                      // ローカル同梱 wasm コア群
        langPath: `${BASE}/lang`,            // ローカル同梱 jpn.traineddata.gz
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            currentOnProgress?.(m.progress);
          }
        },
      });
    })();
    workerPromise.catch(() => { workerPromise = null; }); // 失敗時は再試行可能に
  }
  return workerPromise;
}

/*
 * 画像（File/Blob）を認識してテキストを返す。
 * onProgress(0..1) で認識の進捗を通知。
 */
export async function recognizeImage(file, onProgress) {
  currentOnProgress = onProgress || null;
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(file);
    return data.text || "";
  } finally {
    currentOnProgress = null;
  }
}
