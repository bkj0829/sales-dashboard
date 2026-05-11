/**
 * 카카오스타일 (지그재그/포스티 등 운영) — 셀러 매출 수집기 (스켈레톤)
 *
 * 카카오스타일 파트너 API는 셀러 계약별로 발급되는 API Key/엔드포인트를 사용합니다.
 * 받은 매뉴얼의 엔드포인트/필드명을 맞춰주세요.
 *
 * 일반 패턴:
 *   - Authorization: Bearer <API_KEY>
 *   - GET /partner/v1/orders?from=...&to=...&status=PAID
 *
 * 환경변수: KAKAOSTYLE_API_KEY, KAKAOSTYLE_API_BASE(선택)
 */
export async function collectKakaostyle({ startISO, endISO }) {
  const env = process.env;
  const apiKey = env.KAKAOSTYLE_API_KEY;
  const base = env.KAKAOSTYLE_API_BASE || 'https://api.kakaostyle.com';
  if (!apiKey) throw new Error('카카오스타일 KAKAOSTYLE_API_KEY 누락');

  const url = `${base}/partner/v1/orders?from=${encodeURIComponent(startISO)}&to=${encodeURIComponent(endISO)}&status=PAID`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`kakaostyle: ${res.status} ${await res.text()}`);
  const json = await res.json();

  const items = json.orders || json.data || [];
  let amount = 0, orders = 0;
  items.forEach(o => {
    amount += Number(o.paidAmount ?? o.totalAmount ?? 0);
    orders += 1;
  });
  return { amount, orders, raw: { count: items.length } };
}
