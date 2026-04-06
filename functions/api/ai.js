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
    conversationHistory, newsContext, filteredDrugList, historicalDays,
    dataAvailability, forecastUsageSummary
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
    chemoStats, newsContext, filteredDrugList, historicalDays,
    dataAvailability, forecastUsageSummary
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

function buildMultiAgentPrompt(dataType, activeTab, memories, history, inventorySummary, drugMasterSummary, recentAlerts, chemoStats, newsContext, filteredDrugList, historicalDays, dataAvailability, forecastUsageSummary) {
  const modeName = dataType === 'chemo' ? '항암제' : '일반약';
  const modeNameEn = dataType === 'chemo' ? 'chemo' : 'general';

  // 데이터 가용성 파악
  const da = dataAvailability || {};
  const hasInventory = (da.inventoryDays || 0) > 0;
  const hasUsageFile = (da.usageFileDays || 0) > 0;
  const hasForecast = da.hasForecastUsage || false;
  const usageSource = da.usageSource || '데이터 없음';

  let prompt = `# SYSTEM IDENTITY
당신은 병원 약제부 재고관리 전문 AI입니다.
현재 모드: **${modeName} 관리 모드**

## CORE MISSION
1. 재고 위험 조기 경보: 소진 임박 약품 파악 + 구체적 발주 시점 제안
2. 공급 리스크 분석: 뉴스 + 재고 데이터 결합하여 공급 중단 위험 사전 경고
3. 수요 예측: 과거 사용 패턴 기반 향후 소요량 예측
4. 실행 가능한 조언: "확인하세요" (X) → "X개 발주하세요" (O)

## CRITICAL MODE RULE
- 오직 **${modeName}** 분류 의약품만 분석
- ${dataType === 'chemo' ? '일반약은 절대 언급 금지' : '항암제는 절대 언급 금지'}

## 재고 증감 해석 원칙 (중요)
재고 변화 = 사용량 - 입고량
- 재고가 줄었다 → 사용했거나 폐기
- 재고가 늘었다 → 입고가 있었다는 의미 (사용량 계산 시 단순 감소량만 보면 오류)
- 따라서 일평균 소모량은 **사용량 파일** 기반이 가장 정확
- 사용량 파일 없으면 재고 감소량으로 추정하되 "입고 가능성" 언급 필요

## 현재 데이터 가용성
- 재고 이력: ${da.inventoryDays || 0}일치 (최신: ${da.latestInventoryDate || '없음'})
- 사용량 파일: ${da.usageFileDays || 0}일치
- 기간별 소모량: ${hasForecast ? da.forecastPeriod : '없음'}
- 일평균 소모량 계산 기준: **${usageSource}**

## 데이터 부족 시 안내 규칙 (필수)
사용자가 분석을 요청할 때 데이터가 부족하면 반드시 어떤 파일이 필요한지 안내:
- 소진일/발주량 계산 불가 → "사용량 파일(2번)을 업로드하면 더 정확한 분석이 가능합니다"
- 추세 분석 불가 (재고 이력 1일 이하) → "매일 현재고량 파일(1번)을 업로드하면 추세 분석이 가능합니다"
- 기간 소모량 없음 → "수요예측 탭에서 기간별 사용량 파일을 업로드하면 더 정확한 예측이 가능합니다"
- 뉴스 분석 요청 시 원내 약품 미등록 → "설정 탭에서 약품 마스터를 등록하면 원내 약품 관련 뉴스만 필터링됩니다"

## 응답 형식
- 🔴 긴급 (1-3일분) / 🟡 주의 (4-7일분) / 🟢 안정 (8일분+)
- 발주량 = (일평균 × 14일) - 현재고
- 수치 없이 "부족합니다" 같은 모호한 답변 금지
- 현재 탭: ${activeTab || '대시보드'}

## 메모리 저장
사용자가 정보 제공 시 응답 끝에: [MEMORY:카테고리:내용]
카테고리: drug_status / shortage / discontinued / note
`;

  // 원내 등록 약품 목록
  if (filteredDrugList && filteredDrugList.length > 0) {
    prompt += '\n# 원내 등록 ' + modeName + ' 목록 (' + filteredDrugList.length + '품목)\n';
    filteredDrugList.slice(0, 100).forEach(d => { prompt += `- ${d.code}: ${d.name}\n`; });
    if (filteredDrugList.length > 100) prompt += `... 외 ${filteredDrugList.length - 100}품목\n`;
  } else {
    prompt += '\n# 원내 약품 마스터 미등록\n설정 탭에서 약품을 등록하면 더 정확한 분석이 가능합니다.\n';
  }

  // 기억된 정보
  if (memories.length > 0) {
    prompt += '\n# 기억된 정보\n';
    memories.forEach(m => {
      const date = m.created_at ? m.created_at.slice(0, 10) : '';
      prompt += `- [${date}] ${m.category}: ${m.drug_name ? m.drug_name + ' - ' : ''}${m.content}\n`;
    });
  }

  // 현재 재고 (긴급도 정렬)
  if (inventorySummary && inventorySummary.length > 0) {
    const sorted = inventorySummary.slice().sort((a, b) => a.daysLeft - b.daysLeft);
    prompt += `\n# 현재 ${modeName} 재고 (${inventorySummary.length}품목, 소모량 기준: ${usageSource})\n`;
    prompt += '긴급 | 코드 | 약품명 | 현재고 | 일평균소모 | 예상소진\n';
    sorted.slice(0, 80).forEach(d => {
      const u = d.daysLeft <= 3 ? '🔴' : d.daysLeft <= 7 ? '🟡' : '🟢';
      const days = d.daysLeft >= 999 ? '계산불가' : d.daysLeft + '일분';
      prompt += `${u} | ${d.code} | ${d.name} | ${d.qty} | ${d.dailyUsage || '-'}/일 | ${days}\n`;
    });
    if (sorted.length > 80) prompt += `... 외 ${sorted.length - 80}품목\n`;

    const urgent = sorted.filter(d => d.daysLeft <= 3 && d.qty > 0 && d.dailyUsage > 0);
    if (urgent.length > 0) {
      prompt += `\n⚠️ 즉시 발주 필요 ${urgent.length}품목:\n`;
      urgent.slice(0, 10).forEach(d => {
        const orderQty = Math.max(0, Math.ceil(d.dailyUsage * 14) - d.qty);
        prompt += `  - ${d.name}: 현재 ${d.qty}, 발주 ${orderQty} 권장 (2주분)\n`;
      });
    }

    const noUsageData = sorted.filter(d => d.dailyUsage === 0).length;
    if (noUsageData > 0) {
      prompt += `\n※ ${noUsageData}품목은 사용량 데이터 없어 소진일 계산 불가 → 사용량 파일(2번) 업로드 권장\n`;
    }
  } else if (!hasInventory) {
    prompt += '\n# 재고 데이터 없음\n현재고량 파일(1번)을 업로드하면 재고 분석이 가능합니다.\n';
  }

  // 기간별 소모량 (forecastUsage)
  if (forecastUsageSummary && forecastUsageSummary.itemCount > 0) {
    prompt += `\n# 기간별 소모량 데이터 (${forecastUsageSummary.period}, ${forecastUsageSummary.itemCount}품목)\n`;
    prompt += '이 데이터가 가장 신뢰도 높은 소모량 기준입니다.\n';
    prompt += '코드 | 약품명 | 기간합계 | 일평균\n';
    forecastUsageSummary.topItems.forEach(i => {
      prompt += `${i.code} | ${i.name} | ${i.total} | ${i.dailyAvg}/일\n`;
    });
  }

  // 현재 알림
  if (recentAlerts && recentAlerts.length > 0) {
    prompt += '\n# 현재 시스템 알림\n';
    recentAlerts.forEach(a => { prompt += `- ${a}\n`; });
  }

  // 재고 추이 (D1 히스토리)
  if (history.length >= 2) {
    prompt += `\n# ${modeName} 재고 추이 (최근 ${history.length}일, D1 저장)\n`;
    prompt += analyzeHistoryTrends(history);
  }

  // 뉴스 + 재고 교차 분석
  if (newsContext && newsContext.length > 0) {
    prompt += `\n# 원내 ${modeName} 관련 공급 뉴스 (${newsContext.length}건)\n`;
    newsContext.slice(0, 15).forEach(n => {
      prompt += `- [${n.date || ''}][${n.category || ''}] ${n.title}`;
      if (n.matchedDrug) {
        const inv = inventorySummary?.find(i => i.name.includes(n.matchedDrug) || n.matchedDrug.includes(i.name));
        if (inv) {
          const risk = inv.daysLeft <= 7 ? '🔴높음' : '🟡중간';
          prompt += ` → 원내: ${n.matchedDrug} (재고 ${inv.daysLeft}일분, 위험도 ${risk})`;
        } else {
          prompt += ` → 원내: ${n.matchedDrug}`;
        }
      }
      prompt += '\n';
    });
  }

  // 항암제 통계
  if (chemoStats && chemoStats.length > 0) {
    prompt += `\n# 항암제 처방/환자 통계 (최근 ${chemoStats.length}일)\n`;
    try {
      const latest = typeof chemoStats[0].stats === 'string' ? JSON.parse(chemoStats[0].stats) : chemoStats[0].stats;
      if (latest.drugs && latest.drugs.length > 0) {
        prompt += `최근(${latest.d}) 약품별 사용량 TOP 10:\n`;
        latest.drugs.slice(0, 10).forEach(d => {
          prompt += `- ${d.n}: 입원 ${d.iQ}, 외래 ${d.oQ}, 환자 ${d.p}명\n`;
        });
      }
    } catch (e) { /* skip */ }
  }

  if (drugMasterSummary) prompt += `\n# 등록 약품 현황: ${drugMasterSummary}\n`;

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

// ── AI 모델 호출 ──

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

  // 1차: xAI Grok 4.1 Fast (Primary) - 비추론/추론 순서로 시도
  if (env.XAI_API_KEY) {
    for (const model of ['grok-4-1-fast', 'grok-4-1-fast-reasoning', 'grok-3-fast']) {
      try {
        const res = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + env.XAI_API_KEY,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 2048,
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.choices?.[0]?.message?.content) {
            console.log('AI model used:', model);
            return data.choices[0].message.content;
          }
        } else {
          const errText = await res.text().catch(() => '');
          console.warn(model + ' failed:', res.status, errText.substring(0, 200));
          // 모델 없음 오류면 다음 모델 시도, 인증 오류면 중단
          if (res.status === 401 || res.status === 403) break;
        }
      } catch (e) {
        console.warn(model + ' error:', e.message);
      }
    }
  }

  // 2차: Workers AI 폴백 (무료)
  if (env.AI) {
    try {
      const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages,
        max_tokens: 1024,
      });
      if (result?.response) return result.response;
    } catch (e) {
      console.warn('70B failed:', e.message);
    }

    try {
      const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages,
        max_tokens: 1024,
      });
      if (result?.response) return result.response;
    } catch (e) {
      console.warn('8B failed:', e.message);
    }
  }

  throw new Error('AI 서비스를 사용할 수 없습니다.');
}
