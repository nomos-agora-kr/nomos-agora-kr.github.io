#!/usr/bin/env python3
"""목업 데이터 생성기 — 가상의 의원·정당·법안으로 public/data/ 를 채운다.

실제 인물/정당/표결과 무관한 샘플이며, meta.sample = true 로 표시되어
프론트엔드 상단에 '샘플 데이터' 배너가 뜬다.
실데이터는 scripts/sync_bills.py 가 같은 스키마로 덮어쓴다.

사용: python3 scripts/make_mock_data.py
"""
from __future__ import annotations

import json
import random
import shutil
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data"
rng = random.Random(22)
TODAY = date(2026, 11, 25)

PARTIES = [  # (이름, 색, 의석)
    ("가람당", "#3b82f6", 162),
    ("누리당", "#ef4444", 104),
    ("다온당", "#14b8a6", 14),
    ("라온당", "#f59e0b", 8),
    ("바름당", "#a855f7", 4),
    ("무소속", "#94a3b8", 8),
]
SURNAMES = list("김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허남심노하곽성차주우구")
GIVEN = list("민서준도하지윤우현수영진주원재성은태경동혜선기상연희정소예유채호석철혁한빈아")

REGIONS = {
    "서울": ["종로구", "중구성동구갑", "용산구", "광진구을", "동대문구갑", "중랑구을", "성북구갑", "강북구을", "도봉구갑", "노원구을",
             "은평구갑", "서대문구을", "마포구갑", "양천구을", "강서구병", "구로구갑", "금천구", "영등포구을", "동작구갑", "관악구을",
             "서초구갑", "강남구을", "송파구병", "강동구갑"],
    "부산": ["중구영도구", "서구동구", "부산진구갑", "동래구", "남구", "북구을", "해운대구갑", "사하구을", "금정구", "연제구", "수영구", "사상구"],
    "대구": ["중구남구", "동구군위군갑", "서구", "북구을", "수성구갑", "달서구병", "달성군"],
    "인천": ["중구강화군옹진군", "동구미추홀구갑", "연수구을", "남동구갑", "부평구을", "계양구갑", "서구병"],
    "광주": ["동구남구갑", "서구을", "북구갑", "광산구을"],
    "대전": ["동구", "중구", "서구갑", "유성구을", "대덕구"],
    "울산": ["중구", "남구갑", "동구", "북구", "울주군"],
    "세종": ["세종시갑", "세종시을"],
    "경기": ["수원시갑", "수원시정", "성남시분당구을", "의정부시갑", "안양시동안구을", "부천시병", "광명시갑", "평택시을", "안산시을",
             "고양시정", "용인시병", "파주시갑", "김포시을", "화성시병", "남양주시갑", "시흥시을", "하남시갑", "이천시", "오산시", "구리시"],
    "강원": ["춘천시철원군화천군양구군갑", "원주시을", "강릉시", "동해시태백시삼척시정선군"],
    "충북": ["청주시상당구", "청주시흥덕구", "충주시", "제천시단양군"],
    "충남": ["천안시갑", "천안시을", "공주시부여군청양군", "아산시을", "서산시태안군", "당진시"],
    "전북": ["전주시갑", "전주시병", "군산시김제시부안군갑", "익산시을", "정읍시고창군"],
    "전남": ["목포시", "여수시갑", "순천시광양시곡성군구례군갑", "나주시화순군", "해남군완도군진도군"],
    "경북": ["포항시북구", "경주시", "김천시", "안동시예천군", "구미시갑", "경산시", "영천시청도군"],
    "경남": ["창원시의창구", "창원시성산구", "진주시갑", "통영시고성군", "김해시을", "양산시갑", "거제시"],
    "제주": ["제주시갑", "제주시을", "서귀포시"],
}

COMMITTEES = [
    ("C01", "법제사법위원회", 18), ("C02", "정무위원회", 24), ("C03", "기획재정위원회", 26),
    ("C04", "교육위원회", 16), ("C05", "과학기술정보방송통신위원회", 20), ("C06", "외교통일위원회", 21),
    ("C07", "국방위원회", 17), ("C08", "행정안전위원회", 22), ("C09", "문화체육관광위원회", 16),
    ("C10", "농림축산식품해양수산위원회", 19), ("C11", "산업통상자원중소벤처기업위원회", 22),
    ("C12", "보건복지위원회", 22), ("C13", "기후에너지환경노동위원회", 16), ("C14", "국토교통위원회", 30),
    ("C15", "정보위원회", 12), ("C16", "여성가족위원회", 17), ("C17", "운영위원회", 28),
]

BILLS = [  # (법안명, 소관위, 쉬운 요약)
    ("주택임대차보호법 일부개정법률안", "C01", "전세 계약이 끝날 때 보증금을 더 빨리 돌려받도록 하는 내용이에요."),
    ("근로기준법 일부개정법률안", "C13", "5인 미만 사업장에도 연차휴가 일부를 적용하자는 내용이에요."),
    ("소득세법 일부개정법률안", "C03", "월세 세액공제 한도를 늘리자는 내용이에요."),
    ("도로교통법 일부개정법률안", "C08", "어린이보호구역 단속 장비를 늘리고 과태료 기준을 손보는 내용이에요."),
    ("국민건강보험법 일부개정법률안", "C12", "희귀질환 치료비 본인부담을 줄이자는 내용이에요."),
    ("전기통신사업법 일부개정법률안", "C05", "통신사 요금제 비교 정보를 의무적으로 공개하게 하는 내용이에요."),
    ("고등교육법 일부개정법률안", "C04", "대학 등록금 산정 근거를 공개하도록 하는 내용이에요."),
    ("공직선거법 일부개정법률안", "C08", "투표소 안내를 쉬운 말과 점자로도 제공하자는 내용이에요."),
    ("식품위생법 일부개정법률안", "C12", "배달 음식 원산지 표시 방법을 구체화하는 내용이에요."),
    ("자본시장과 금융투자업에 관한 법률 일부개정법률안", "C02", "불공정 거래에 대한 과징금 기준을 정비하는 내용이에요."),
    ("국가재정법 일부개정법률안", "C03", "예비타당성 조사 면제 요건을 좁히는 내용이에요."),
    ("영유아보육법 일부개정법률안", "C12", "어린이집 보육교사 1인당 아동 수를 줄이자는 내용이에요."),
    ("산업안전보건법 일부개정법률안", "C13", "폭염 시 작업중지 기준을 법에 명시하는 내용이에요."),
    ("저작권법 일부개정법률안", "C09", "AI 학습에 쓰인 저작물 표시 의무를 다루는 내용이에요."),
    ("공공주택 특별법 일부개정법률안", "C14", "청년·신혼부부 공공임대 공급 비율을 정하는 내용이에요."),
    ("여객자동차 운수사업법 일부개정법률안", "C14", "농어촌 수요응답형 버스 운영 근거를 마련하는 내용이에요."),
    ("개인정보 보호법 일부개정법률안", "C02", "개인정보 유출 시 이용자 통지 기한을 짧게 하는 내용이에요."),
    ("병역법 일부개정법률안", "C07", "대체복무 심사 절차를 간소화하는 내용이에요."),
    ("재난 및 안전관리 기본법 일부개정법률안", "C08", "다중밀집 행사 안전관리 책임 주체를 명확히 하는 내용이에요."),
    ("농업소득의 보전에 관한 법률 일부개정법률안", "C10", "기후 피해 농가 직불금 지급 기준을 정하는 내용이에요."),
    ("수산업법 일부개정법률안", "C10", "불법 조업 신고 포상금을 늘리는 내용이에요."),
    ("중소기업기본법 일부개정법률안", "C11", "소상공인 범위 기준을 물가에 맞게 조정하는 내용이에요."),
    ("전기사업법 일부개정법률안", "C11", "소규모 태양광 전력 거래 절차를 단순화하는 내용이에요."),
    ("탄소중립기본법 일부개정법률안", "C13", "2035 감축 목표를 법에 명시하자는 내용이에요."),
    ("가정폭력방지법 일부개정법률안", "C16", "피해자 보호시설 지원 기준을 높이는 내용이에요."),
    ("국가정보원법 일부개정법률안", "C15", "정보기관 예산 보고 범위를 넓히는 내용이에요."),
    ("남북교류협력에 관한 법률 일부개정법률안", "C06", "민간 교류 신고 절차를 바꾸는 내용이에요."),
    ("국회법 일부개정법률안", "C17", "상임위 회의록 공개 시점을 앞당기는 내용이에요."),
    ("형사소송법 일부개정법률안", "C01", "피의자 신문 시 영상녹화 범위를 넓히는 내용이에요."),
    ("민법 일부개정법률안", "C01", "반려동물을 물건과 구분해 법적으로 다루자는 내용이에요."),
    ("방송법 일부개정법률안", "C05", "공영방송 이사 추천 구조를 바꾸는 내용이에요."),
    ("학교폭력예방법 일부개정법률안", "C04", "학교폭력 조사에 외부 전문가 참여를 늘리는 내용이에요."),
    ("장애인복지법 일부개정법률안", "C12", "장애인 활동지원 시간 산정 기준을 바꾸는 내용이에요."),
    ("부가가치세법 일부개정법률안", "C03", "간이과세 기준 금액을 조정하는 내용이에요."),
    ("국토의 계획 및 이용에 관한 법률 일부개정법률안", "C14", "노후 신도시 용적률 특례 범위를 정하는 내용이에요."),
    ("전자금융거래법 일부개정법률안", "C02", "보이스피싱 피해금 지급정지 절차를 빠르게 하는 내용이에요."),
    ("문화예술진흥법 일부개정법률안", "C09", "지역 문화시설 운영비 지원 근거를 두는 내용이에요."),
    ("군인복지기본법 일부개정법률안", "C07", "초급 간부 주거 지원을 늘리는 내용이에요."),
    ("지방자치법 일부개정법률안", "C08", "주민조례 발안 요건을 낮추는 내용이에요."),
    ("의료법 일부개정법률안", "C12", "비대면 진료 허용 범위를 법으로 정하는 내용이에요."),
    ("청소년 보호법 일부개정법률안", "C16", "청소년 대상 유해 광고 차단 의무를 강화하는 내용이에요."),
    ("정보통신망법 일부개정법률안", "C05", "딥페이크 영상 삭제 요청 절차를 마련하는 내용이에요."),
    ("상법 일부개정법률안", "C01", "이사의 충실의무 대상을 주주까지 넓히는 내용이에요."),
    ("국민연금법 일부개정법률안", "C12", "출산·군복무 크레딧 인정 기간을 늘리는 내용이에요."),
    ("교육기본법 일부개정법률안", "C04", "디지털 기초역량 교육을 기본 교육과정에 넣는 내용이에요."),
    ("항공안전법 일부개정법률안", "C14", "조종사 피로관리 기준을 강화하는 내용이에요."),
    ("가맹사업법 일부개정법률안", "C02", "가맹점주 단체 협상권을 명시하는 내용이에요."),
    ("에너지이용 합리화법 일부개정법률안", "C11", "건물 에너지 효율 등급 공개를 확대하는 내용이에요."),
]
STAGES_PENDING = ["proposed", "committee", "judiciary", "plenary"]


def make_name(used: set[str]) -> str:
    while True:
        n = rng.choice(SURNAMES) + rng.choice(GIVEN) + rng.choice(GIVEN)
        if n not in used:
            used.add(n)
            return n


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "bills").mkdir(parents=True)
    (OUT / "member_bills").mkdir(parents=True)

    districts = [f"{r} {d}" for r, ds in REGIONS.items() for d in ds]
    rng.shuffle(districts)
    used: set[str] = set()
    members = []
    seq = 0
    for party, _c, seats in PARTIES:
        for i in range(seats):
            seq += 1
            prop = rng.random() < 0.15 and party != "무소속"
            members.append({
                "id": f"M{seq:04d}",
                "name": make_name(used),
                "party": party,
                "district": "비례대표" if prop else (districts.pop() if districts else f"경기 가상시{seq}"),
                "elect": "비례대표" if prop else "지역구",
                "terms": rng.choice(["초선", "초선", "재선", "3선", "4선"]),
                "committees": [],
                "photo": None,
            })
    # 동명이인 1쌍(정당 다름) — 정규화 테스트용
    members[-20]["name"] = members[3]["name"]

    by_party: dict[str, list[dict]] = {}
    for m in members:
        by_party.setdefault(m["party"], []).append(m)

    # 위원회 배정: 정당 의석 비율대로
    committees = []
    pool = members[:]
    rng.shuffle(pool)
    assigned_count = {m["id"]: 0 for m in members}
    for cid, cname, size in COMMITTEES:
        seats_alloc = []
        for party, _c, seats in PARTIES:
            k = max(1 if seats >= 8 else 0, round(size * seats / 300))
            seats_alloc.append((party, k))
        cmembers: list[dict] = []
        for party, k in seats_alloc:
            cands = sorted(by_party[party], key=lambda m: (assigned_count[m["id"]], rng.random()))
            cmembers += cands[:k]
        cmembers = cmembers[:size]
        for m in cmembers:
            assigned_count[m["id"]] += 1
        majority = [m for m in cmembers if m["party"] == "가람당"]
        second = [m for m in cmembers if m["party"] == "누리당"]
        chair_pool = majority if cid not in ("C01", "C17") else second  # 일부 위원장은 제2당
        chair = chair_pool[0]
        secretaries: dict[str, list[str]] = {}
        for grp in (majority, second):
            cands = [m for m in grp if m["id"] != chair["id"]]
            if cands:
                secretaries[grp[0]["party"]] = [cands[0]["id"]]
        others3 = [m for m in cmembers if m["party"] not in ("가람당", "누리당")]
        if others3:
            secretaries[others3[0]["party"]] = [others3[0]["id"]]
        sec_ids = {i for v in secretaries.values() for i in v}
        for m in cmembers:
            role = "위원장" if m["id"] == chair["id"] else ("간사" if m["id"] in sec_ids else "위원")
            m["committees"].append({"id": cid, "name": cname, "role": role})
        committees.append({
            "id": cid, "name": cname, "chair": chair["id"],
            "secretaries": secretaries,
            "members": [m["id"] for m in cmembers if m["id"] != chair["id"]],
        })

    cmap = {c["id"]: c for c in committees}
    cname_map = {cid: name for cid, name, _ in COMMITTEES}
    member_bills = {m["id"]: {"lead": [], "co": [], "votes": []} for m in members}
    index = []

    for i, (title, cid, summary) in enumerate(BILLS):
        bill_id = f"PRC_SAMPLE{i:04d}"
        no = 2210000 + i * 37
        if i < 16:
            stage = "voted"
        elif i < 20:
            stage = "plenary"
        else:
            stage = STAGES_PENDING[i % 3]
        propose = TODAY - timedelta(days=rng.randint(60, 420) if stage in ("voted", "plenary") else rng.randint(5, 260))
        comm_dt = propose + timedelta(days=rng.randint(3, 12))
        jud_dt = comm_dt + timedelta(days=rng.randint(30, 140))
        ple_dt = jud_dt + timedelta(days=rng.randint(10, 60))
        jud_dt = min(jud_dt, TODAY - timedelta(days=3))
        timeline = [{"stage": "proposed", "date": propose.isoformat(), "label": "발의·접수"}]
        if stage != "proposed":
            timeline.append({"stage": "committee", "date": comm_dt.isoformat(), "label": f"{cname_map[cid]} 회부"})
        if stage in ("judiciary", "plenary", "voted"):
            timeline.append({"stage": "judiciary", "date": jud_dt.isoformat(), "label": "법제사법위원회 체계·자구 심사 회부"})
        if stage in ("plenary", "voted"):
            ple_dt = min(ple_dt, TODAY - timedelta(days=1))
            timeline.append({"stage": "plenary", "date": ple_dt.isoformat(), "label": "본회의 부의"})
        stage_since = timeline[-1]["date"]

        party_lead = rng.choice(["가람당"] * 5 + ["누리당"] * 4 + ["다온당", "라온당"])
        lead = rng.choice(by_party[party_lead])
        n_co = rng.randint(9, 24)
        co_pool = [m for m in members if m["id"] != lead["id"] and (m["party"] == party_lead or rng.random() < 0.08)]
        co = rng.sample(co_pool, min(n_co, len(co_pool)))

        bill = {
            "id": bill_id, "no": no, "title": title, "summary": summary,
            "stage": stage, "committee": cname_map[cid], "committee_id": cid,
            "propose_date": propose.isoformat(), "stage_since": stage_since,
            "lead": [lead["id"]], "co": [m["id"] for m in co], "unmatched": [],
            "timeline": timeline, "link": None,
        }
        votes = None
        if stage == "voted":
            vote_date = (ple_dt + timedelta(days=rng.randint(0, 5)))
            vote_date = min(vote_date, TODAY)
            bill["timeline"].append({"stage": "voted", "date": vote_date.isoformat(), "label": "본회의 표결"})
            bill["stage_since"] = vote_date.isoformat()
            stance = {p: rng.choice(["Y", "Y", "Y", "N", "split"]) for p, *_ in PARTIES}
            stance[party_lead] = "Y"
            votes = {}
            for m in members:
                r = rng.random()
                if r < 0.11:
                    v = "X"
                elif r < 0.14:
                    v = "A"
                else:
                    s = stance[m["party"]]
                    v = s if s in ("Y", "N") else rng.choice(["Y", "N", "A"])
                    if rng.random() < 0.04:
                        v = "N" if v == "Y" else "Y"
                votes[m["id"]] = v
            tally = {k: sum(1 for v in votes.values() if v == k) for k in "YNAX"}
            bill["tally"] = {"yes": tally["Y"], "no": tally["N"], "abstain": tally["A"], "absent": tally["X"]}
            bill["result"] = "원안가결" if tally["Y"] > (300 - tally["X"]) / 2 else "부결"
            bill["vote_date"] = vote_date.isoformat()
            bill["votes"] = votes

        (OUT / "bills" / f"{bill_id}.json").write_text(json.dumps(bill, ensure_ascii=False, separators=(",", ":")))
        brief = {"id": bill_id, "no": no, "title": title, "stage": stage}
        member_bills[lead["id"]]["lead"].append(brief)
        for m in co:
            member_bills[m["id"]]["co"].append(brief)
        if votes:
            for mid, v in votes.items():
                member_bills[mid]["votes"].append({**brief, "vote": v, "date": bill["vote_date"]})
        index.append({
            "id": bill_id, "no": no, "title": title, "summary": summary, "stage": stage,
            "committee": cname_map[cid], "propose_date": bill["propose_date"], "stage_since": bill["stage_since"],
            "proposer_count": 1 + len(co), "voted": stage == "voted", "lead_name": lead["name"],
            "result": bill.get("result"),
        })

    for mid, data in member_bills.items():
        data["votes"].sort(key=lambda x: x["date"], reverse=True)
        (OUT / "member_bills" / f"{mid}.json").write_text(json.dumps({"id": mid, **data}, ensure_ascii=False, separators=(",", ":")))

    meta = {
        "updated": f"{TODAY.isoformat()}T09:00:00+09:00", "sample": True, "age": 22,
        "source": "열린국회정보 (open.assembly.go.kr)",
    }
    pending = sum(1 for b in index if b["stage"] in STAGES_PENDING)
    (OUT / "members.json").write_text(json.dumps({
        "meta": meta, "parties": {p: c for p, c, _ in PARTIES}, "members": members,
    }, ensure_ascii=False, separators=(",", ":")))
    (OUT / "committees.json").write_text(json.dumps({"meta": meta, "committees": committees}, ensure_ascii=False, separators=(",", ":")))
    index.sort(key=lambda b: b["stage_since"], reverse=True)
    (OUT / "bills_index.json").write_text(json.dumps({
        "meta": {**meta, "total": len(index), "pending": pending}, "bills": index,
    }, ensure_ascii=False, separators=(",", ":")))
    print(f"members={len(members)} committees={len(committees)} bills={len(index)} pending={pending} → {OUT}")


if __name__ == "__main__":
    main()
