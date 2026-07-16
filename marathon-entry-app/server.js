import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRaces, refreshFromFeed, refreshFromPortals } from './src/store.js';
import { decorateRace, STATUS } from './src/raceStatus.js';
import { buildCalendar } from './src/ics.js';
import { buildTrainingPlan } from './src/trainingPlan.js';
import { getWatchIds, setWatchIds } from './src/watchlist.js';
import { runNotifier, startNotifierSchedule, channelStatus } from './src/notifier/index.js';
import { initWebPush, getPublicKey, addSubscription, removeSubscription } from './src/notifier/channels/webpush.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 大会一覧（status/countdown付き）。?status=受付中&pref=茨城県&q=つくば で絞り込み可
app.get('/api/races', (req, res) => {
  const { generatedAt, updatedFrom } = loadRaces();
  const now = new Date();
  let races = loadRaces().races.map((r) => decorateRace(r, now));

  const { status, pref, q } = req.query;
  if (status) races = races.filter((r) => r.status === status);
  if (pref) races = races.filter((r) => r.prefecture === pref);
  if (q) {
    const needle = String(q).toLowerCase();
    races = races.filter((r) =>
      [r.name, r.prefecture, r.city, r.note].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }

  // 受付中→受付前→未発表→受付終了→開催済み、同ステータス内は開催日順
  const order = [STATUS.OPEN, STATUS.UPCOMING, STATUS.UNKNOWN, STATUS.CLOSED, STATUS.FINISHED];
  races.sort((a, b) => {
    const s = order.indexOf(a.status) - order.indexOf(b.status);
    if (s !== 0) return s;
    return (a.raceDate ?? '9999').localeCompare(b.raceDate ?? '9999');
  });

  res.json({ generatedAt, updatedFrom, count: races.length, races });
});

// 大会詳細 + 逆算トレーニングプラン
app.get('/api/races/:id', (req, res) => {
  const race = loadRaces().races.find((r) => r.id === req.params.id);
  if (!race) return res.status(404).json({ error: 'race not found' });
  const decorated = decorateRace(race);
  decorated.trainingPlan = race.raceDate ? buildTrainingPlan(race.raceDate, { includePast: false }) : [];
  res.json(decorated);
});

// ICSカレンダー出力: /api/ics?ids=tsukuba-2026,kyoto-2027&training=1
app.get('/api/ics', (req, res) => {
  const ids = String(req.query.ids ?? '').split(',').filter(Boolean);
  const all = loadRaces().races;
  const races = ids.length ? all.filter((r) => ids.includes(r.id)) : all;
  if (races.length === 0) return res.status(404).json({ error: 'no races matched' });

  const ics = buildCalendar(races, { includeTraining: req.query.training === '1' });
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="marathon-entry.ics"');
  res.send(ics);
});

// リモートフィード + ポータルサイトから大会データを再取得
app.post('/api/refresh', async (_req, res) => {
  const [feed, portal] = await Promise.all([refreshFromFeed(), refreshFromPortals()]);
  res.json({ feed, portal });
});

// ---------- ウォッチリスト（通知対象のお気に入り） ----------

app.get('/api/watch', (_req, res) => {
  res.json({ ids: getWatchIds() });
});

app.put('/api/watch', (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
  res.json({ ids: setWatchIds(ids) });
});

// ---------- 通知（ブラウザプッシュ / LINE / Discord） ----------

app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({ publicKey: getPublicKey() });
});

app.post('/api/push/subscribe', (req, res) => {
  if (!addSubscription(req.body)) return res.status(400).json({ error: 'invalid subscription' });
  res.json({ ok: true });
});

app.post('/api/push/unsubscribe', (req, res) => {
  if (req.body?.endpoint) removeSubscription(req.body.endpoint);
  res.json({ ok: true });
});

// 通知チャネルの設定状況
app.get('/api/notify/status', (_req, res) => {
  res.json(channelStatus());
});

// リマインドチェックを手動実行（?dry=1 で送信せず計画のみ確認、?now=ISO日時 で基準日を変えて動作確認）
app.post('/api/notify/run', async (req, res) => {
  const now = req.query.now ? new Date(String(req.query.now)) : new Date();
  if (Number.isNaN(now.getTime())) return res.status(400).json({ error: 'invalid now' });
  res.json(await runNotifier({ dryRun: req.query.dry === '1', now }));
});

app.listen(PORT, async () => {
  console.log(`🏃 マラソンエントリー支援アプリ: http://localhost:${PORT}`);
  initWebPush();

  // 起動時にWebから最新データ取得を試みる（失敗時は同梱データで動作）
  const feed = await refreshFromFeed();
  console.log(feed.updated ? `✅ フィードから更新（${feed.count}件）` : `ℹ️ ${feed.reason}`);
  const portal = await refreshFromPortals();
  console.log(portal.updated ? `✅ ポータルから取得（${portal.count}件）` : `ℹ️ ${portal.reason}`);

  // エントリー開始・締切リマインドの定期チェック開始（6時間ごと）
  startNotifierSchedule();
});
