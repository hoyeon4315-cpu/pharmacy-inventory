# 뉴스 원내/원외 약품 매칭 계획

## 상태: 계획 완료, 구현 대기

## 목표
뉴스 탭(공급중단/회수/희귀/필수의약품)의 각 항목에 **원내** 배지를 붙여
병원 보유 약품과 관련된 뉴스를 즉시 식별할 수 있도록 한다.

---

## 현황 파악

### 보유 데이터
- `state.drugMaster[]` — 항암제 마스터: `{ code, name, spec, unit }`
- `state.generalDrugMaster[]` — 일반약 마스터: `{ code, name, spec, unit }`
- 현재고(`state.inventory[]`)가 있으면 거기서도 약품명 추출 가능

### 뉴스 약품명 형태 (식약처 공식명)
```
[공급중단] 헤파박스-진티에프프리필드시린지주(비형간염백신(유전자재조합)치메로살프리) ((주)얀센백신)
[회수/중지] 엔탭허브골쇄보 ((주)엔탭허브)
[필수의약품 지정] 에리스로마이신 캡슐제
```

### 병원 내 약품명 형태 (drugMaster)
```
키네레트주(아나킨라)   ← 브랜드명(성분명)
젬자주사200mg         ← 브랜드명+함량
시스플라틴주          ← 성분명 기반
```

---

## 매칭 전략 (3단계, 클라이언트 사이드)

### 1단계: EDI코드 직접 매칭 (가장 정확)
- 공급중단 뉴스에 `EDI코드` 포함됨 (8자리 이상)
- drugMaster의 `code` 필드와 비교
- **단, 현재 drugMaster에 EDI코드가 등록된 경우만 작동**

### 2단계: 핵심 약품명 포함 매칭
공식명에서 핵심 키워드를 추출해 drugMaster.name과 비교:
```
정규화 규칙:
  - 괄호 내용 제거: "헤파박스-진티에프(...)" → "헤파박스-진티에프"
  - 제형/함량 제거: "주사", "정", "캡슐", "mg", "ml" 등
  - 소문자 통일, 공백/특수문자 제거
  - 숫자 앞 내용이 핵심 키워드

매칭 방식: A가 B를 포함하거나 B가 A를 포함 (최소 4글자 이상)
```

### 3단계: 성분명 역방향 매칭
- 괄호 안 성분명 추출: "키네레트주(아나킨라)" → "아나킨라"
- 뉴스 약품명에서 성분명이 발견되면 매칭

---

## 구현 위치: 클라이언트 사이드 (index.html만 수정)

서버(news.js) 수정 불필요. 뉴스 렌더링 시 실시간 매칭.

```javascript
// 약품명 정규화
function normalizeDrugName(name) {
  return name
    .replace(/\(.*?\)/g, '')        // 괄호 제거
    .replace(/주사|정제|캡슐|시럽|주|정|액|산|크림/g, '')
    .replace(/\d+(\.\d+)?(mg|ml|mcg|ug|g|%)/gi, '')
    .replace(/[^가-힣a-zA-Z]/g, '') // 한글/영문만
    .toLowerCase()
    .trim();
}

// 원내 약품 여부 판별
function isHospitalDrug(newsTitle) {
  const allDrugs = [
    ...(state.drugMaster || []),
    ...(state.generalDrugMaster || []),
    ...(state.inventory || [])
  ];

  const newsName = normalizeDrugName(newsTitle.replace(/^\[.*?\]\s*/, '').split('(')[0]);

  for (const drug of allDrugs) {
    const masterName = normalizeDrugName(drug.name);
    if (!masterName || masterName.length < 3) continue;

    // EDI 코드 매칭 (뉴스에 EDI코드 있을 때)
    // ...추가 예정

    // 이름 포함 매칭
    if (newsName.includes(masterName) || masterName.includes(newsName)) {
      return { matched: true, drugName: drug.name, category: ... };
    }
  }
  return { matched: false };
}
```

---

## UI 변경

### 뉴스 목록 배지
```
[회수/중지] 젬자주(젬시타빈) (한국릴리)  [원내]  2026-03-31
                                         ^^^^^^ 주황색 배지
```

### 뉴스 상세 펼쳤을 때
```
원내 약품: 젬자주사200mg (항암제)
```

### 대시보드 긴급 알림 카드 (고급)
원내 약품 관련 회수/공급중단 뉴스 발생 시:
```
[긴급] 원내 약품 관련 공급중단 2건
  · 젬자주(젬시타빈) - 공급중단
  · ...
```

---

## 의약품집 파일 업로드 방안 (선택)

현재 drugMaster는 수동 등록 또는 1.xlsx에서 자동 추출됨.
별도 의약품집 xlsx 업로드 기능을 추가할 수 있음:

| 컬럼 | 필수 | 설명 |
|------|------|------|
| 약품명 | O | 매칭의 핵심 |
| EDI코드 | 권장 | 정확 매칭용 |
| 분류 | O | 항암제/일반약 |
| 성분명 | 선택 | 3단계 매칭용 |

→ 설정 탭 > 약품 마스터 > "의약품집 xlsx 일괄등록" 버튼

---

## 이름 불일치 문제 대응

| 공식명 | 병원명 | 매칭 방법 |
|--------|--------|----------|
| 젬시타빈 주사 | 젬자주사200mg | 3단계(성분명) |
| 시스플라틴주사 | 시스플라틴주 | 2단계(포함) |
| 도세탁셀 주사제 | 탁소텔주(도세탁셀) | 3단계(성분명) |
| 에리스로마이신 캡슐제 | 에리스로마이신캡슐 | 2단계(포함) |

성분명 기반 역방향 매칭이 가장 범용적으로 유효함.

---

## 구현 순서

1. `normalizeDrugName()` 함수 작성
2. `getMatchedDrug(newsItem)` 함수 — 3단계 매칭 반환
3. `renderNewsPage()` 수정 — 원내 배지 추가
4. 대시보드 긴급 알림 카드 (선택)
5. 의약품집 일괄 업로드 (선택)

---

## 파일 수정 범위

| 파일 | 변경 내용 |
|------|----------|
| `public/index.html` | 매칭 함수, 뉴스 렌더링 배지, (선택) 대시보드 알림 |
| `functions/api/news.js` | 변경 없음 |
| `wrangler.toml` | 변경 없음 |

---

## 참고: 현재 drugMaster 데이터 확인 방법
브라우저 콘솔에서:
```javascript
state.drugMaster.slice(0,5).map(d => d.name)
state.generalDrugMaster.slice(0,5).map(d => d.name)
```
이 이름 형태를 보고 정규화 규칙을 조정해야 할 수 있음.
