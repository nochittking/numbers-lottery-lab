import React from 'react';
import ReactDOM from 'react-dom/client';
// Orbitron フォントをローカル同梱（外部通信ゼロ方針のため Google Fonts は使わない）
import '@fontsource/orbitron/400.css';
import '@fontsource/orbitron/600.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: Service Worker を登録してオフライン動作＆ホーム画面追加に対応。
// アプリ本体はプリキャッシュ、OCRアセット（約9MB）は初回利用時にキャッシュされる。
serviceWorkerRegistration.register();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
