-- Nomos, Agora — 찬반·한 줄 의견 저장소 (Cloudflare D1)
-- 개인을 알아볼 수 있는 값은 저장하지 않음. who = 그날만 쓰는 무작위 salt 와 섞은 해시 (48시간 뒤 삭제)

-- 하루 한 표 중복 확인용 (48시간 뒤 삭제)
CREATE TABLE IF NOT EXISTS votes (
  day TEXT NOT NULL,
  who TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('Y', 'N')),
  ts INTEGER NOT NULL,
  PRIMARY KEY (day, who, bill_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_ts ON votes (ts);

-- 법안별 누적 찬반 (숫자만 보관)
CREATE TABLE IF NOT EXISTS tallies (
  bill_id TEXT PRIMARY KEY,
  yes INTEGER NOT NULL DEFAULT 0,
  no INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL
);

-- 한 줄 의견. 작성자 정보는 없음
-- hidden: 0 = 보임, 1 = 신고 누적으로 자동 숨김(운영자 확인 대기)
-- reviewed: 1 = 운영자가 확인해 복구함 (이후 신고로 다시 숨겨지지 않음)
CREATE TABLE IF NOT EXISTS opinions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('Y', 'N')),
  text TEXT NOT NULL,
  ts INTEGER NOT NULL,
  reports INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  reviewed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_opinions_bill ON opinions (bill_id, hidden, ts);
CREATE INDEX IF NOT EXISTS idx_opinions_reports ON opinions (reports);

-- 같은 사람이 같은 글을 여러 번 신고하지 못하게 (48시간 뒤 삭제)
CREATE TABLE IF NOT EXISTS reports (
  day TEXT NOT NULL,
  who TEXT NOT NULL,
  opinion_id INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  PRIMARY KEY (day, who, opinion_id)
);

CREATE TABLE IF NOT EXISTS salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL);

-- 이전 '관심' 시험판 테이블 (배포된 적 없음)
DROP TABLE IF EXISTS interests;
