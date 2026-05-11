/**
 * 통합 수집 오케스트레이터 (GitHub-hosted runner 용)
 * - 각 채널 collector를 병렬 호출하여 오늘 매출/주문수를 수집
 * - 결과를 data/today.json 으로 기록
 * - 실패 채널은 status를 'error'로 표시
 *
 * 스마트스토어·쿠팡 은 IP 화이트리스트 필요 → self-hosted runner 에서
 * collect-self-hosted.js + collect-smartstore.yml 워크플로우가 따로 처리.
 *
 * 환경 변수: GitHub Secrets에서 주입
 *   CAFE24_MALL_ID, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, CAFE24_REFRESH_TOKEN
 *   MUSINSA_PARTNER_ID, MUSINSA_API_KEY
 *   ABLY_API_KEY
 *   SHOPBY_MALL_ID, SHOPBY_CLIENT_ID, SHOPBY_CLIENT_SECRET
 *   KAKAOSTYLE_API_KEY
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectCafe24 }     from './collectors/cafe24.js';
import { collectShopby }     from './collectors/shopby.js';
import { collectMusinsa }    from './collectors/musinsa.js';
import { collectAbly }       from './collectors/ably.js';
import { collectKakaostyle } from './collectors/kakaostyle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

// GitHub-hosted 러너에서 호출 가능한 채널만 (IP 제약 없는 것들)
const CHANNELS = [
  ['cafe24',     collectCafe24],
  ['shopby',     collectShopby],
  ['musinsa',    collectMusinsa],
  ['ably',       collectAbly],
  ['kakaostyle', collectKakaostyle],
];

async function safeRun(name, fn, range) {
  try {
    const r = await fn(range);
    return [name, { amount: r.amount || 0, orders: r.orders || 0, status: 'ok' }];
  } catch (err) {
    console.error(`[${name}] failed:`, err.message);
    return [name, { amount: 0, orders: 0, status: 'error', error: err.message }];
  }
}

function todayRangeKST() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 0, 0, 0));
  start.setUTCHours(start.getUTCHours() - 9);
  return { startISO: start.toISOString(), endISO: now.toISOString(), dateKST: kstNow.toISOString().slice(0, 10) };
}

async function main() {
  const range = todayRangeKST();
  console.log('Collecting for', range);

  const results = await Promise.all(CHANNELS.map(([name, fn]) => safeRun(name, fn, range)));

  // 어제 합계는 daily.json 마지막 항목에서
  let yesterdayTotal = 0;
  try {
    const daily = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'daily.json'), 'utf8'));
    yesterdayTotal = daily.series.at(-1)?.total ?? 0;
  } catch {}

  // 기존 today.json 을 읽어 self-hosted 가 채운 채널(스마트스토어·쿠팡)은 보존
  let prev = {};
  try {
    prev = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'today.json'), 'utf8'));
  } catch {}
  const channels = { ...(prev.channels || {}) };
  results.forEach(([name, entry]) => { channels[name] = entry; });

  const doc = {
    date: range.dateKST,
    updatedAt: new Date().toISOString(),
    dailyGoal: Number(process.env.DAILY_GOAL_KRW || 0),
    yesterdayTotal,
    channels,
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, 'today.json'), JSON.stringify(doc, null, 2), 'utf8');
  console.log('Wrote data/today.json');
}

main().catch(err => { console.error(err); process.exit(1); });
