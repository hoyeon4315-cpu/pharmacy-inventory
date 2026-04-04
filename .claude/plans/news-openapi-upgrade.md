# 공급뉴스 탭 공공데이터 API 연동 계획

## 상태: 계획 수립 완료, 구현 대기

## 목표
현재 Google News RSS + 식약처 HTML 크롤링 방식에서,
**공공데이터포털 OpenAPI**를 추가하여 정확하고 구조화된 의약품 공급 정보를 제공한다.

---

## 연동할 API 목록

### 1. 의약품 공급중단 (식약처 실시간 OpenAPI)
- **URL**: `http://apis.data.go.kr/1471000/MdcinPrdctnIncmeSuplyService2/getMdcinPrdctnIncmeSuplyList`
- **제공기관**: 식품의약품안전처 (MFDS)
- **제공정보**: 제품명(ITEM_NAME), 업체명(ENTP_NAME), 중단일(SUSPEND_DATE), 최종공급일(LAST_SUPPLY_DATE), 중단사유(SUSPEND_REASON), EDI코드
- **갱신주기**: 실시간
- **카테고리**: `supply_stop` / "공급중단"
- **공공데이터포털**: https://www.data.go.kr/data/15057899/openapi.do
- **참고**: 구 HIRA odcloud(연 1회 갱신) 대체. 동일 API 키(DATA_GO_KR_API_KEY) 사용.

### 2. 의약품 회수/판매중지 (MdcinRtrvlSleStpgeInfoService04) ✅ 확인 완료
- **URL**: `http://apis.data.go.kr/1471000/MdcinRtrvlSleStpgeInfoService04/getMdcinRtrvlSleStpgelList03`
- **제공정보**: 업체명, 품목명, 회수사유, 회수등급, 회수명령일자
- **응답 필드**: ENTRPS_NM, PRDUCT_NM, RTRVL_RSN_CN, RTRVL_GRAD, RTRVL_ORDR_DE, CONFN_DE
- **카테고리**: `recall` / "회수/중지"
- **공공데이터포털**: https://www.data.go.kr/data/15059114/openapi.do

### 3. 희귀의약품성분 (RareDrugCpntService01)
- **URL**: `http://apis.data.go.kr/1471000/RareDrugCpntService01/getRareDrugCpntInq01`
- **제공정보**: 제품명, 성분명, 대상질환, 지정일자, 지정취소일자, 제조소명
- **응답 필드**: RARE_DRUG_NO, MFTR_NM, TRGT_DISS_NM, PRDT_NM, MDCT_NM, DSGN_YMD, DSGN_RTRCN_YMD, CPNT_KOR_NM
- **카테고리**: `rare_drug` / "희귀의약품"
- **공공데이터포털**: https://www.data.go.kr/data/15073980/openapi.do

### 4. 필수의약품내역 (MdcEssntlItemInfoService03)
- **URL**: `https://apis.data.go.kr/1471000/MdcEssntlItemInfoService03/getMdcEssntlItemList03`
- **제공정보**: 필수의약품명, 적응증, 지정일자
- **응답 필드**: ESSNTL_ITEM_NAME, MED_EFFICACY, APPOINT_DATE
- **카테고리**: `essential` / "필수의약품"
- **공공데이터포털**: https://www.data.go.kr/data/15058207/openapi.do

---

## 사전 준비 (사용자 필요 작업)

1. **data.go.kr 회원가입** (이미 되어있을 수 있음)
2. **API 활용신청** (위 4개 API 각각)
   - 개발단계: 자동승인
   - 일일 10,000건 (충분)
3. **serviceKey 발급** → Cloudflare 환경변수에 저장

---

## 구현 계획

### Step 1: Cloudflare 환경변수 설정
```bash
# data.go.kr에서 발급받은 API 키 설정
wrangler pages secret put DATA_GO_KR_API_KEY
```

### Step 2: news.js 수정 - API 크롤링 함수 추가

```
functions/api/news.js 에 추가할 함수들:

1. crawlSupplyStop(apiKey)    - 공급중단 API 호출
2. crawlRecallOfficial(apiKey) - 회수/판매중지 API 호출
3. crawlRareDrug(apiKey)      - 희귀의약품 지정/취소 API 호출
4. crawlEssentialDrug(apiKey)  - 필수의약품 지정 API 호출
```

각 함수 공통 패턴:
- `fetch(url + '?serviceKey=' + apiKey + '&type=json&pageNo=1&numOfRows=20')`
- JSON 파싱 → 최근 건만 필터 (30일 이내)
- 통일된 뉴스 아이템 형식으로 변환

### Step 3: 뉴스 아이템 표시 형식

**목록 (접힌 상태):**
```
[공급중단] OOO정 500mg (XX제약) | 2026-03-28
[회수/중지] OOO주사 (YY바이오) - 1등급 | 2026-03-25
[희귀의약품] OOO캡슐 → 희귀의약품 지정 | 2026-03-20
```

**상세 (펼친 상태):**
```
약품명: OOO정 500mg
업체: XX제약
접수일: 2026-03-15
중단시작일: 2026-04-01
사유: 원료의약품 수급 불안정
---
[원문 보기] 버튼 (data.go.kr 또는 nedrug 링크)
```

### Step 4: UI 카테고리 필터 추가

현재 newsFilter select에 카테고리 추가:
- 전체 / 공급중단 / 회수/중지 / 희귀의약품 / 필수의약품 / 품절/품귀 / 뉴스

### Step 5: 병원 내 약품 매칭 (선택적 고급 기능)

drugMaster에 등록된 약품명과 API 데이터를 매칭하여:
- "우리 병원 해당" 배지 표시
- 대시보드에 긴급 알림 카드 추가

---

## 파일 수정 범위

| 파일 | 변경 내용 |
|------|----------|
| `functions/api/news.js` | OpenAPI 크롤링 함수 4개 추가, crawlNews()에 통합 |
| `public/index.html` | 뉴스 카테고리 필터 옵션 추가, 상세 표시 형식 개선 |
| `wrangler.toml` | (변경 없음, secret은 대시보드에서 설정) |

---

## 참고 소스

- 공공데이터포털: https://www.data.go.kr
- 식의약데이터포털: https://data.mfds.go.kr
- 의약품안전나라: https://nedrug.mfds.go.kr
- 희귀의약품 API: https://www.data.go.kr/data/15073980/openapi.do
- 회수/판매중지 API: https://www.data.go.kr/data/15059114/openapi.do
- 필수의약품 API: https://www.data.go.kr/data/15058207/openapi.do

---

## biz.kpis.or.kr 관련
- SPA(Cleopatra 엔진) 기반, 서버사이드 렌더링 없음
- 인증 필요, 외부 크롤링 불가
- 대안: 위의 공공데이터포털 API가 동일/유사 데이터를 제공
