// 大会当日から逆算したトレーニング・準備マイルストーン

const MILESTONES = [
  { offsetDays: -112, title: 'トレーニング開始（16週前）', detail: 'ベース作り開始。週3〜4回のジョグで走る習慣を整える。' },
  { offsetDays: -84, title: '走り込み期（12週前）', detail: '月間走行距離を段階的に増やす。週末はロング走（20km前後）。' },
  { offsetDays: -56, title: 'ハーフ距離の確認（8週前）', detail: 'ハーフマラソンのレースまたはペース走で現状の走力を確認。' },
  { offsetDays: -28, title: '30km走（4週前）', detail: '本番想定ペースで30km走。補給・シューズも本番仕様で試す。' },
  { offsetDays: -14, title: 'テーパリング開始（2週前）', detail: '走行量を落として疲労抜き。睡眠と栄養を優先。' },
  { offsetDays: -7, title: '最終調整（1週前）', detail: '短めの刺激走のみ。持ち物・交通・宿泊の最終確認。' },
  { offsetDays: -1, title: '前日準備', detail: '受付（前日受付の大会）・ゼッケン確認・カーボローディング・早めの就寝。' },
];

/**
 * raceDate (YYYY-MM-DD) から逆算したマイルストーン一覧を返す。
 * 過去日になったものは includePast=false なら除外。
 */
export function buildTrainingPlan(raceDateStr, { now = new Date(), includePast = true } = {}) {
  // 日付演算はUTC正午基準で行い、タイムゾーンによる日付ズレを防ぐ
  const raceDate = new Date(`${raceDateStr}T12:00:00Z`);
  if (Number.isNaN(raceDate.getTime())) return [];

  return MILESTONES.map((m) => {
    const date = new Date(raceDate.getTime() + m.offsetDays * 24 * 60 * 60 * 1000);
    return { ...m, date: date.toISOString().slice(0, 10) };
  }).filter((m) => includePast || new Date(`${m.date}T23:59:59+09:00`) >= now);
}
