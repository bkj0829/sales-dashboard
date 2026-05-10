/**
 * 샵바이(Shopby / NHN Commerce) 매출 수집기
 *
 * 발급 위치 (어드민): 설정 → 외부 서비스 설정 → 외부 API 연동 정보
 *   - mallId  (쇼핑몰 식별값)
 *   - clientId (개발연동정보에서 발급)
 *   - 외부 API 연동 Key (= 우리는 이를 SHOPBY_CLIENT_SECRET 으로 저장)
 *
 * 호출 규칙
 *   - 모든 요청 헤더에 mallId / clientId / Version: 1.0 필수
 *   - 인증 헤더: AccessToken: {외부API연동Key}
 *   - 서버 API 베이스: https://server-api.e-ncp.com
 *   - 주문 조회:  GET /pro/orders?startYmd=YYYY-MM-DD&endYmd=YYYY-MM-DD&orderStatusType=PAY_DONE
 *
 * 환경변수: SHOPBY_MALL_ID, SHOPBY_CLIENT_ID, SHOPBY_CLIENT_SECRET
 */
const BASE = 'https://server-api.e-ncp.com';

export async function collectShopby({ dateKST }) {
  const env = process.env;
  const mallId = env.SHOPBY_MALL_ID;
  const clientId = env.SHOPBY_CLIENT_ID;
  const apiKey = env.SHOPBY_CLIENT_SECRET; // 외부 API 연동 Key
  if (!mallId || !clientId || !apiKey) {
    throw new Error('샵바이 환경변수 누락 (SHOPBY_MALL_ID/CLIENT_ID/CLIENT_SECRET)');
  }

  const headers = {
    'Content-Type': 'application/json',
    Version: '1.0',
    mallId,
    clientId,
    AccessToken: apiKey,
  };

  const url = `${BASE}/pro/orders?startYmd=${dateKST}&endYmd=${dateKST}` +
              `&orderStatusType=PAY_DONE&pageSize=200&pageNumber=1`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`shopby orders: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const items = json.items || json.contents || json.orders || [];

  let amount = 0, orders = 0;
  items.forEach(o => {
    amount += Number(o.lastPayAmt ?? o.payAmt ?? o.totalPayAmt ?? o.orderAmt ?? 0);
    orders += 1;
  });
  return { amount, orders };
}
