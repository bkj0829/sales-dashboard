import bcrypt from 'bcryptjs';

const BASE = 'https://api.commerce.naver.com/external';

async function getAccessToken({ clientId, clientSecret }) {
  const timestamp = Date.now();
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  const sign = Buffer.from(hashed, 'utf8').toString('base64');
  const body = new URLSearchParams({
    client_id: clientId, timestamp: String(timestamp),
    client_secret_sign: sign, grant_type: 'client_credentials', type: 'SELF',
  });
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`smartstore token: ${res.status} ${await res.text()}`);
  return res.json();
}

async function countByType({ accessToken, startISO, endISO, type }) {
  const params = new URLSearchParams({
    lastChangedFrom: startISO,
    lastChangedTo: endISO,
    lastChangedType: type,
  });
  const res = await fetch(`${BASE}/v1/pay-order/seller/product-orders/last-changed-statuses?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    return { type, error: `${res.status} ${(await res.text()).slice(0,80)}` };
  }
  const json = await res.json();
  const list = json.data?.lastChangeStatuses || json.data?.lastChangedStatuses || [];
  return { type, count: list.length, ids: list.slice(0, 3).map(x => x.productOrderId) };
}

export async function collectSmartstore({ startISO, endISO }) {
  const env = process.env;
  if (!env.SMARTSTORE_CLIENT_ID || !env.SMARTSTORE_CLIENT_SECRET) {
    throw new Error('스마트스토어 환경변수 누락 (SMARTSTORE_CLIENT_ID/SECRET)');
  }
  const tok = await getAccessToken({
    clientId: env.SMARTSTORE_CLIENT_ID,
    clientSecret: env.SMARTSTORE_CLIENT_SECRET,
  });

  // 가능한 모든 상태별로 카운트해서 어디 숨었는지 찾기
  const types = ['PAY_WAITING','PAYED','DISPATCHED','PURCHASE_DECIDED','EXCHANGE_OPTION','CANCELED','RETURNED','CANCELED_BY_NOPAYMENT'];
  const results = [];
  for (const t of types) {
    results.push(await countByType({ accessToken: tok.access_token, startISO, endISO, type: t }));
  }

  // 일부러 에러로 던져서 진단 패널에 결과 출력
  const summary = results.map(r => {
    if (r.error) return `${r.type}: ERROR ${r.error}`;
    return `${r.type}: ${r.count}건${r.ids?.length ? ' (' + r.ids.join(',') + ')' : ''}`;
  }).join(' | ');

  throw new Error(`[진단] 오늘 (${startISO.slice(0,10)} ~ ${endISO.slice(0,10)}) 상태별 주문수: ${summary}`);
}
