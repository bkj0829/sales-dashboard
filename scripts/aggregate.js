/**
 * 일별/월별/연별 누적 데이터 집계
 * - data/today.json 의 현재 스냅샷을 읽어
 * - data/daily.json 의 오늘 항목을 갱신(없으면 추가)
 * - data/monthly.json, data/yearly.json 의 해당 월/연 항목을 재계산
 *
 * 매일 한국시간 자정 직전에 한 번 돌리거나, today.json이 갱신될 때마다 가볍게 돌릴 수 있습니다.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const CHANNELS = ['cafe24','shopby','musinsa','ably','smartstore','coupang','kakaostyle'];

async function readJSON(p, fallback) {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch { return fallback; }
}

function emptyChannels() {
  return Object.fromEntries(CHANNELS.map(c => [c, 0]));
}

function sumChannels(a, b) {
  const out = {};
  CHANNELS.forEach(c => { out[c] = (a[c] || 0) + (b[c] || 0); });
  return out;
}

function totalOf(channels) { return CHANNELS.reduce((s, c) => s + (channels[c] || 0), 0); }

async function main() {
  const today = await readJSON(path.join(DATA_DIR, 'today.json'));
  if (!today) { console.error('data/today.json 이 없습니다.'); process.exit(1); }
  const date = today.date; // YYYY-MM-DD (KST)
  const ym = date.slice(0, 7);
  const y = date.slice(0, 4);

  const todayChannels = Object.fromEntries(
    CHANNELS.map(c => [c, today.channels?.[c]?.amount || 0])
  );

  // daily.json
  const daily = await readJSON(path.join(DATA_DIR, 'daily.json'), { range: 'daily', series: [] });
  const di = daily.series.findIndex(p => p.date === date);
  const dailyEntry = {
    date,
    label: date.slice(5).replace('-', '/'),
    channels: todayChannels,
    total: totalOf(todayChannels),
  };
  if (di >= 0) daily.series[di] = dailyEntry;
  else daily.series.push(dailyEntry);
  daily.series.sort((a, b) => a.date.localeCompare(b.date));
  // 최근 60일까지만 유지
  daily.series = daily.series.slice(-60);
  await fs.writeFile(path.join(DATA_DIR, 'daily.json'), JSON.stringify(daily, null, 2));

  // monthly.json: 해당 월의 daily 합산으로 재계산
  const monthly = await readJSON(path.join(DATA_DIR, 'monthly.json'), { range: 'monthly', series: [] });
  const monthlyAgg = emptyChannels();
  daily.series
    .filter(p => p.date.startsWith(ym))
    .forEach(p => {
      CHANNELS.forEach(c => { monthlyAgg[c] += p.channels?.[c] || 0; });
    });
  const mi = monthly.series.findIndex(p => p.date === ym);
  const monthlyEntry = { date: ym, label: ym, channels: monthlyAgg, total: totalOf(monthlyAgg) };
  if (mi >= 0) monthly.series[mi] = monthlyEntry;
  else monthly.series.push(monthlyEntry);
  monthly.series.sort((a, b) => a.date.localeCompare(b.date));
  monthly.series = monthly.series.slice(-24);
  await fs.writeFile(path.join(DATA_DIR, 'monthly.json'), JSON.stringify(monthly, null, 2));

  // yearly.json: monthly로부터 합산
  const yearly = await readJSON(path.join(DATA_DIR, 'yearly.json'), { range: 'yearly', series: [] });
  const yearlyAgg = emptyChannels();
  monthly.series
    .filter(p => p.date.startsWith(y))
    .forEach(p => CHANNELS.forEach(c => { yearlyAgg[c] += p.channels?.[c] || 0; }));
  const yi = yearly.series.findIndex(p => p.date === y);
  const yearlyEntry = { date: y, label: `${y}년`, channels: yearlyAgg, total: totalOf(yearlyAgg) };
  if (yi >= 0) yearly.series[yi] = yearlyEntry;
  else yearly.series.push(yearlyEntry);
  yearly.series.sort((a, b) => a.date.localeCompare(b.date));
  yearly.series = yearly.series.slice(-10);
  await fs.writeFile(path.join(DATA_DIR, 'yearly.json'), JSON.stringify(yearly, null, 2));

  console.log('Aggregated:', { date, ym, y });
}

main().catch(err => { console.error(err); process.exit(1); });
