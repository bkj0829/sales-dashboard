const ENDPOINT = 'https://openapi.zigzag.kr/1/graphql';

const INTROSPECTION = `
{
  __schema {
    queryType {
      fields {
        name
        args { name type { name kind ofType { name kind } } }
      }
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

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-solution': 'zigzag',
      'x-access-token': accessKey,
      'x-secret-key': secretKey,
    },
    body: JSON.stringify({ query: INTROSPECTION }),
  });

  if (!res.ok) {
    throw new Error(`kakaostyle: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`kakaostyle introspection: ${JSON.stringify(json.errors)}`);
  }

  const fields = json.data?.__schema?.queryType?.fields || [];
  const summary = fields.slice(0, 50).map(f => {
    const args = (f.args || []).map(a => a.name).join(', ');
    return args ? `${f.name}(${args})` : f.name;
  }).join(' | ');

  throw new Error(`[디스커버리] 사용 가능 query (${fields.length}개): ${summary}`);
}
