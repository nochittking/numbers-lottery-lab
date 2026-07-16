// RaceEntry Navi フロントエンド
const state = {
  races: [],
  favorites: new Set(JSON.parse(localStorage.getItem('favorites') ?? '[]')),
};

const $ = (sel) => document.querySelector(sel);

// ---------- ユーティリティ ----------

// 表示は常に日本時間（Asia/Tokyo）で統一する
function jstParts(dateStr) {
  const d = dateStr.length === 10 ? new Date(`${dateStr}T00:00:00+09:00`) : new Date(dateStr);
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { y: get('year'), m: get('month'), d: get('day'), wd: get('weekday'), h: Number(get('hour')) % 24, min: get('minute') };
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const p = jstParts(dateStr);
  return `${p.y}/${p.m}/${p.d}(${p.wd})`;
}

function fmtDateTime(isoStr) {
  if (!isoStr) return null;
  const p = jstParts(isoStr);
  const time = p.h !== 0 || p.min !== '00' ? ` ${p.h}:${p.min}` : '';
  return `${p.y}/${p.m}/${p.d}(${p.wd})${time}`;
}

function entryPeriodText(race) {
  if (!race.entryStart && !race.entryEnd) return race.entryNote ?? '未発表';
  const start = race.entryStart ? fmtDateTime(race.entryStart) : '—';
  const end = race.entryEnd ? fmtDateTime(race.entryEnd) : '—';
  return `${start} 〜 ${end}`;
}

function feeText(race) {
  if (race.fee == null) return race.feeNote ?? '—';
  return `${race.fee.toLocaleString('ja-JP')}円`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------- Google カレンダー連携 ----------

// ctz=Asia/Tokyo で解釈されるため、日時文字列はJSTで組み立てる
function gcalStamp(date, { dateOnly = false } = {}) {
  const p = jstParts(date.toISOString());
  const pad = (v) => String(v).padStart(2, '0');
  const ymd = `${p.y}${pad(p.m)}${pad(p.d)}`;
  return dateOnly ? ymd : `${ymd}T${pad(p.h)}${p.min}00`;
}

function gcalDates(isoStr, { allDay = false } = {}) {
  const d = new Date(isoStr);
  if (allDay) {
    const next = new Date(d.getTime() + 864e5);
    return `${gcalStamp(d, { dateOnly: true })}/${gcalStamp(next, { dateOnly: true })}`;
  }
  const end = new Date(d.getTime() + 36e5);
  return `${gcalStamp(d)}/${gcalStamp(end)}`;
}

function gcalUrl({ title, dateIso, allDay, details, location }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: gcalDates(dateIso, { allDay }),
    ctz: 'Asia/Tokyo',
    details: details ?? '',
    location: location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// ---------- お気に入り ----------

function toggleFavorite(id) {
  state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
  localStorage.setItem('favorites', JSON.stringify([...state.favorites]));
  render();
}

function favButton(race) {
  const active = state.favorites.has(race.id);
  return `<button class="fav-btn ${active ? 'active' : ''}" data-fav="${race.id}"
    title="${active ? 'お気に入りから外す' : 'お気に入りに追加'}">⭐</button>`;
}

// ---------- 描画 ----------

function countdownText(race) {
  if (race.status === '受付中') {
    return race.daysToEntryEnd != null
      ? `✅ 受付中｜締切まであと ${race.daysToEntryEnd} 日`
      : '✅ エントリー受付中';
  }
  if (race.status === '受付前' && race.daysToEntryStart != null) {
    return race.daysToEntryStart === 0
      ? '🚀 本日エントリー開始！'
      : `🚀 エントリー開始まであと ${race.daysToEntryStart} 日`;
  }
  return '';
}

function raceCard(race, kind) {
  const unconfirmed = race.dateConfirmed === false ? ' <span class="badge unconfirmed">日程要確認</span>' : '';
  return `
  <div class="card ${kind}" data-race="${race.id}">
    ${favButton(race)}
    <h3>${escapeHtml(race.name)}</h3>
    <p class="meta">📅 ${fmtDate(race.raceDate)}${unconfirmed}　📍 ${escapeHtml(race.prefecture)}</p>
    <p class="meta">🎫 ${escapeHtml(entryPeriodText(race))}</p>
    <p class="meta">💰 ${feeText(race)}　<span class="badge method">${escapeHtml(race.entryMethod ?? '—')}</span></p>
    <p class="countdown">${countdownText(race)}</p>
  </div>`;
}

function renderCards() {
  const open = state.races.filter((r) => r.status === '受付中');
  const upcoming = state.races.filter((r) => r.status === '受付前');
  $('#openCards').innerHTML = open.length
    ? open.map((r) => raceCard(r, 'open')).join('')
    : '<p class="empty">現在エントリー受付中の大会情報はありません。</p>';
  $('#upcomingCards').innerHTML = upcoming.length
    ? upcoming.map((r) => raceCard(r, 'upcoming')).join('')
    : '<p class="empty">エントリー開始待ちの大会情報はありません。</p>';
  $('#upcomingSection').style.display = '';
}

function renderTable() {
  const q = $('#filterQ').value.trim().toLowerCase();
  const pref = $('#filterPref').value;
  const status = $('#filterStatus').value;
  const favOnly = $('#filterFav').checked;

  const rows = state.races.filter((r) => {
    if (pref && r.prefecture !== pref) return false;
    if (status && r.status !== status) return false;
    if (favOnly && !state.favorites.has(r.id)) return false;
    if (q && ![r.name, r.prefecture, r.city, r.note].filter(Boolean).join(' ').toLowerCase().includes(q)) return false;
    return true;
  });

  $('#raceTable tbody').innerHTML = rows.map((r) => `
    <tr data-race="${r.id}">
      <td>${favButton(r)}</td>
      <td class="race-name">${escapeHtml(r.name)}<span class="sub">${escapeHtml(r.events?.join(' / ') ?? '')}</span></td>
      <td class="nowrap">${fmtDate(r.raceDate)}${r.dateConfirmed === false ? ' <span class="badge unconfirmed">要確認</span>' : ''}</td>
      <td class="nowrap">${escapeHtml(r.prefecture)}<span class="sub">${escapeHtml(r.city ?? '')}</span></td>
      <td>${escapeHtml(entryPeriodText(r))}</td>
      <td class="nowrap"><span class="badge method">${escapeHtml(r.entryMethod ?? '—')}</span></td>
      <td class="nowrap">${feeText(r)}</td>
      <td class="nowrap"><span class="badge ${r.status}">${r.status}</span></td>
    </tr>`).join('')
    || '<tr><td colspan="8" class="empty">条件に合う大会がありません。</td></tr>';
}

function render() {
  renderCards();
  renderTable();
}

// ---------- 詳細モーダル ----------

async function openModal(id) {
  const res = await fetch(`/api/races/${id}`);
  if (!res.ok) return;
  const race = await res.json();
  const location = `${race.prefecture} ${race.city ?? ''}`.trim();
  const details = `${race.officialUrl ?? ''}`;

  const calButtons = [];
  if (race.entryStart) {
    calButtons.push(`<a class="btn btn-cal" target="_blank" rel="noopener"
      href="${gcalUrl({ title: `🏁エントリー開始: ${race.name}`, dateIso: race.entryStart, details, location })}">📅 Googleカレンダー: エントリー開始日</a>`);
  }
  if (race.entryEnd) {
    calButtons.push(`<a class="btn btn-cal" target="_blank" rel="noopener"
      href="${gcalUrl({ title: `⏰エントリー締切: ${race.name}`, dateIso: race.entryEnd, details, location })}">📅 Googleカレンダー: 締切日</a>`);
  }
  if (race.raceDate) {
    calButtons.push(`<a class="btn btn-cal" target="_blank" rel="noopener"
      href="${gcalUrl({ title: `🏃大会当日: ${race.name}`, dateIso: `${race.raceDate}T00:00:00+09:00`, allDay: true, details, location })}">📅 Googleカレンダー: 大会当日</a>`);
  }

  const plan = (race.trainingPlan ?? []).map((m) =>
    `<li><span class="plan-date">${fmtDate(m.date)}</span>${escapeHtml(m.title)}<span class="sub">${escapeHtml(m.detail)}</span></li>`).join('');

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(race.name + ' エントリー')}`;

  $('#modalContent').innerHTML = `
    <h3>${escapeHtml(race.name)} <span class="badge ${race.status}">${race.status}</span></h3>
    <dl class="detail-grid">
      <dt>開催日</dt><dd>${fmtDate(race.raceDate)}${race.dateConfirmed === false ? ' <span class="badge unconfirmed">要確認</span>' : ''}</dd>
      <dt>開催地</dt><dd>${escapeHtml(location)}</dd>
      <dt>種目</dt><dd>${escapeHtml(race.events?.join(' / ') ?? '—')}</dd>
      <dt>エントリー期間</dt><dd>${escapeHtml(entryPeriodText(race))}</dd>
      <dt>方式</dt><dd>${escapeHtml(race.entryMethod ?? '—')}</dd>
      <dt>参加費</dt><dd>${feeText(race)}${race.fee != null && race.feeNote ? `（${escapeHtml(race.feeNote)}）` : ''}</dd>
      <dt>定員</dt><dd>${race.capacity ? race.capacity.toLocaleString('ja-JP') + '人' : '—'}</dd>
      <dt>制限時間</dt><dd>${escapeHtml(race.timeLimit ?? '—')}</dd>
      <dt>公式サイト</dt><dd>${race.officialUrl
        ? `<a href="${race.officialUrl}" target="_blank" rel="noopener">${race.officialUrl}</a>`
        : `<a href="${searchUrl}" target="_blank" rel="noopener">Googleで検索</a>`}</dd>
    </dl>
    ${race.note ? `<div class="note-box">💡 ${escapeHtml(race.note)}</div>` : ''}

    <h4>🔔 リマインダー登録</h4>
    <div class="cal-actions">
      ${calButtons.join('') || '<p class="empty">日程未発表のためカレンダー登録できる予定がありません。公式発表をお待ちください。</p>'}
      <a class="btn btn-primary" href="/api/ics?ids=${race.id}" download>⬇️ .ics ダウンロード（通知アラーム付き）</a>
      <a class="btn btn-secondary" href="/api/ics?ids=${race.id}&training=1" download>⬇️ .ics + 逆算トレーニング予定</a>
    </div>
    <p class="sub" style="color:#6c757d;font-size:0.78rem">.ics は Google / Apple / Outlook カレンダーで読み込めます。エントリー開始の前日と1時間前、締切の3日前と前日にアラームが鳴ります。</p>

    ${plan ? `<h4>🗓 レースまでの逆算スケジュール</h4><ul class="plan-list">${plan}</ul>` : ''}
  `;
  $('#modal').classList.remove('hidden');
}

function closeModal() {
  $('#modal').classList.add('hidden');
}

// ---------- 初期化 ----------

async function load() {
  const res = await fetch('/api/races');
  const data = await res.json();
  state.races = data.races;

  const source = data.updatedFrom ? 'Webフィードから更新' : '同梱データ';
  $('#dataMeta').textContent = `データ基準日: ${data.generatedAt}（${source}）｜掲載 ${data.count} 大会`;

  const prefs = [...new Set(state.races.map((r) => r.prefecture))];
  $('#filterPref').innerHTML = '<option value="">都道府県: すべて</option>'
    + prefs.map((p) => `<option>${p}</option>`).join('');

  render();
}

document.addEventListener('click', (e) => {
  const favBtn = e.target.closest('[data-fav]');
  if (favBtn) {
    e.stopPropagation();
    toggleFavorite(favBtn.dataset.fav);
    return;
  }
  const raceEl = e.target.closest('[data-race]');
  if (raceEl) openModal(raceEl.dataset.race);
  if (e.target.closest('.modal-close') || e.target.classList.contains('modal-backdrop')) closeModal();
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

for (const id of ['filterQ', 'filterPref', 'filterStatus', 'filterFav']) {
  $(`#${id}`).addEventListener('input', renderTable);
}

$('#icsAllBtn').addEventListener('click', () => {
  if (state.favorites.size === 0) {
    alert('⭐ を押してお気に入りの大会を選んでから、一括カレンダー登録をお使いください。');
    return;
  }
  location.href = `/api/ics?ids=${[...state.favorites].join(',')}`;
});

load();
