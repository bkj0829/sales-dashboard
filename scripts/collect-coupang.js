/**
 * 쿠팡 단독 수집 (self-hosted runner 용)
 * 본인 PC 의 한국 IP 에서만 동작 (쿠팡 IP 화이트리스트 필요)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectCoupang } from './collectors/coupang.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const TODAY_PATH = path.join(DATA_DIR, 'today.json');

async function main() {
  console.log('[coupang-only] starting...');
  let today;
  try {
    today = JSON.parse(await fs.readFile(TODAY_PATH, 'utf8'));
  } catch {
    today = { date: '', updatedAt: '', dailyGoal: 0, yesterdayTotal: 0, channels: {} };
  }
  today.channels = today.channels || {};

  let entry;
  try {
    const r = await collectCoupang();
    entry = { amount: r.amount || 0, orders: r.orders || 0, status: 'ok' };
    console.log('[coupang] OK', entry);
  } catch (err) {
    console.error('[coupang] failed:', err.message);
    entry = { amount: 0, orders: 0, status: 'error', error: err.message };
  }

  today.channels.coupang = entry;
  today.updatedAt = new Date().toISOString();
  if (!today.date) today.date = new Date(Date.now() + 9*3600*1000).toISOString().slice(0,10);

  await fs.writeFile(TODAY_PATH, JSON.stringify(today, null, 2), 'utf8');
  console.log('Wrote', TODAY_PATH);
}

main().catch(err => { console.error(err); process.exit(1); });
