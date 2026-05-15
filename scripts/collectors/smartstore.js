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

async function listByType({ accessToken, startISO, endISO, type }) {
  const params = new URLSearchParams({
    lastChangedFrom: startISO,
    lastChangedTo: endISO,
    lastChangedType: type,
  });
  const res = await fetch(`${BASE}/v1/pay-order/seller/product-orders/last-changed-statuses?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const list = json.data?.lastChangeStatuses || json.data?.lastChangedStatuses || [];
  return list.map(x => x.productOrderId).filter(Boolean);
}

async function queryDetails({ accessToken, productOrderNos }) {
  const items = [];
  for (let i = 0; i < productOrderNos.length; i += 300) {
    const batch = productOrderNos.slice(i, i + 300);
    const res = await fetch(`${BASE}/v1/pay-order/seller/product-orders/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productOrderNos: batch }),
    });
    if (!res.ok) throw new Error(`smartstore query: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const data = json.data || [];
    data.forEach(x => items.push(x));
  }
  return items;
}

export async function collectSmartstore({ startISO, endISO, dateKST }) {
  const env = process.env;
  if (!env.SMARTSTORE_CLIENT_ID || !env.SMARTSTORE_CLIENT_SECRET) {
    throw new Error('스마트스토어 환경변수 누락 (SMARTSTORE_CLIENT_ID/SECRET)');
  }
  const tok = await getAccessToken({
    clientId: env.SMARTSTORE_CLIENT_ID,
    clientSecret: env.SMARTSTORE_CLIENT_SECRET,
  });
  const accessToken = tok.access_token;

  const types = ['PAYED', 'DISPATCHED', 'PURCHASE_DECIDED'];
  const allIds = new Set();
  for (const t of types) {
    const ids = await listByType({ accessToken, startISO, endISO, type: t });
    ids.forEach(id => allIds.add(id));
    await new Promise(r => setTimeout(r, 300));
  }

  if (allIds.size === 0) {
    return { amount: 0, orders: 0 };
  }

  const items = await queryDetails({ accessToken, productOrderNos: [...allIds] });

  let amount = 0;
  const orderSet = new Set();
  items.forEach(it => {
    const po = it.productOrder || it;
    const order = it.order || {};
    const paidStr = po.paymentDate || po.paidDate || order.paymentDate || order.paymentDateTime;
    if (paidStr) {
      const paidDateKST = String(paidStr).slice(0, 10);
      if (paidDateKST !== dateKST) return;
    }
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
