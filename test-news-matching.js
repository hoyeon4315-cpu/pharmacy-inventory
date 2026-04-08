// 뉴스 매칭 로직 테스트
// Node.js에서 실행: node test-news-matching.js

// 한글-영문 약품명 매핑 사전 (일반적인 약품명)
const DRUG_NAME_MAP = {
  // 항암제
  '시스플라틴': 'cisplatin',
  '카보플라틴': 'carboplatin',
  '옥살리플라틴': 'oxaliplatin',
  '파클리탁셀': 'paclitaxel',
  '도세탁셀': 'docetaxel',
  '젬시타빈': 'gemcitabine',
  '젬자': 'gemzar',
  '허셉틴': 'herceptin',
  '트라스투주맙': 'trastuzumab',
  '베바시주맙': 'bevacizumab',
  '아바스틴': 'avastin',
  '세툭시맙': 'cetuximab',
  '리툭시맙': 'rituximab',
  '이리노테칸': 'irinotecan',
  '토포테칸': 'topotecan',
  '에토포시드': 'etoposide',
  '빈크리스틴': 'vincristine',
  '빈블라스틴': 'vinblastine',
  '독소루비신': 'doxorubicin',
  '에피루비신': 'epirubicin',
  '플루오로우라실': 'fluorouracil',
  '카페시타빈': 'capecitabine',
  '메토트렉세이트': 'methotrexate',
  '사이클로포스파마이드': 'cyclophosphamide',
  '이포스파마이드': 'ifosfamide',
  '템시롤리무스': 'temsirolimus',
  '에베롤리무스': 'everolimus',
  '수니티닙': 'sunitinib',
  '소라페닙': 'sorafenib',
  '레날리도마이드': 'lenalidomide',
  '보르테조밉': 'bortezomib',
  '펨브롤리주맙': 'pembrolizumab',
  '니볼루맙': 'nivolumab',
  '아테졸리주맙': 'atezolizumab',
  // 일반약
  '타이레놀': 'tylenol',
  '아세트아미노펜': 'acetaminophen',
  '이부프로펜': 'ibuprofen',
  '아스피린': 'aspirin',
  '아목시실린': 'amoxicillin',
  '세파클러': 'cefaclor',
  '세프트리악손': 'ceftriaxone',
  '레보플록사신': 'levofloxacin',
  '시프로플록사신': 'ciprofloxacin',
  '오메프라졸': 'omeprazole',
  '란소프라졸': 'lansoprazole',
  '라니티딘': 'ranitidine',
  '메트포르민': 'metformin',
  '글리메피리드': 'glimepiride',
  '아토르바스타틴': 'atorvastatin',
  '로수바스타틴': 'rosuvastatin',
  '암로디핀': 'amlodipine',
  '로사르탄': 'losartan',
  '발사르탄': 'valsartan',
};

// 매칭 함수들 복사
function normalizeDrugName(name) {
  if (!name) return '';
  return name
    .replace(/\([^)]*\)/g, '')
    .replace(/주사제?|정제?|캡슐제?|시럽제?|액제?|산제?|크림제?|연고제?|점안제?|외용제?|좌제?|패치|필름|과립|현탁|동결건조|프리필드|시린지/g, '')
    .replace(/\d+(\.\d+)?\s*(mg|ml|mcg|ug|g|%|iu|unit)/gi, '')
    .replace(/[^가-힣a-zA-Z]/g, '')
    .toLowerCase()
    .trim();
}

function extractEngBase(name) {
  if (!name) return '';
  const m = name.match(/^([A-Za-z][A-Za-z\-]+)/);
  return m ? m[1].toLowerCase() : '';
}

function extractKorBase(name) {
  if (!name) return '';
  const m = name.replace(/\([^)]*\)/g, '').match(/^([가-힣]{2,})/);
  // 접미사 제거: 주사액, 주사, 주, 정, 캡슐, 시럽, 크림, 연고, 과립, 현탁, 액, 산
  return m ? m[1].replace(/주사액$|주사$|주$|정$|캡슐$|시럽$|크림$|연고$|과립$|현탁$|액$|산$/, '') : '';
}

function buildNewsMatchCache(drugs) {
  return drugs.map(d => ({
    drug: d,
    norm: normalizeDrugName(d.name),
    eng: extractEngBase(d.name),
    kor: extractKorBase(d.name),
    // 약품명 전체 (한글+영문 모두 포함)
    fullName: d.name.toLowerCase(),
    ingredient: (d.ingredient || '').toLowerCase(),
    ingKor: (d.ingredient || '').replace(/[a-zA-Z0-9\s.,()\/\-]/g, '').trim(),
    ingEng: (d.ingredient || '').split(/\s+/)[0].toLowerCase(),
    ediCode: d.ediCode || d.code || '',
    // 한글-영문 매핑 추가: 약품명에서 한글 부분 추출 후 영문으로 변환
    korToEng: extractKorToEngMapping(d.name),
  }));
}

// 약품명에서 한글 부분을 추출하고 영문으로 매핑
function extractKorToEngMapping(name) {
  const korParts = name.match(/[가-힣]+/g) || [];
  const engParts = [];
  for (const kor of korParts) {
    const mapped = DRUG_NAME_MAP[kor];
    if (mapped) engParts.push(mapped);
  }
  return engParts.join(' ').toLowerCase();
}

function getMatchedHospitalDrug(newsItem, cache) {
  if (!newsItem || !newsItem.title) return null;
  if (cache.length === 0) return null;

  const titleClean = newsItem.title.replace(/^\[.*?\]\s*/, '');
  const newsProductName = titleClean.split(/\s*\((?!.*\()/).shift().trim();
  const newsNorm = normalizeDrugName(newsProductName);
  const newsEng = extractEngBase(newsProductName);
  const newsKor = extractKorBase(newsProductName);
  const newsLower = (newsItem.title + ' ' + (newsItem.summary || '')).toLowerCase();

  const ediMatch = (newsItem.summary || '').match(/EDI코드:\s*(\d{9,})/i);
  const newsEdi = ediMatch ? ediMatch[1] : '';

  // 1단계: EDI코드 매칭
  if (newsEdi && newsEdi.length >= 9) {
    for (const c of cache) {
      const drugEdi = String(c.ediCode || '').trim();
      if (drugEdi.length >= 9 && drugEdi === newsEdi) {
        console.log('✓ [EDI 매칭]', newsProductName, '→', c.drug.name, '(EDI:', newsEdi, ')');
        return c.drug;
      }
    }
  }

  // 2단계: 약품명 정규화 매칭
  if (newsNorm.length >= 5) {
    for (const c of cache) {
      if (!c.norm || c.norm.length < 5) continue;
      const short = newsNorm.length <= c.norm.length ? newsNorm : c.norm;
      const long = newsNorm.length > c.norm.length ? newsNorm : c.norm;
      if (long.includes(short) && short.length >= 5 && short.length / long.length >= 0.7) {
        console.log('✓ [정규화 매칭]', newsProductName, '→', c.drug.name, '(norm:', short, '/', long, ')');
        return c.drug;
      }
    }
  }

  // 3단계: 영문 기본명 매칭
  if (newsEng.length >= 6) {
    for (const c of cache) {
      if (c.eng.length >= 6) {
        const short = newsEng.length <= c.eng.length ? newsEng : c.eng;
        const long = newsEng.length > c.eng.length ? newsEng : c.eng;
        if (long.startsWith(short) && short.length >= 6 && short.length / long.length >= 0.7) {
          console.log('✓ [영문 매칭]', newsProductName, '→', c.drug.name, '(eng:', short, '/', long, ')');
          return c.drug;
        }
      }
    }
  }

  // 4단계: 한글 기본명 매칭 (최소 5자로 강화, 80% 이상)
  if (newsKor.length >= 5) {
    for (const c of cache) {
      if (c.kor.length >= 5) {
        const short = newsKor.length <= c.kor.length ? newsKor : c.kor;
        const long = newsKor.length > c.kor.length ? newsKor : c.kor;
        if (long.includes(short) && short.length >= 5 && short.length / long.length >= 0.8) {
          console.log('✓ [한글 매칭]', newsProductName, '→', c.drug.name, '(kor:', short, '/', long, ')');
          return c.drug;
        }
      }
    }
  }

  // 5단계: 한글-영문 교차 매칭 (사전 기반이므로 최소 길이 2자로 완화)
  if (newsKor.length >= 2) {
    // 뉴스 한글명을 영문으로 변환하여 매칭
    const newsKorToEng = DRUG_NAME_MAP[newsKor] || '';
    for (const c of cache) {
      // 방법 1: 원내 약품명에 뉴스 한글명이 포함되어 있는지 확인
      if (c.fullName && c.fullName.includes(newsKor)) {
        console.log('✓ [한글→전체명 매칭]', newsProductName, '→', c.drug.name, '(kor:', newsKor, ')');
        return c.drug;
      }
      // 방법 2: 뉴스 한글명을 영문으로 변환 후 원내 약품명과 비교
      if (newsKorToEng && c.fullName.includes(newsKorToEng)) {
        console.log('✓ [한글→영문 매핑]', newsProductName, '→', c.drug.name, '(kor:', newsKor, '→', newsKorToEng, ')');
        return c.drug;
      }
      // 방법 3: 뉴스 한글명을 영문으로 변환 후 정규화된 약품명과 비교
      if (newsKorToEng && c.norm.includes(newsKorToEng)) {
        console.log('✓ [한글→영문 매핑(norm)]', newsProductName, '→', c.drug.name, '(kor:', newsKor, '→', newsKorToEng, ')');
        return c.drug;
      }
    }
  }
  if (newsEng.length >= 6) {
    for (const c of cache) {
      // 원내 약품명에 뉴스 영문명이 포함되어 있는지 확인
      if (c.fullName && c.fullName.includes(newsEng)) {
        console.log('✓ [영문→전체명 매칭]', newsProductName, '→', c.drug.name, '(eng:', newsEng, ')');
        return c.drug;
      }
      // 원내 약품의 한글-영문 매핑에 뉴스 영문명이 포함되어 있는지 확인
      if (c.korToEng && c.korToEng.includes(newsEng)) {
        console.log('✓ [영문→한글 매핑]', newsProductName, '→', c.drug.name, '(eng:', newsEng, '→ kor mapping)');
        return c.drug;
      }
    }
  }

  // 6단계: 성분명 매칭
  for (const c of cache) {
    if (!c.ingredient) continue;
    if (c.ingKor.length >= 4 && newsProductName.includes(c.ingKor)) {
      console.log('✓ [성분(한글) 매칭]', newsProductName, '→', c.drug.name, '(ing:', c.ingKor, ')');
      return c.drug;
    }
    if (c.ingEng.length >= 8 && newsLower.includes(c.ingEng)) {
      console.log('✓ [성분(영문) 매칭]', newsProductName, '→', c.drug.name, '(ing:', c.ingEng, ')');
      return c.drug;
    }
  }

  console.log('✗ [매칭 실패]', newsProductName, '(norm:', newsNorm, ', eng:', newsEng, ', kor:', newsKor, ')');
  return null;
}

// ============================================================
// 테스트 케이스
// ============================================================

console.log('='.repeat(80));
console.log('뉴스 매칭 로직 테스트');
console.log('='.repeat(80));

// 원내 약품 목록 (샘플)
const hospitalDrugs = [
  // 항암제
  { code: 'XPTAX100', name: 'Paclitaxel 100mg inj', _type: '항암제', ediCode: '651600010' },
  { code: 'XBEVA4', name: 'Avastin 400mg/16ml inj', _type: '항암제', ediCode: '651600020' },
  { code: 'XCISP50', name: 'Cisplatin 50mg inj', _type: '항암제', ediCode: '651600030' },
  { code: 'XGEMCIT1L', name: 'Gemzar liquid 1g inj', _type: '항암제' },
  { code: 'XTRZMAB', name: 'Herceptin 150mg inj', _type: '항암제' },
  { code: 'XCARBO', name: 'Carboplatin 150mg inj', _type: '항암제' },
  { code: 'XDOCETAX', name: 'Docetaxel 80mg inj', _type: '항암제' },
  // 일반약 - 진통소염제
  { code: '123456', name: '타이레놀정 500mg', _type: '일반약' },
  { code: '123457', name: '부루펜정 400mg', _type: '일반약', ingredient: 'Ibuprofen 이부프로펜' },
  { code: '123458', name: '아스피린장용정 100mg', _type: '일반약' },
  // 일반약 - 항생제
  { code: '234567', name: '아목시실린캡슐 250mg', _type: '일반약' },
  { code: '234568', name: '세파클러캡슐 250mg', _type: '일반약' },
  { code: '234569', name: '레보플록사신정 500mg', _type: '일반약' },
  // 일반약 - 소화기계
  { code: '345678', name: '오메프라졸캡슐 20mg', _type: '일반약' },
  { code: '345679', name: '란소프라졸캡슐 30mg', _type: '일반약' },
  // 일반약 - 당뇨약
  { code: '456789', name: '메트포르민정 500mg', _type: '일반약' },
  { code: '456790', name: '글리메피리드정 2mg', _type: '일반약' },
  // 일반약 - 고지혈증약
  { code: '567890', name: '아토르바스타틴정 10mg', _type: '일반약' },
  { code: '567891', name: '로수바스타틴정 20mg', _type: '일반약' },
  // 일반약 - 고혈압약
  { code: '678901', name: '암로디핀정 5mg', _type: '일반약' },
  { code: '678902', name: '로사르탄정 50mg', _type: '일반약' },
  // 일반약 - 기타
  { code: '789012', name: '생리식염수주사액 1L', _type: '일반약' },
];

const cache = buildNewsMatchCache(hospitalDrugs);

console.log('\n원내 약품 캐시 (' + cache.length + '개):');
cache.forEach(c => {
  console.log('  -', c.drug.name, '| norm:', c.norm, '| eng:', c.eng, '| kor:', c.kor);
});

// 테스트 뉴스 항목들
const testNews = [
  // 항암제 테스트
  {
    title: '[공급중단] Paclitaxel 100mg Injection (한국파클리탁셀)',
    summary: '업체: 한국제약\n중단사유: 원료수급 문제\nEDI코드: 651600010',
    expected: 'XPTAX100',
    description: 'EDI 코드 정확 매칭'
  },
  {
    title: '[회수/중지] Avastin 400mg/16ml (로슈)',
    summary: '회수사유: 품질 문제\n업체: 로슈',
    expected: 'XBEVA4',
    description: '영문명 매칭 (Avastin)'
  },
  {
    title: '[공급중단] 시스플라틴주사 50mg (대한시스플라틴)',
    summary: '중단일: 2024-01-15',
    expected: 'XCISP50',
    description: '한글명 매칭 (시스플라틴)'
  },
  {
    title: '[공급중단] 카보플라틴주 150mg',
    summary: '중단사유: 생산 중단',
    expected: 'XCARBO',
    description: '한글명 매칭 (카보플라틴)'
  },
  {
    title: '[회수/중지] 도세탁셀주사액 80mg',
    summary: '회수등급: 2등급',
    expected: 'XDOCETAX',
    description: '한글명 매칭 (도세탁셀)'
  },
  {
    title: '[회수/중지] 젬자액 1g 주사제 (일라이릴리)',
    summary: '회수등급: 2등급',
    expected: 'XGEMCIT1L',
    description: '약품명 유사 매칭 (젬자 → Gemzar)'
  },
  {
    title: '[희귀의약품 지정] 허셉틴주 150mg',
    summary: '대상질환: 유방암\n지정일: 2024-01-01',
    expected: 'XTRZMAB',
    description: '한글명 매칭 (허셉틴 → Herceptin)'
  },
  
  // 일반약 테스트 - 진통소염제
  {
    title: '[공급중단] 타이레놀정 500mg (한국얀센)',
    summary: '중단사유: 생산 중단',
    expected: '123456',
    description: '일반약 매칭 (타이레놀)'
  },
  {
    title: '[회수/중지] 이부프로펜정 400mg (동아제약)',
    summary: '회수사유: 포장 불량',
    expected: '123457',
    description: '일반약 매칭 (이부프로펜 → 부루펜)'
  },
  {
    title: '[공급중단] 아스피린장용정 100mg',
    summary: '중단일: 2024-02-01',
    expected: '123458',
    description: '일반약 매칭 (아스피린)'
  },
  
  // 일반약 테스트 - 항생제
  {
    title: '[회수/중지] 아목시실린캡슐 250mg (유한양행)',
    summary: '회수등급: 3등급',
    expected: '234567',
    description: '일반약 매칭 (아목시실린)'
  },
  {
    title: '[공급중단] 세파클러캡슐 250mg',
    summary: '중단사유: 원료 부족',
    expected: '234568',
    description: '일반약 매칭 (세파클러)'
  },
  {
    title: '[회수/중지] 레보플록사신정 500mg (동아에스티)',
    summary: '회수사유: 품질 문제',
    expected: '234569',
    description: '일반약 매칭 (레보플록사신)'
  },
  
  // 일반약 테스트 - 소화기계
  {
    title: '[공급중단] 오메프라졸캡슐 20mg',
    summary: '중단일: 2024-03-01',
    expected: '345678',
    description: '일반약 매칭 (오메프라졸)'
  },
  {
    title: '[회수/중지] 란소프라졸캡슐 30mg (한국유나이티드)',
    summary: '회수등급: 2등급',
    expected: '345679',
    description: '일반약 매칭 (란소프라졸)'
  },
  
  // 일반약 테스트 - 당뇨약
  {
    title: '[공급중단] 메트포르민정 500mg (유한양행)',
    summary: '중단사유: 생산 중단',
    expected: '456789',
    description: '일반약 매칭 (메트포르민)'
  },
  {
    title: '[회수/중지] 글리메피리드정 2mg',
    summary: '회수사유: 포장 불량',
    expected: '456790',
    description: '일반약 매칭 (글리메피리드)'
  },
  
  // 일반약 테스트 - 고지혈증약
  {
    title: '[공급중단] 아토르바스타틴정 10mg (한미약품)',
    summary: '중단일: 2024-04-01',
    expected: '567890',
    description: '일반약 매칭 (아토르바스타틴)'
  },
  {
    title: '[회수/중지] 로수바스타틴정 20mg',
    summary: '회수등급: 2등급',
    expected: '567891',
    description: '일반약 매칭 (로수바스타틴)'
  },
  
  // 일반약 테스트 - 고혈압약
  {
    title: '[공급중단] 암로디핀정 5mg (대웅제약)',
    summary: '중단사유: 원료 부족',
    expected: '678901',
    description: '일반약 매칭 (암로디핀)'
  },
  {
    title: '[회수/중지] 로사르탄정 50mg',
    summary: '회수사유: 품질 문제',
    expected: '678902',
    description: '일반약 매칭 (로사르탄)'
  },
  
  // 원내 없음 테스트
  {
    title: '[회수/중지] 위더셋정 10mg (위더제약)',
    summary: '회수사유: 포장 불량',
    expected: null,
    description: '원내 없음 - 매칭 안 됨 (정상)'
  },
  {
    title: '[공급중단] 비타민C정 500mg (종근당)',
    summary: '중단사유: 원료 부족',
    expected: null,
    description: '원내 없음 - 매칭 안 됨 (정상)'
  },
];

console.log('\n' + '='.repeat(80));
console.log('테스트 실행');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testNews.forEach((news, idx) => {
  console.log('\n[테스트 ' + (idx + 1) + '] ' + news.description);
  console.log('뉴스:', news.title);
  
  const result = getMatchedHospitalDrug(news, cache);
  const resultCode = result ? result.code : null;
  
  if (resultCode === news.expected) {
    console.log('✅ PASS - 예상:', news.expected, '/ 결과:', resultCode);
    passed++;
  } else {
    console.log('❌ FAIL - 예상:', news.expected, '/ 결과:', resultCode);
    failed++;
  }
});

console.log('\n' + '='.repeat(80));
console.log('테스트 결과: ' + passed + '개 성공, ' + failed + '개 실패');
console.log('='.repeat(80));

// 추가 엣지 케이스 테스트
console.log('\n\n추가 엣지 케이스 테스트:');
console.log('-'.repeat(80));

const edgeCases = [
  { name: 'Pac', expected: false, reason: '너무 짧음 (3자)' },
  { name: 'Paclitax', expected: true, reason: '충분한 길이 (8자)' },
  { name: '타이', expected: false, reason: '한글 너무 짧음 (2자)' },
  { name: '타이레놀', expected: true, reason: '한글 충분 (4자)' },
  { name: 'Avastin 100mg', expected: true, reason: '용량 다르지만 기본명 일치' },
];

edgeCases.forEach(test => {
  const newsItem = { title: '[테스트] ' + test.name, summary: '' };
  const result = getMatchedHospitalDrug(newsItem, cache);
  const matched = result !== null;
  const status = matched === test.expected ? '✅' : '❌';
  console.log(status, test.name, '→', matched ? '매칭됨' : '매칭안됨', '(' + test.reason + ')');
});

console.log('\n테스트 완료!\n');
