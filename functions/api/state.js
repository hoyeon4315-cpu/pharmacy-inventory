// 재고 데이터 API
// GET  /api/state?type=chemo|general  - 데이터 조회 (누구나)
// PUT  /api/state                     - 데이터 저장 (관리자만, 미들웨어에서 인증)

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  if (!type || !['chemo', 'general'].includes(type)) {
    return Response.json({ error: 'type 파라미터 필요 (chemo|general)' }, { status: 400 });
  }

  const row = await env.DB.prepare(
    'SELECT data, daily_data, updated_at FROM app_state WHERE id = ?'
  ).bind(type).first();

  if (!row) {
    return Response.json({ data: '{}', daily_data: '{}', updated_at: null });
  }

  return Response.json({
    data: row.data,
    daily_data: row.daily_data,
    updated_at: row.updated_at,
  });
}

export async function onRequestPut(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { type, data, daily_data } = body;

    if (!type || !['chemo', 'general'].includes(type)) {
      return Response.json({ error: 'type 필요' }, { status: 400 });
    }

    // 미들웨어에서 인증된 관리자 타입 확인
    if (!context.data || !context.data.adminType) {
      return Response.json({ error: '인증 필요' }, { status: 401 });
    }
    if (context.data.adminType !== type) {
      return Response.json({ error: '다른 관리자의 데이터는 수정할 수 없습니다.' }, { status: 403 });
    }

    // 데이터 타입 검증: 저장되는 데이터의 _dataType이 요청 type과 일치해야 함
    if (data && data !== '{}') {
      try {
        const parsed = JSON.parse(data);
        if (parsed._dataType && parsed._dataType !== type) {
          return Response.json({ error: '데이터 타입 불일치 (' + parsed._dataType + ' != ' + type + ')' }, { status: 400 });
        }
      } catch(e) { /* JSON 파싱 실패는 무시 */ }
    }

    const now = new Date().toISOString();

    await env.DB.prepare(
      'INSERT OR REPLACE INTO app_state (id, data, daily_data, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(type, data || '{}', daily_data || '{}', now).run();

    // 재고 히스토리 저장 (AI 수요예측용, 365일 보관)
    try {
      if (data && data !== '{}') {
        const parsed = JSON.parse(data);
        const inv = parsed.inventory || [];
        if (inv.length > 0) {
          const summary = inv.map(d => ({
            c: d.code || '',
            n: (d.name || '').substring(0, 40),
            q: d.qty != null ? d.qty : 0
          }));
          const dateKey = now.slice(0, 10);
          await env.DB.prepare(
            'INSERT OR REPLACE INTO inventory_history (data_type, date, summary) VALUES (?, ?, ?)'
          ).bind(type, dateKey, JSON.stringify(summary)).run();

          // 365일 초과 데이터 정리
          const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
          await env.DB.prepare(
            'DELETE FROM inventory_history WHERE data_type = ? AND date < ?'
          ).bind(type, cutoff).run();
        }
      }
    } catch (histErr) {
      console.warn('inventory_history 저장 실패:', histErr);
    }

    // 항암제 일별 통계 저장 (AI 분석용, 365일 보관)
    try {
      if (type === 'chemo' && body.chemo_stats) {
        const stats = JSON.parse(body.chemo_stats);
        if (stats && stats.d) {
          await env.DB.prepare(
            'INSERT OR REPLACE INTO chemo_daily_stats (date, stats) VALUES (?, ?)'
          ).bind(stats.d, body.chemo_stats).run();

          // 365일 초과 정리
          const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
          await env.DB.prepare(
            'DELETE FROM chemo_daily_stats WHERE date < ?'
          ).bind(cutoff).run();
        }
      }
    } catch (statsErr) {
      console.warn('chemo_daily_stats 저장 실패:', statsErr);
    }

    return Response.json({ success: true, updated_at: now });
  } catch (e) {
    return Response.json({ error: '저장 실패: ' + e.message }, { status: 500 });
  }
}
