/**
 * Self-hosted runner 전용 수집기
 *
 * IP 화이트리스트가 걸린 채널 (스마트스토어, 쿠팡)을 한꺼번에 수집.
 * 본인 PC 의 한국 IP 가 각 플랫폼에 등록되어 있어야 동작.
 *
 * - data/today.json 의 해당 채널들만 갱신
 * - 다른 채널 (cafe24 등) 데이터는 그대로 유지
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSmartstore } from './collectors/smartstore.js';
import { collectCoupang } from './collectors/coupang.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TODAY_PATH = path.join(DATA_DIR, 'today.json');

// IP 화이트리스트가 필요한 채널만
const RESTRICTED_CHANNELS = [
  ['smartstore', collectSmartstore],
  ['coupang',    collectCoupang],
];

function todayRangeKST() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 0, 0, 0));
  start.setUTCHours(start.getUTCHours() - 9);
  return { startISO: start.toISOString(), endISO: now.toISOString(), dateKST: kstNow.toISOString().slice(0, 10) };
}

async function safeRun(name, fn, range) {
  try {
    const r = await fn(range);
    return [name, { amount: r.amount || 0, orders: r.orders || 0, status: 'ok' }];
  } catch (err) {
    console.error(`[${name}] failed:`, err.message);
    return [name, { amount: 0, orders: 0, status: 'error', error: err.message }];
  }
}

async function main() {
  const range = todayRangeKST();
  console.log('[self-hosted] collecting restricted channels for', range);

  // 기존 today.json 읽기 (없으면 빈 구조)
  let today;
  try {
    today = JSON.parse(await fs.readFile(TODAY_PATH, 'utf8'));
  } catch {
    today = {
      date: range.dateKST,
      updatedAt: new Date().toISOString(),
      dailyGoal: 0,
      yesterdayTotal: 0,
      channels: {},
    };
  }
  today.channels = today.channels || {};

  // 제약 채널만 호출하고 그 결과로 덮어쓰기
  const results = await Promise.all(
    RESTRICTED_CHANNELS.map(([name, fn]) => safeRun(name, fn, range))
  );
  results.forEach(([name, entry]) => {
    today.channels[name] = entry;
    console.log(`[${name}]`, entry.status === 'ok' ? 'OK' : 'ERROR', entry);
  });

  today.updatedAt = new Date().toISOString();
  if (!today.date) today.date = range.dateKST;

  await fs.writeFile(TODAY_PATH, JSON.stringify(today, null, 2), 'utf8');
  console.log('Wrote', TODAY_PATH);
}

main().catch(err => { console.error(err); process.exit(1); });
