// AI 어시스턴트 API - Multi-Agent + Grok 4.1 Fast Reasoning
// POST /api/ai - 대화, 메모리 관리

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const { action } = body;

  try {
    if (action === 'save_memory') return await handleSaveMemory(env, body);
    if (action === 'delete_memory') return await handleDeleteMemory(env, body);
    if (action === 'get_memories') return await handleGetMemories(env, body);
    return await handleChat(env, body);
  } catch (e) {
    console.error('AI API error:', e);
    return Response.json({ error: e.message || 'AI 처리 실패' }, { status: 500 });
  }
}

// GET /api/ai?type=chemo - 메모리 조회 (읽기 전용 사용자도 가능)
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const dataType = url.searchParams.get('type');
  if (!dataType) return Response.json({ error: 'type 필요' }, { status: 400 });

  const result = await env.DB.prepare(
    'SELECT id, category, drug_code, drug_name, content, created_at FROM ai_memory WHERE data_type = ? AND active = 1 ORDER BY created_at DESC LIMIT 100'
  ).bind(dataType).all();

  return Response.json({ memories: result.results });
}

// ── 메모리 관리 ──

async function handleSaveMemory(env, body) {
  const { dataType, category, drugCode, drugName, content } = body;
  if (!dataType || !content) return Response.json({ error: 'dataType, content 필요' }, { status: 400 });

  await env.DB.prepare(
    'INSERT INTO ai_memory (data_type, category, drug_code, drug_name, content) VALUES (?,?,?,?,?)'
  ).bind(dataType, category || 'user_note', drugCode || null, drugName || null, content).run();

  return Response.json({ success: true });
}

async function handleDeleteMemory(env, body) {
  if (!body.memoryId) return Response.json({ error: 'memoryId 필요' }, { status: 400 });
  await env.DB.prepare('UPDATE ai_memory SET active = 0 WHERE id = ?').bind(body.memoryId).run();
  return Response.json({ success: true });
}

async function handleGetMemories(env, body) {
  const { dataType } = body;
  if (!dataType) return Response.json({ error: 'dataType 필요' }, { status: 400 });

  const result = await env.DB.prepare(
    'SELECT id, category, drug_code, drug_name, content, created_at FROM ai_memory WHERE data_type = ? AND active = 1 ORDER BY created_at DESC LIMIT 100'
  ).bind(dataType).all();

  return Response.json({ memories: result.results });
}

// ── AI 대화 ──

async function handleChat(env, body) {
  const {
    message, dataType, activeTab,
    inventorySummary, drugMasterSummary, recentAlerts,
    conversationHistory, newsContext, filteredDrugList
  } = body;

  if (!message || !dataType) {
    return Response.json({ error: 'message, dataType 필요' }, { status: 400 });
  }

  // 1. AI 메모리 로드 - 현재 모드 전용만
  const memResult = await env.DB.prepare(
    'SELECT content, drug_name, category, created_at FROM ai_memory WHERE data_type = ? AND active = 1 ORDER BY created_at DESC LIMIT 50'
  ).bind(dataType).all();
  const memories = memResult.results || [];

  // 2. 재고 히스토리 로드 (최근 90일) - 현재 모드 전용만
  const histResult = await env.DB.prepare(
    'SELECT date, summary FROM inventory_history WHERE data_type = ? ORDER BY date DESC LIMIT 90'
  ).bind(dataType).all();
  const history = histResult.results || [];

  // 3. 항암제 일별 통계 (항암제 모드에서만)
  let chemoStats = [];
  if (dataType === 'chemo') {
    try {
      const statsResult = await env.DB.prepare(
        'SELECT date, stats FROM chemo_daily_stats ORDER BY date DESC LIMIT 90'
      ).all();
      chemoStats = statsResult.results || [];
    } catch (e) { /* 테이블 미생성 시 무시 */ }
  }

  // 4. Multi-Agent 시스템 프롬프트 구성
  const systemPrompt = buildMultiAgentPrompt(
    dataType, activeTab, memories, history,
    inventorySummary, drugMasterSummary, recentAlerts,
    chemoStats, newsContext, filteredDrugList
  );

  // 5. AI 호출 (멀티턴 이력 포함)
  const chatHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-20) : [];
  const reply = await callAI(env, systemPrompt, message, chatHistory);

  // 6. 메모리 마커 감지 및 저장
  let memorySaved = null;
  const memRegex = /\[MEMORY:([^:]*):([^\]]*)\]/g;
  let cleanReply = reply;
  let match;

  while ((match = memRegex.exec(reply)) !== null) {
    const category = match[1].trim();
    const content = match[2].trim();
    let drugName = null;
    const drugMatch = content.match(/^([^:]+):\s*(.+)/);
    if (drugMatch) drugName = drugMatch[1].trim();

    await env.DB.prepare(
      'INSERT INTO ai_memory (data_type, category, drug_name, content) VALUES (?,?,?,?)'
    ).bind(dataType, category || 'user_note', drugName, content).run();
    memorySaved = content;
  }

  cleanReply = cleanReply.replace(/\[MEMORY:[^\]]*\]/g, '').trim();

  return Response.json({ reply: cleanReply, memorySaved });
}

// ── Multi-Agent 시스템 프롬프트 ──

function buildMultiAgentPrompt(dataType, activeTab, memories, history, inventorySummary, drugMasterSummary, recentAlerts, chemoStats, newsContext, filteredDrugList) {
  const modeName = dataType === 'chemo' ? '항암제' : '일반약';
  const modeNameEn = dataType === 'chemo' ? 'chemo' : 'general';

  let prompt = `# SYSTEM IDENTITY
당신은 병원 약제부 재고관리 Multi-Agent AI 시스템입니다.
현재 모드: **${modeName} 관리 모드** (current_mode = "${modeNameEn}")

## CRITICAL MODE RULE (절대 위반 금지)
- current_mode = "${modeNameEn}" → 오직 **${modeName}** 분류 의약품만 언급하라.
- ${dataType === 'chemo' ? '일반약(진통제, 항생제, 수액 등)은 절대 언급하지 마라.' : '항암제(Paclitaxel, Cisplatin, Bevacizumab 등 항암 목적 약물)는 절대 언급하지 마라.'}
- 사용자가 다른 분류 약품을 물어보면: "현재 ${modeName} 관리 모드입니다. 해당 약품은 ${dataType === 'chemo' ? '일반약' : '항암제'} 모드에서 확인해주세요."라고 안내하라.
- 모드에 맞지 않는 재고 데이터, 뉴스, 통계는 분석하지도, 참조하지도 마라.

# MULTI-AGENT ARCHITECTURE
내부적으로 3개 에이전트가 협업하여 응답을 생성합니다:

## Agent 1: 뉴스 분석가 (News Analyst)
- 역할: 의약품 공급 뉴스 중 **현재 모드(${modeName})의 원내 등록 의약품**과 직접 관련된 뉴스만 분석
- 규칙:
  * 원자재/원료 공급망 뉴스 → 완전 무시
  * 해외 뉴스(국내 공급과 무관) → 무시
  * 다른 분류(${dataType === 'chemo' ? '일반약' : '항암제'}) 관련 뉴스 → 무시
  * 원내 등록 약품 목록에 없는 약품 뉴스 → 무시
  * 반드시 "어떤 원내 약품에 영향이 있는가"를 결론으로 제시

## Agent 2: 내부 데이터 분석가 (Data Analyst)
- 역할: 현재 모드(${modeName})에 해당하는 재고/사용량 JSON 데이터만 분석
- 규칙:
  * 다른 분류 데이터는 절대 보지 않음
  * 재고 수량, 감소 추이, 부족 예측, 사용량 패턴만 분석
  * 수치는 반드시 구체적으로 명시 (약품명 + 현재고 + 일평균소모량 + 예상소진일)
  * 위험 약품(재고 3일분 이하) → 최우선 언급

## Agent 3: 최종 추천 합성자 (Synthesizer)
- 역할: Agent 1(뉴스)과 Agent 2(데이터)의 결과를 통합하여 최종 응답 생성
- 규칙:
  * 뉴스 리스크 + 재고 리스크가 겹치는 약품 → 최우선 경고
  * 실행 가능한 조치(발주, 대체약, 진료과 알림 등)를 구체적으로 제안
  * 불확실한 정보는 "확인 필요"로 표시, 추측 금지
  * 응답은 한국어, 간결하게 (불필요한 서론 없이 바로 본론)

# FEW-SHOT EXAMPLES (Hallucination 방지)
`;

  if (dataType === 'chemo') {
    prompt += `
<example_1>
사용자: 이번 주 재고 상황 어때?
올바른 응답: "현재 항암제 재고 현황입니다.
- Paclitaxel 150mg(TAXOL15): 현재고 12vial, 일평균 3vial 소모 → 약 4일분
- Cisplatin 50mg(CISPL5): 현재고 5vial, 일평균 2vial → 약 2.5일분 [긴급발주 필요]
- Bevacizumab 400mg: 현재고 20vial, 안정적

Cisplatin은 이번 주 내 소진 가능성이 높습니다. 즉시 발주를 권장합니다."
잘못된 응답: "타이레놀이 부족합니다" (← 일반약이므로 항암제 모드에서 절대 언급 금지)
</example_1>

<example_2>
사용자: 품절 뉴스 있어?
올바른 응답: "현재 항암제 관련 공급 이슈입니다.
- Docetaxel 80mg: 제조사 생산라인 점검으로 4월 중순까지 공급 지연 예상 → 원내 재고 확인 필요
- 나머지 항암제는 공급 정상입니다.

(일반 소염진통제/항생제 관련 뉴스는 일반약 모드에서 확인해주세요.)"
잘못된 응답: "아목시실린 품절" (← 일반약이므로 항암제 모드에서 언급 금지)
</example_2>
`;
  } else {
    prompt += `
<example_1>
사용자: 부족한 약 뭐 있어?
올바른 응답: "현재 일반약 재고 부족 현황입니다.
- Amoxicillin 500mg: 현재고 30정, 일평균 15정 소모 → 2일분 [긴급발주 필요]
- Normal Saline 1L: 현재고 10bag, 일평균 8bag → 1.3일분 [긴급]
- Acetaminophen 500mg: 현재고 200정, 안정적

Amoxicillin과 생리식염수는 즉시 발주가 필요합니다."
잘못된 응답: "Paclitaxel이 부족합니다" (← 항암제이므로 일반약 모드에서 절대 언급 금지)
</example_1>
`;
  }

  // 응답 규칙
  prompt += `
# RESPONSE RULES
- 한국어 답변. 간결하고 실용적.
- 수치는 반드시 구체적으로 제시.
- 위험/부족 약품 → 최우선 언급.
- 현재 탭: ${activeTab || '대시보드'} (탭에 맞는 정보 우선)
- 사용자가 정보를 알려주면("기억해줘", "~된대", "~품절", "~안 쓴다" 등) 응답 맨 끝에:
  [MEMORY:카테고리:내용]
  카테고리: drug_status / shortage / discontinued / note
  예시: [MEMORY:shortage:Paclitaxel 150mg: 4월부터 공급중단 예정]
- 기억 요청이 아닌 일반 질문에는 [MEMORY] 태그를 붙이지 마세요.
`;

  // 원내 등록 약품 목록 (프론트에서 전달)
  if (filteredDrugList && filteredDrugList.length > 0) {
    prompt += '\n# 원내 등록 ' + modeName + ' 목록 (' + filteredDrugList.length + '품목)\n';
    prompt += '이 목록에 있는 약품만 "원내 약품"으로 인식하세요.\n';
    filteredDrugList.slice(0, 100).forEach(d => {
      prompt += `- ${d.code}: ${d.name}\n`;
    });
    if (filteredDrugList.length > 100) {
      prompt += `... 외 ${filteredDrugList.length - 100}품목\n`;
    }
  }

  // 기억된 정보 (현재 모드 전용)
  if (memories.length > 0) {
    prompt += '\n# 기억된 정보 (' + modeName + ' 전용)\n';
    memories.forEach(m => {
      const date = m.created_at ? m.created_at.slice(0, 10) : '';
      prompt += `- [${date}] ${m.category}: ${m.drug_name ? m.drug_name + ' - ' : ''}${m.content}\n`;
    });
  }

  // 현재 재고
  if (inventorySummary && inventorySummary.length > 0) {
    prompt += '\n# 현재 ' + modeName + ' 재고 (' + inventorySummary.length + '품목)\n';
    prompt += '코드 | 약품명 | 현재고\n';
    inventorySummary.slice(0, 80).forEach(d => {
      prompt += `${d.code} | ${d.name} | ${d.qty}\n`;
    });
    if (inventorySummary.length > 80) {
      prompt += `... 외 ${inventorySummary.length - 80}품목\n`;
    }
  }

  // 현재 알림
  if (recentAlerts && recentAlerts.length > 0) {
    prompt += '\n# 현재 알림\n';
    recentAlerts.forEach(a => { prompt += `- ${a}\n`; });
  }

  // 재고 추이
  if (history.length >= 2) {
    prompt += '\n# ' + modeName + ' 재고 추이 (최근 ' + history.length + '일)\n';
    prompt += analyzeHistoryTrends(history);
  }

  // 등록 약품 수 요약
  if (drugMasterSummary) {
    prompt += '\n# 등록 약품 현황: ' + drugMasterSummary + '\n';
  }

  // 뉴스 컨텍스트 (프론트에서 필터링된 원내약품 관련만)
  if (newsContext && newsContext.length > 0) {
    prompt += '\n# 원내 ' + modeName + ' 관련 공급 뉴스 (Agent 1 분석 대상)\n';
    prompt += '아래는 원내 등록 약품과 매칭된 뉴스만 포함합니다.\n';
    newsContext.slice(0, 15).forEach(n => {
      prompt += `- [${n.date || ''}] ${n.title}${n.matchedDrug ? ' → 원내약품: ' + n.matchedDrug : ''}\n`;
    });
  }

  // 항암제 일별 통계
  if (chemoStats && chemoStats.length > 0) {
    prompt += '\n# 항암제 처방/환자 통계 (최근 ' + chemoStats.length + '일)\n';
    prompt += '날짜 | 입원환자 | 외래환자 | 총환자 | 입원처방 | 외래처방 | 카테고리 | 처방의\n';
    chemoStats.slice(0, 60).forEach(row => {
      try {
        const s = typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats;
        const catStr = s.cats ? Object.entries(s.cats).map(([k,v]) => k + ':' + v).join(',') : '';
        const docStr = s.docs ? Object.entries(s.docs).map(([k,v]) => k + '(' + v.pts + '명,' + v.rx + '건)').join(',') : '';
        prompt += s.d + ' | ' + (s.inPts||0) + ' | ' + (s.outPts||0) + ' | ' + (s.totalPts||0) + ' | ' + (s.inRx||0) + ' | ' + (s.outRx||0) + ' | ' + catStr + ' | ' + docStr + '\n';
      } catch (e) { /* skip */ }
    });
    try {
      const latest = typeof chemoStats[0].stats === 'string' ? JSON.parse(chemoStats[0].stats) : chemoStats[0].stats;
      if (latest.drugs && latest.drugs.length > 0) {
        prompt += '\n최근(' + latest.d + ') 약품별 사용량 (상위 20):\n';
        prompt += '코드 | 약품명 | 입원사용 | 외래사용 | 환자수\n';
        latest.drugs.slice(0, 20).forEach(d => {
          prompt += d.c + ' | ' + d.n + ' | ' + d.iQ + ' | ' + d.oQ + ' | ' + d.p + '명\n';
        });
      }
    } catch (e) { /* skip */ }
  }

  return prompt;
}

function analyzeHistoryTrends(history) {
  if (!history || history.length < 2) return '데이터 부족\n';

  const dateMap = {};
  const drugNames = {};
  history.forEach(h => {
    try {
      const drugs = JSON.parse(h.summary);
      dateMap[h.date] = {};
      drugs.forEach(d => {
        dateMap[h.date][d.c] = d.q;
        if (d.n) drugNames[d.c] = d.n;
      });
    } catch (e) { /* skip */ }
  });

  const dates = Object.keys(dateMap).sort();
  if (dates.length < 2) return '데이터 부족\n';

  const latest = dates[dates.length - 1];
  const weekIdx = Math.max(0, dates.length - 8);
  const weekAgo = dates[weekIdx];
  const daysDiff = Math.max(1, (new Date(latest) - new Date(weekAgo)) / 86400000);

  const latestData = dateMap[latest] || {};
  const weekData = dateMap[weekAgo] || {};
  const allCodes = new Set([...Object.keys(latestData), ...Object.keys(weekData)]);

  let items = [];
  allCodes.forEach(code => {
    const nowQty = latestData[code] || 0;
    const oldQty = weekData[code] || 0;
    const dailyChange = parseFloat(((nowQty - oldQty) / daysDiff).toFixed(1));
    items.push({ code, name: drugNames[code] || code, nowQty, oldQty, dailyChange });
  });

  items.sort((a, b) => a.dailyChange - b.dailyChange);

  let result = '';
  const decreasing = items.filter(i => i.dailyChange < -0.5).slice(0, 15);
  const lowStock = items.filter(i => i.nowQty > 0 && i.nowQty <= 5 && i.dailyChange <= 0).slice(0, 10);

  if (decreasing.length > 0) {
    result += '감소 추세 약품:\n';
    decreasing.forEach(i => {
      const daysLeft = i.dailyChange < 0 ? Math.round(i.nowQty / Math.abs(i.dailyChange)) : 999;
      result += `${i.name}(${i.code}): 현재${i.nowQty} | ${i.dailyChange}/일 | 약${daysLeft}일분\n`;
    });
  }

  if (lowStock.length > 0) {
    result += '재고 부족 약품 (5개 이하):\n';
    lowStock.forEach(i => {
      result += `${i.name}(${i.code}): ${i.nowQty}개\n`;
    });
  }

  if (!result) result = '특이 추이 없음\n';
  return result;
}

// ── AI 모델 호출 (Grok 4.1 Fast Primary) ──

async function callAI(env, systemPrompt, userMessage, history = []) {
  const normalizedHistory = history.map(m => ({
    role: m.role === 'ai' ? 'assistant' : m.role,
    content: String(m.content || '')
  }));
  const messages = [
    { role: 'system', content: systemPrompt },
    ...normalizedHistory,
    { role: 'user', content: userMessage }
  ];

  // 1차: xAI Grok 4.1 Fast Reasoning (Primary)
  if (env.XAI_API_KEY) {
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + env.XAI_API_KEY,
        },
        body: JSON.stringify({
          model: 'grok-4-1-fast-reasoning',
          messages,
          max_tokens: 2048,
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.choices && data.choices[0]) {
          return data.choices[0].message.content;
        }
      } else {
        console.warn('Grok 4.1 Fast failed:', res.status, await res.text().catch(() => ''));
      }
    } catch (e) {
      console.warn('Grok 4.1 Fast error:', e.message);
    }
  }

  // 2차: Workers AI 폴백 (무료)
  if (env.AI) {
    // 70B
    try {
      const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages,
        max_tokens: 1024,
      });
      if (result && result.response) return result.response;
    } catch (e) {
      console.warn('70B failed:', e.message);
    }

    // 8B 폴백
    try {
      const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages,
        max_tokens: 1024,
      });
      if (result && result.response) return result.response;
    } catch (e) {
      console.warn('8B failed:', e.message);
    }
  }

  throw new Error('AI 서비스를 사용할 수 없습니다. XAI_API_KEY를 설정하거나 Workers AI를 확인하세요.');
}
