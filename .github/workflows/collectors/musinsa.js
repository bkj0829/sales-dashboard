/**
 * 무신사 파트너스 매출 수집기 (스켈레톤)
 *
 * 무신사는 입점 파트너에게 별도 OpenAPI/리포트 다운로드를 제공합니다.
 * (계약 형태에 따라 다름 — 파트너 매니저로부터 받은 엔드포인트/Key 기준으로 수정하세요)
 *
 * 일반적인 패턴:
 *   - Authorization: Bearer <API_KEY>
 *   - GET /partner/v1/sales/daily?date=YYYY-MM-DD
 *
 * 환경변수: MUSINSA_PARTNER_ID, MUSINSA_API_KEY, MUSINSA_API_BASE(선택)
 */
export async function collectMusinsa({ dateKST }) {
  const env = process.env;
  const apiKey = env.MUSINSA_API_KEY;
  const partnerId = env.MUSINSA_PARTNER_ID;
  const base = env.MUSINSA_API_BASE || 'https://api.musinsa.com';
  if (!apiKey || !partnerId) throw new Error('무신사 환경변수 누락');

  const url = `${base}/partner/v1/sales/daily?partnerId=${encodeURIComponent(partnerId)}&date=${dateKST}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`musinsa: ${res.status} ${await res.text()}`);
  const json = await res.json();
  // TODO: 실제 응답 필드명에 맞춰 매핑 (계약별로 상이)
  const amount = Number(json.totalSalesAmount ?? json.totalAmount ?? 0);
  const orders = Number(json.totalOrderCount ?? json.orderCount ?? 0);
  return { amount, orders, raw: json };
}
