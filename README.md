# 노모스, 아고라 (Nomos, Agora)

국회 법안 ↔ 의원 양방향 추적 대시보드. 공개된 국회 공식 기록(열린국회정보)을 평가 없이 그대로 보여줍니다.

- **표결 전 법안** → 위원회 심사 테이블 (위원장 정면 · 정당별 좌우 대칭 · 간사 최전방) + 계류 일수
- **표결 완료 법안** → 본회의장 반원 좌석도 (점 ↔ 프로필, 찬성만 선명, 호버 2.4배 확대)
- **의원 기록 파일** → 대표·공동발의, 본회의 표결 타임라인 (데스크톱 우측 / 모바일 하단 시트)
- 통합 검색 · 내 지역구 찾기 · 아무나 추적 · 공유 가능한 링크(`#/bill/{id}?m={의원코드}`)

## 구조 — 서버 없음, 비용 0원

```
GitHub Actions (평일 매시) ──► scripts/sync_bills.py ──► public/data/*.json 커밋
                                                       └► 변경 시에만 빌드 → GitHub Pages(CDN) 배포
브라우저 ──► 정적 JSON 지연 로드 (법안·의원 상세는 클릭 시)
```

| 파일 | 내용 |
|---|---|
| `members.json` | 의원 마스터 (MONA_CD, 정당, 지역구, 위원회·직책) |
| `committees.json` | 상임위별 위원장·간사·위원 |
| `bills_index.json` | 검색·목록용 경량 인덱스 |
| `bills/{BILL_ID}.json` | 발의자, 단계 타임라인, 의원별 표결 |
| `member_bills/{MONA_CD}.json` | 의원별 발의·표결 역인덱스 |

## 로컬 실행

```bash
npm install
npm run mock      # 가상 샘플 데이터 생성 (실제 인물 아님)
npm run dev
```

## 실데이터 연결

1. [열린국회정보](https://open.assembly.go.kr) 회원가입 → 인증키 발급
2. GitHub 저장소 → Settings → Secrets and variables → Actions → `ASSEMBLY_API_KEY` 등록
3. Settings → Pages → Source: **GitHub Actions**
4. Actions 탭 → `sync-and-deploy` → Run workflow (`members` 체크) — 첫 실행에서 샘플 데이터가 실데이터로 교체됩니다

필드 확인: `ASSEMBLY_API_KEY=... python3 scripts/sync_bills.py --inspect`

## 운영 메모

- **쉬운 요약**: API에 없으므로 `scripts/summaries.json`(`{"BILL_ID": "한 줄 요약"}`)에 수동 등록 시 반영
- **동명이인**: MONA_CD 우선 → 이름+정당 → 이름(유일할 때). 매칭 실패는 점선 칩으로 표시
- **계류 일수**: API 단계 날짜 우선, 없으면 이전 JSON과 비교해 단계가 바뀐 날 기록
- 의원별 표결은 한 번에 최대 150건씩 새로 수집 (`MAX_NEW_VOTE_FETCH`) — 첫 실행 후 몇 시간 내 채워짐
- 의원 사진: 현재 이니셜 아바타. 사진 URL 필드 확인 후 `photo` 경로 채우면 자동 표시

출처: 열린국회정보 (open.assembly.go.kr)
