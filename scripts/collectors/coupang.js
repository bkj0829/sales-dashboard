/**
 * 쿠팡 윙(Wing) 오픈 API — 판매자 매출 수집기
 *
 * 인증: HMAC-SHA256 서명을 Authorization 헤더에 첨부
 *   Authorization: CEA algorithm=HmacSHA256, access-key=..., signed-date=yyMMddTHHmmssZ,
 *                  signature=hex(hmac_sha256(secret, signedDate + method + path + query))
 *
 * 발주서 조회: GET /v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets
 *   - searchType=timeFrame  (필수 — 기간 기반 검색)
 *   - createdAtFrom / createdAtTo (yyyy-MM-ddTHH:mm:ss)
 *   - 응답의 orderItems[].orderPrice * shippingCount 합계
 *
 * 환경변수: COUPANG_VENDOR_ID, COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY
 */
import crypto from 'node:crypto';

const HOST = 'https://api-gateway.coupang.com';

function signedDateNow() {
  // 쿠팡 OpenAPI 는 *2자리 연도* 형식(yyMMddTHHmmssZ)을 요구합니다 (UTC).
  // 4자리(YYYYMMDD)로 보내면 서명 불일치 401/403 에러 발생.
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${yy}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T` +
         `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function buildAuthHeader({ method, path, query, accessKey, secretKey }) {
  const signedDate = signedDateNow();
  const message = signedDate + method.toUpperCase() + path + (query || '');
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

function kstNowMinusToday() {
  // KST 기준 오늘 00:00 ~ 현재 (yyyy-MM-ddTHH:mm:ss)
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const y = now.getUTCFullYear(), m = pad(now.getUTCMonth()+1), d = pad(now.getUTCDate());
  const h = pad(now.getUTCHours()), mi = pad(now.getUTCMinutes()), s = pad(now.getUTCSeconds());
  return { from: `${y}-${m}-${d}T00:00:00`, to: `${y}-${m}-${d}T${h}:${mi}:${s}` };
}

export async function collectCoupang() {
  const env = process.env;
  const vendorId = env.COUPANG_VENDOR_ID;
  const accessKey = env.COUPANG_ACCESS_KEY;
  const secretKey = env.COUPANG_SECRET_KEY;
  if (!vendorId || !accessKey || !secretKey) throw new Error('쿠팡 환경변수 누락');

  const { from, to } = kstNowMinusToday();
  const path = `/v2/providers/openapi/apis/api/v4/vendors/${vendorId}/ordersheets`;
  // searchType=timeFrame: 기간 기반 검색 (필수)
  const query = `searchType=timeFrame&createdAtFrom=${from}&createdAtTo=${to}&maxPerPage=50`;

  let amount = 0, orders = 0, nextToken = '';
  do {
    const q = query + (nextToken ? `&nextToken=${encodeURIComponent(nextToken)}` : '');
    const auth = buildAuthHeader({ method: 'GET', path, query: q, accessKey, secretKey });
    const res = await fetch(`${HOST}${path}?${q}`, {
      headers: { Authorization: auth, 'X-Requested-By': vendorId },
    });
    if (!res.ok) throw new Error(`coupang: ${res.status} ${await res.text()}`);
    const json = await res.json();
    (json.data || []).forEach(sheet => {
      orders += 1;
      (sheet.orderItems || []).forEach(it => {
        amount += Number(it.orderPrice || 0) * Number(it.shippingCount || 1);
      });
    });
    nextToken = json.nextToken || '';
  } while (nextToken);

  return { amount, orders };
}
