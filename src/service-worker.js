/* eslint-disable no-restricted-globals */
/*
 * PWA用 Service Worker（CRA の InjectManifest モードでビルドされる）。
 *
 * 方針:
 *  - アプリ本体（JS/CSS/HTML/フォント）はビルド時にプリキャッシュ → 完全オフライン動作
 *  - OCRアセット（public/tesseract/ 約9MB）はプリキャッシュせず、初回利用時に
 *    CacheFirst でキャッシュ → 一度OCRを使えば以後オフラインでも使える
 *    （インストール直後に9MBを強制ダウンロードさせないための選択）
 *  - 外部オリジンへのリクエストはそもそも発生しない設計（外部通信ゼロ）
 */
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

clientsClaim();

// ビルド成果物のプリキャッシュ（self.__WB_MANIFEST はビルド時に注入される）
precacheAndRoute(self.__WB_MANIFEST);

// SPA のナビゲーションは index.html を返す（App Shell 方式）
const fileExtensionRegexp = new RegExp("/[^/?]+\\.[^/]+$");
registerRoute(({ request, url }) => {
  if (request.mode !== "navigate") return false;
  if (url.pathname.startsWith("/_")) return false;
  if (url.pathname.match(fileExtensionRegexp)) return false;
  return true;
}, createHandlerBoundToURL(process.env.PUBLIC_URL + "/index.html"));

// OCRアセット（worker/wasmコア/言語データ）: 初回取得時にキャッシュ。
// tesseract.js のバージョンに紐づく静的ファイルなので CacheFirst で問題ない
// （更新時は本SWの更新とともにキャッシュ名の世代交代で入れ替わる）。
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.includes("/tesseract/"),
  new CacheFirst({
    cacheName: "tesseract-assets-v1",
    plugins: [
      new ExpirationPlugin({ maxEntries: 12 }),
    ],
  })
);

// 新しいSWを即時有効化できるようにする（アプリ側から SKIP_WAITING を送れる）
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
