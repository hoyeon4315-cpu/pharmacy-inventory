// API 미들웨어: CORS + 관리자 인증 체크
// PUT/DELETE 요청은 유효한 세션 토큰 필요

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 쓰기 요청(PUT/DELETE)은 Authorization 헤더 확인
  if (request.method === 'PUT' || request.method === 'DELETE') {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: '인증 필요' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 토큰 검증: "type:hash" 형태
    const token = auth.slice(7);
    const [type, hash] = token.split(':');
    if (!type || !hash) {
      return new Response(JSON.stringify({ error: '잘못된 토큰' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DB에서 해당 관리자의 password_hash 확인
    const row = await env.DB.prepare(
      'SELECT password_hash FROM admin_config WHERE id = ?'
    ).bind(type).first();

    if (!row || row.password_hash !== hash) {
      return new Response(JSON.stringify({ error: '권한 없음' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 인증된 관리자 타입을 context에 저장
    context.data = { adminType: type };
  }

  // 다음 핸들러 실행
  const response = await next();

  // CORS 헤더 추가
  const newResponse = new Response(response.body, response);
  for (const [k, v] of Object.entries(corsHeaders)) {
    newResponse.headers.set(k, v);
  }
  return newResponse;
}
