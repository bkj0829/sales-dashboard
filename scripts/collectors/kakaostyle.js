/**
 * 카카오스타일 (지그재그/패션바이카카오/포스티) 매출 수집기
 * - API: GraphQL @ https://openapi.zigzag.kr/1/graphql
 * - 환경변수: KAKAOSTYLE_ACCESS_KEY, KAKAOSTYLE_SECRET_KEY
 */
const ENDPOINT = 'https://openapi.zigzag.kr/1/graphql';

const ORDERS_QUERY = `
  query OrderListByPeriod($from: DateTime!, $to: DateTime!) {
    order_list(date_from: $from, date_to: $to, status: PAID) {
      total_count
      item_list {
        id
        order_status
        payment_amount
      }
    }
  }
`;

export async function collectKakaostyle({ startISO, endISO }) {
  const env = process.env;
  const accessKey = env.KAKAOSTYLE_ACCESS_KEY;
  const secretKey = env.KAKAOSTYLE_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error('카카오스타일 환경변수 누락 (KAKAOSTYLE_ACCESS_KEY / KAKAOSTYLE_SECRET_KEY)');
  }

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
      variables: { from: startISO, to: endISO },
    }),
  });

  if (!res.ok) {
    throw new Error(`kakaostyle: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`kakaostyle GraphQL: ${JSON.stringify(json.errors)}`);
  }

  const items = json.data?.order_list?.item_list || [];
  let amount = 0;
  items.forEach(o => {
    amount += Number(o.payment_amount || 0);
  });

  return { amount, orders: items.length };
}
