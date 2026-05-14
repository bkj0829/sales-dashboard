/**
 * 카카오스타일 (지그재그/패션바이카카오/포스티) 매출 수집기
 * 
 * API: GraphQL @ https://openapi.zigzag.kr/1/graphql
 * 스키마: https://zigzag.kr/_openapi/openapi.graphql
 *
 * 쿼리: order_item_list
 *  - date_paid_ymd_from / date_paid_ymd_to (Int yyyymmdd 형식)
 *  - 결제완료된 상품주문 목록 반환
 *  - total_amount 합산 = 매출
 *  - CANCEL* 상태 제외
 *
 * 환경변수: KAKAOSTYLE_ACCESS_KEY, KAKAOSTYLE_SECRET_KEY
 */

const ENDPOINT = 'https://openapi.zigzag.kr/1/graphql';

const ORDERS_QUERY = `
  query OrdersByPaidDate($from: Int!, $to: Int!, $limit: Int!, $skip: Int!) {
    order_item_list(
      date_paid_ymd_from: $from
      date_paid_ymd_to: $to
      limit_count: $limit
      skip_count: $skip
    ) {
      total_count
      item_list {
        id
        total_amount
        quantity
        status
      }
    }
  }
`;

export async function collectKakaostyle() {
  const env = process.env;
  const accessKey = env.KAKAOSTYLE_ACCESS_KEY;
  const secretKey = env.KAKAOSTYLE_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error('카카오스타일 환경변수 누락 (KAKAOSTYLE_ACCESS_KEY / KAKAOSTYLE_SECRET_KEY)');
  }

  // KST 기준 오늘 날짜를 yyyymmdd 정수로 (예: 20260511)
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const yyyy = kstNow.getUTCFullYear();
  const mm = String(kstNow.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kstNow.getUTCDate()).padStart(2, '0');
  const todayYmd = parseInt(`${yyyy}${mm}${dd}`, 10);

  let amount = 0;
  let orders = 0;
  let skip = 0;
  const limit = 500;

  while (true) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-solution': 'zigzag',
        'x-access-token': accessKey,
        'x-secret-key': secretKey,
      },
      body: JSON.stringify({
        query: ORDERS_QUERY,
        variables: { from: todayYmd, to: todayYmd, limit, skip },
      }),
    });

    if (!res.ok) {
      throw new Error(`kakaostyle: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(`kakaostyle GraphQL: ${JSON.stringify(json.errors)}`);
    }

    const result = json.data?.order_item_list;
    const items = result?.item_list || [];
    const totalCount = result?.total_count || 0;

    items.forEach(o => {
      const status = String(o.status || '');
      // 취소 관련 상태 제외 (CANCELLED, CANCELLING, CANCEL_DEFERRED 등)
      if (status.startsWith('CANCEL')) return;
      amount += Number(o.total_amount || 0);
      orders += 1;
    });

    skip += items.length;
    if (items.length === 0 || items.length < limit || skip >= totalCount) break;
    if (skip > 5000) break; // 안전장치
  }

  return { amount, orders };
}
