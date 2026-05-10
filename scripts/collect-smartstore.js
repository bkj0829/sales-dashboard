/**
 * 스마트스토어 전용 수집기 (self-hosted runner 에서만 실행)
 *
 * - data/today.json 의 smartstore 채널만 갱신
 * - 다른 채널 데이터는 그대로 유지 → GitHub-hosted 워크플로우와 충돌 X
 * - 본인 PC 의 한국 IP 가 네이버 화이트리스트에 등록되어 있어야 동작
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSmartstore } from './collectors/smartstore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TODAY_PATH = path.join(DATA_DIR, 'today.json');

function todayRangeKST() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 0, 0, 0));
  start.setUTCHours(start.getUTCHours() - 9);
  return { startISO: start.toISOString(), endISO: now.toISOString(), dateKST: kstNow.toISOString().slice(0, 10) };
}

async function main() {
  const range = todayRangeKST();
  console.log('[smartstore-only] collecting for', range);

  // 기존 today.json 읽기 (없으면 빈 구조 생성)
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

  // smartstore 만 호출
  let entry;
  try {
    const r = await collectSmartstore(range);
    entry = { amount: r.amount || 0, orders: r.orders || 0, status: 'ok' };
    console.log('[smartstore] OK', entry);
  } catch (err) {
    console.error('[smartstore] failed:', err.message);
    entry = { amount: 0, orders: 0, status: 'error', error: err.message };
  }

  today.channels = today.channels || {};
  today.channels.smartstore = entry;
  today.updatedAt = new Date().toISOString();
  if (!today.date) today.date = range.dateKST;

  await fs.writeFile(TODAY_PATH, JSON.stringify(today, null, 2), 'utf8');
  console.log('Wrote', TODAY_PATH);
}

main().catch(err => { console.error(err); process.exit(1); });
