/**
 * 네이버 스마트스토어 (커머스 API) 매출 수집기
 *
 * 인증: OAuth2 client_credentials (전자서명 방식)
 *  - POST https://api.commerce.naver.com/external/v1/oauth2/token
 *  - body: client_id, timestamp, client_secret_sign, grant_type=client_credentials, type=SELF
 *  - client_secret_sign = bcrypt(client_id + "_" + timestamp, client_secret) 후 base64
 *
 * 주문 조회 흐름 (2단계 — 네이버 공식 권장)
 *  1) GET  /v1/pay-order/seller/product-orders/last-changed-statuses
 *     ?lastChangedFrom=...&lastChangedTo=...&lastChangedType=PAYED
 *     → 기간 내 결제완료된 productOrderId 목록
 *  2) POST /v1/pay-order/seller/product-orders/query
 *     { productOrderNos: ["..."] }   ← 네이버는 IDs 가 아니라 Nos 필드명 사용
 *     → 각 주문 상세 (totalPaymentAmount 등)
 *
 * 환경변수: SMARTSTORE_CLIENT_ID, SMARTSTORE_CLIENT_SECRET
 *
 * 주의: 본 collector 는 *한국 IP* 에서만 동작합니다 (네이버 정책).
 *       GitHub 무료 러너로는 호출 불가 → self-hosted runner 필수.
 */
import bcrypt from 'bcryptjs';

const BASE = 'https://api.commerce.naver.com/external';

async function getAccessToken({ clientId, clientSecret }) {
  const timestamp = Date.now();
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  const sign = Buffer.from(hashed, 'utf8').toString('base64');

  const body = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: sign,
    grant_type: 'client_credentials',
    type: 'SELF',
  });

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`smartstore token: ${res.status} ${await res.text()}`);
  return res.json();
}

async function listChangedProductOrderIds({ accessToken, startISO, endISO }) {
  const params = new URLSearchParams({
    lastChangedFrom: startISO,
    lastChangedTo: endISO,
    lastChangedType: 'PAYED',
  });

  const ids = new Set();
  let more = true;
  let cursor = null;

  while (more) {
    if (cursor) params.set('moreSequence', cursor);
    const res = await fetch(`${BASE}/v1/pay-order/seller/product-orders/last-changed-statuses?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`smartstore last-changed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const data = json.data || {};
    const list = data.lastChangeStatuses || data.lastChangedStatuses || [];
    list.forEach(x => { if (x.productOrderId) ids.add(x.productOrderId); });
    more = !!data.more;
    cursor = data.moreSequence || null;
    if (list.length === 0) break;
    if (ids.size > 5000) break;
  }
  return [...ids];
}

async function queryProductOrderDetails({ accessToken, productOrderIds }) {
  const items = [];
  for (let i = 0; i < productOrderIds.length; i += 300) {
    const batch = productOrderIds.slice(i, i + 300);
    const res = await fetch(`${BASE}/v1/pay-order/seller/product-orders/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      // 네이버 커머스 API 는 productOrderIds 가 아니라 productOrderNos 필드명을 사용
      body: JSON.stringify({ productOrderNos: batch }),
    });
    if (!res.ok) throw new Error(`smartstore query: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const data = json.data || [];
    data.forEach(x => items.push(x));
  }
  return items;
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
  const accessToken = tok.access_token;

  const ids = await listChangedProductOrderIds({ accessToken, startISO, endISO });
  if (ids.length === 0) {
    return { amount: 0, orders: 0 };
  }

  const items = await queryProductOrderDetails({ accessToken, productOrderIds: ids });

  let amount = 0;
  const orderSet = new Set();
  items.forEach(it => {
    const po = it.productOrder || it;
    const order = it.order || {};
    const amt = Number(
      po.totalPaymentAmount ??
      po.totalProductAmount ??
      order.paymentAmount ??
      0
    );
    amount += amt;
    const oid = order.orderId || po.orderId || po.productOrderId;
    if (oid) orderSet.add(oid);
  });

  return { amount, orders: orderSet.size };
}
