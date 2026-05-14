/**
 * 카카오스타일 인증 패턴 자동 디스커버리 collector
 * 한 번 실행으로 5가지 흔한 인증 헤더 패턴을 차례로 시도하고
 * 통과한 패턴을 결과 메시지에 적어줌. 동시에 매출도 받음.
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
      item_list { id total_amount quantity status }
    }
  }
`;

function buildAuthVariants(accessKey, secretKey) {
  const basic = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');
  return [
    { label: 'Bearer access',                headers: { 'Authorization': `Bearer ${accessKey}` } },
    { label: 'Bearer access:secret',         headers: { 'Authorization': `Bearer ${accessKey}:${secretKey}` } },
    { label: 'Basic base64(access:secret)',  headers: { 'Authorization': `Basic ${basic}` } },
    { label: 'x-access-token + x-secret-key', headers: { 'x-access-token': accessKey, 'x-secret-key': secretKey } },
    { label: 'access-key + secret-key',      headers: { 'access-key': accessKey, 'secret-key': secretKey } },
    { label: 'x-zigzag-access + x-zigzag-secret', headers: { 'x-zigzag-access-key': accessKey, 'x-zigzag-secret-key': secretKey } },
    { label: 'X-Access-Key + X-Secret-Key (대문자)', headers: { 'X-Access-Key': accessKey, 'X-Secret-Key': secretKey } },
  ];
}

async function tryOnePattern({ headers, todayYmd }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-solution': 'zigzag',
      ...headers,
    },
    body: JSON.stringify({
      query: ORDERS_QUERY,
      variables: { from: todayYmd, to: todayYmd, limit: 500, skip: 0 },
    }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  if (!res.ok) return { ok: false, reason: `${res.status} ${text.slice(0,120)}` };
  if (json?.errors) {
    const msg = json.errors[0]?.message || '';
    if (/authenticated_failed|unauthorized|forbidden|invalid token/i.test(msg)) {
      return { ok: false, reason: `auth-fail: ${msg}` };
    }
    return { ok: false, reason: `graphql-error: ${msg}` };
  }
  return { ok: true, data: json.data?.order_item_list };
}

export async function collectKakaostyle() {
  const env = process.env;
  const accessKey = env.KAKAOSTYLE_ACCESS_KEY;
  const secretKey = env.KAKAOSTYLE_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error('카카오스타일 환경변수 누락 (KAKAOSTYLE_ACCESS_KEY / KAKAOSTYLE_SECRET_KEY)');
  }

  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayYmd = parseInt(
    `${kstNow.getUTCFullYear()}${String(kstNow.getUTCMonth()+1).padStart(2,'0')}${String(kstNow.getUTCDate()).padStart(2,'0')}`,
    10
  );

  const variants = buildAuthVariants(accessKey, secretKey);
  const triedResults = [];

  for (const v of variants) {
    const r = await tryOnePattern({ headers: v.headers, todayYmd });
    triedResults.push(`${v.label} → ${r.ok ? '✓ 성공!' : r.reason.slice(0,80)}`);
    if (r.ok) {
      const items = r.data?.item_list || [];
      let amount = 0, orders = 0;
      items.forEach(o => {
        const s = String(o.status || '');
        if (s.startsWith('CANCEL')) return;
        amount += Number(o.total_amount || 0);
        orders += 1;
      });
      console.log(`[kakaostyle] 인증 통과 패턴: ${v.label}`);
      console.log(`[kakaostyle] 시도 결과:\n${triedResults.join('\n')}`);
      return { amount, orders };
    }
  }

  // 다 실패하면 모든 시도 결과를 에러 메시지에 담아 진단 패널로 보냄
  throw new Error(`[디스커버리] 모든 인증 패턴 실패:\n${triedResults.join('\n')}\n\n→ docs 의 *Authentication* 섹션에서 실제 헤더 이름 확인 필요`);
}
