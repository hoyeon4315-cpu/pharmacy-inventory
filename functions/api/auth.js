// 관리자 인증 API
// POST /api/auth - 로그인 (비밀번호 확인 또는 초기 설정)

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { type, password } = body; // type: 'chemo' | 'general'

    if (!type || !password || !['chemo', 'general'].includes(type)) {
      return Response.json({ error: '잘못된 요청' }, { status: 400 });
    }

    const hash = await sha256(password);

    // 기존 관리자 설정 확인
    const existing = await env.DB.prepare(
      'SELECT password_hash FROM admin_config WHERE id = ?'
    ).bind(type).first();

    if (!existing) {
      // 최초 설정: 비밀번호 등록
      await env.DB.prepare(
        'INSERT INTO admin_config (id, password_hash) VALUES (?, ?)'
      ).bind(type, hash).run();

      return Response.json({
        success: true,
        token: type + ':' + hash,
        message: '관리자 비밀번호가 설정되었습니다.',
        isNew: true,
      });
    }

    // 비밀번호 확인
    if (existing.password_hash !== hash) {
      return Response.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    return Response.json({
      success: true,
      token: type + ':' + hash,
    });
  } catch (e) {
    return Response.json({ error: '서버 오류: ' + e.message }, { status: 500 });
  }
}
