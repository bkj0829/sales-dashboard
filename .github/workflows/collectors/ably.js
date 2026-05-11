/**
 * 에이블리 (Ably) 셀러 매출 수집기 (스켈레톤)
 *
 * 에이블리는 셀러센터 OpenAPI를 별도 신청해 사용합니다.
 * 제공 받은 매뉴얼에 따라 baseURL/엔드포인트/필드명을 맞춰주세요.
 *
 * 일반 패턴:
 *   - Authorization: Bearer <API_KEY>
 *   - GET /seller/v1/orders?startedAt=...&endedAt=...&status=PAID
 *
 * 환경변수: ABLY_API_KEY, ABLY_API_BASE(선택)
 */
export async function collectAbly({ startISO, endISO }) {
  const env = process.env;
  const apiKey = env.ABLY_API_KEY;
  const base = env.ABLY_API_BASE || 'https://api.a-bly.com';
  if (!apiKey) throw new Error('에이블리 ABLY_API_KEY 누락');

  const url = `${base}/seller/v1/orders?startedAt=${encodeURIComponent(startISO)}&endedAt=${encodeURIComponent(endISO)}&status=PAID`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`ably: ${res.status} ${await res.text()}`);
  const json = await res.json();

  const items = json.items || json.data || [];
  let amount = 0, orders = 0;
  items.forEach(o => {
    amount += Number(o.paidAmount ?? o.totalAmount ?? 0);
    orders += 1;
  });
  return { amount, orders, raw: { count: items.length } };
}
