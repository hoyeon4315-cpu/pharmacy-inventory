-- 약제부 재고관리 시스템 D1 스키마
-- 실행: wrangler d1 execute pharmacy-db --file=schema.sql

-- 앱 상태 (항암제/일반약 각각 별도 행)
CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY,          -- 'chemo' 또는 'general'
  data TEXT NOT NULL DEFAULT '{}',  -- JSON: state 객체 (dailyData, dailyUsage 제외)
  daily_data TEXT DEFAULT '{}',     -- JSON: dailyData (최근 7일 스냅샷)
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 관리자 인증
CREATE TABLE IF NOT EXISTS admin_config (
  id TEXT PRIMARY KEY,          -- 'chemo' 또는 'general'
  password_hash TEXT NOT NULL   -- SHA-256 해시
);

-- AI 메모리 (사용자가 알려준 약품 정보, 메모 등)
CREATE TABLE IF NOT EXISTS ai_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'user_note',
  drug_code TEXT,
  drug_name TEXT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1
);

-- 재고 히스토리 (일별 약품별 요약, AI 수요예측용 365일 보관)
CREATE TABLE IF NOT EXISTS inventory_history (
  data_type TEXT NOT NULL,
  date TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (data_type, date)
);

-- 항암제 일별 통계 (입원MIX+외래집계 기반, AI 분석용 365일 보관)
CREATE TABLE IF NOT EXISTS chemo_daily_stats (
  date TEXT PRIMARY KEY,
  stats TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 초기 데이터
INSERT OR IGNORE INTO app_state (id, data, daily_data, updated_at)
VALUES ('chemo', '{}', '{}', datetime('now'));
INSERT OR IGNORE INTO app_state (id, data, daily_data, updated_at)
VALUES ('general', '{}', '{}', datetime('now'));
