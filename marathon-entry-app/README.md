# 🏃 RaceEntry Navi — マラソン大会エントリー支援アプリ

国内マラソン大会のエントリー情報をまとめてチェックし、**エントリー開始日のうっかり忘れをゼロにする**ためのアプリです。

## できること

- **エントリー可能な大会の自動リストアップ** — アプリを起動すると、その時点で「受付中」「まもなくエントリー開始」の大会をトップに自動表示（残り日数のカウントダウン付き）
- **大会情報の一覧表** — 開催日 / 開催地 / エントリー期間 / 参加費 / 先着・抽選の別 / 制限時間 / 定員を一覧・検索・絞り込み
- **お気に入り登録** — ⭐ で気になる大会をマーク（ブラウザに保存）
- **カレンダー連携でエントリー忘れ防止** 🔔
  - **Googleカレンダーへワンクリック追加**（エントリー開始日・締切日・大会当日）
  - **.ics ダウンロード** — Google / Apple / Outlook どのカレンダーでもOK。エントリー開始の「前日」と「1時間前」、締切の「3日前」と「前日」にアラームが鳴る設定入り
  - お気に入り大会の予定を **一括登録** も可能
- **逆算トレーニングスケジュール** — 大会当日から逆算した練習マイルストーン（16週前ベース作り〜前日準備）を表示し、カレンダーにも登録可能
- **プッシュ通知リマインド** 📲 — ⭐お気に入りの大会について、エントリー開始・締切の **7日前 / 3日前 / 前日 / 当日** に自動通知（6時間ごとにチェック、重複送信なし）
  - **ブラウザ通知（Web Push）** — 画面の「🔔 エントリー開始を通知する」を押すだけ。設定不要（VAPID鍵は自動生成）
  - **LINE通知（Messaging API）** — LINE公式アカウント経由でスマホに届く
  - **Discord通知（Webhook）** — URLを1つ貼るだけの最速セットアップ
- **ポータルサイト連携（実験的）** — 起動時にスポーツエントリーのフルマラソン一覧を取得し、手元にない大会を「スポエン」バッジ付きで自動追加

## 使い方

```bash
cd marathon-entry-app
npm install
npm start        # → http://localhost:3000 をブラウザで開く
```

```bash
npm test         # ユニットテスト（node:test）
npm run dev      # ファイル変更を監視して自動再起動
```

## データについて

- `data/races.json` が大会データ本体です（2026-07-16 時点のWeb調査に基づくシードデータ、全国の主要大会約20件）。
- 開催日・エントリー期間が公式未発表の大会は `dateConfirmed: false` や `entryNote`（例年実績）でマークされ、画面上に **「要確認」** バッジが出ます。**エントリー前に必ず公式サイトで最新情報を確認してください。**

### 起動時のWeb自動更新（リモートフィード）

起動時に最新の大会データをWebから取得できます。`races.json` と同じスキーマのJSONをどこかにホストし、環境変数で指定してください:

```bash
RACES_FEED_URL="https://example.com/races.json" npm start
```

取得結果は `data/races.local.json` に保存され、同梱データより優先されます（取得失敗時は同梱データで動作）。`POST /api/refresh` でいつでも再取得できます。

### ポータルサイト連携（実験的）

起動時と `POST /api/refresh` 時に、スポーツエントリー（sportsentry.ne.jp）のフルマラソン一覧を取得し、シードデータにない大会を自動追加します（`data/portal.local.json` に保存）。

- 取得した大会は一覧に **「スポエン」バッジ** 付きで表示され、リンクからそのままエントリーページへ飛べます
- ⚠️ ポータル側のHTML構造変更で取得できなくなることがあります。その場合もアプリ本体は同梱データで動き続けます。取得できない場合は `src/sources/sportsentry.js` の `parseEventList` のセレクタを調整してください
- RUNNETはログイン・動的レンダリング前提のためスクレイピング対象外としています（検証済みシードデータ＋フィードでカバー）

## 通知リマインドの設定 🔔

⭐お気に入り（＝ウォッチリスト、サーバー側に保存）に入れた大会が対象です。エントリー開始・締切の **7日前 / 3日前 / 前日 / 当日**（JST暦日基準）に通知します。サーバー起動中、6時間ごとにチェックし、送信済みリマインドは `data/notified.local.json` に記録して二重送信を防ぎます。

### 1. ブラウザ通知（設定不要・一番簡単）

アプリ画面ヘッダーの **「🔔 エントリー開始を通知する」** を押して通知を許可するだけ。VAPID鍵は初回起動時に自動生成されます（`data/vapid.local.json`）。

> 注意: PCを閉じているとブラウザ通知は届きません。常時receivedしたい場合はLINE/Discordを併用してください。

### 2. LINE通知

**LINE Notifyは2025年3月末に終了**したため、後継の **LINE Messaging API** を使います。

1. [LINE Developersコンソール](https://developers.line.biz/)で「Messaging API」チャネルを作成（無料）
2. チャネルアクセストークン（長期）を発行
3. 作成したLINE公式アカウントを自分のLINEで友だち追加
4. 環境変数を設定して起動:

```bash
LINE_CHANNEL_ACCESS_TOKEN="（トークン）" npm start
# LINE_TO を省略すると友だち追加した全員へブロードキャスト（個人利用ならこれでOK）
# 特定ユーザーのみに送る場合: LINE_TO="Uxxxxxxxx..."（webhookで取得したuserId）
```

### 3. Discord通知（セットアップ最速）

サーバー設定 → 連携サービス → ウェブフック でURLを発行し:

```bash
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." npm start
```

### 動作確認

```bash
curl -X POST "http://localhost:3000/api/notify/run?dry=1"        # 送信せず計画を確認
curl -X POST "http://localhost:3000/api/notify/run?dry=1&now=2026-07-19T09:00:00%2B09:00"  # 基準日を変えてテスト
curl http://localhost:3000/api/notify/status                     # チャネル設定状況
```

## API

| エンドポイント | 説明 |
|---|---|
| `GET /api/races` | 大会一覧（`status` / 残日数付き）。`?status=受付中&pref=茨城県&q=つくば` で絞り込み |
| `GET /api/races/:id` | 大会詳細 + 逆算トレーニングプラン |
| `GET /api/ics?ids=a,b` | 指定大会のICSカレンダー（`&training=1` で練習予定も含む） |
| `POST /api/refresh` | リモートフィード＋ポータルからデータ再取得 |
| `GET/PUT /api/watch` | 通知対象（お気に入り）大会IDリストの取得・保存 |
| `GET /api/push/vapid-public-key` | Web Push 公開鍵 |
| `POST /api/push/subscribe` `/api/push/unsubscribe` | ブラウザ通知の購読管理 |
| `GET /api/notify/status` | 通知チャネルの設定状況 |
| `POST /api/notify/run` | リマインドチェック手動実行（`?dry=1` `&now=ISO日時`） |

## 構成

```
marathon-entry-app/
├── server.js                 # Express サーバ + API
├── src/
│   ├── raceStatus.js         # 受付中/受付前/締切 の判定・残日数
│   ├── ics.js                # ICSカレンダー生成（VALARM付き）
│   ├── trainingPlan.js       # 大会日から逆算した練習マイルストーン
│   ├── store.js              # データ読込 + フィード/ポータル更新
│   ├── watchlist.js          # 通知対象大会の永続化
│   ├── sources/
│   │   └── sportsentry.js    # ポータル連携（スポーツエントリー）
│   └── notifier/
│       ├── plan.js           # いつ・何を通知するかの計画
│       ├── sentLog.js        # 二重送信防止
│       ├── index.js          # 定期チェック + 配信
│       └── channels/         # webpush / line / discord
├── data/races.json           # 大会シードデータ（*.local.json は自動生成）
├── public/                   # フロントエンド（vanilla JS + Service Worker）
└── tests/                    # node:test ユニットテスト
```

## 今後のアイデア

- [ ] RUNNETなど他ポータルのフェッチャー追加
- [ ] Google Calendar API 連携（OAuth）で自動同期
- [ ] 過去の抽選倍率・定員到達スピードのデータベース化
- [ ] iOSホーム画面追加（PWA manifest）でスマホアプリ化
