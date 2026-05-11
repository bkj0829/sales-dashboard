/**
 * 카페24 (Cafe24) 매출 수집기
 *
 * 인증: OAuth 2.0 (refresh_token으로 access_token 갱신)
 *  - https://{mall_id}.cafe24api.com/api/v2/oauth/token
 *
 * 매출/주문 조회: GET /api/v2/admin/orders?start_date=...&end_date=...
 *  - 응답의 orders[].payment_amount 합계 = 매출, 항목 수 = 주문수
 *  - 페이지네이션은 limit/offset (최대 100)
 *
 * 환경변수:
 *   CAFE24_MALL_ID, CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET, CAFE24_REFRESH_TOKEN
 */

async function refreshAccessToken({ mallId, clientId, clientSecret, refreshToken }) {
  const url = `https://${mallId}.cafe24api.com/api/v2/oauth/token`;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`cafe24 token: ${res.status} ${await res.text()}`);
  return res.json(); // { access_token, refresh_token, ... }
}

export async function collectCafe24({ startISO, endISO, dateKST }) {
  const env = process.env;
  if (!env.CAFE24_MALL_ID || !env.CAFE24_CLIENT_ID || !env.CAFE24_REFRESH_TOKEN) {
    throw new Error('카페24 환경변수 누락 (CAFE24_MALL_ID/CAFE24_CLIENT_ID/CAFE24_REFRESH_TOKEN)');
  }

  const tok = await refreshAccessToken({
    mallId: env.CAFE24_MALL_ID,
    clientId: env.CAFE24_CLIENT_ID,
    clientSecret: env.CAFE24_CLIENT_SECRET,
    refreshToken: env.CAFE24_REFRESH_TOKEN,
  });

  const base = `https://${env.CAFE24_MALL_ID}.cafe24api.com/api/v2/admin/orders`;
  // 카페24는 KST 날짜 문자열을 받습니다.
  const params = new URLSearchParams({
    start_date: dateKST,
    end_date: dateKST,
    limit: '100',
    offset: '0',
  });

  let amount = 0, orders = 0, offset = 0;
  while (true) {
    params.set('offset', String(offset));
    const res = await fetch(`${base}?${params}`, {
      headers: {
        Authorization: `Bearer ${tok.access_token}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': '2024-09-01',
      },
    });
    if (!res.ok) throw new Error(`cafe24 orders: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const list = json.orders || [];
    list.forEach(o => {
      amount += Number(o.payment_amount || o.actual_payment_amount || 0);
      orders += 1;
    });
    if (list.length < 100) break;
    offset += 100;
    if (offset > 5000) break; // 안전장치
  }

  return { amount, orders };
}
