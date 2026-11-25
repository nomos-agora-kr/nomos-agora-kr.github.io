#!/usr/bin/env python3
"""열린국회정보 Open API → 정적 JSON (public/data/) 동기화.

사용:
  ASSEMBLY_API_KEY=xxxx python3 scripts/sync_bills.py              # 법안·표결 갱신 (의원/위원회는 7일 지나면 자동 갱신)
  ASSEMBLY_API_KEY=xxxx python3 scripts/sync_bills.py --members    # 의원·위원회 강제 갱신
  ASSEMBLY_API_KEY=xxxx python3 scripts/sync_bills.py --inspect    # 각 API 첫 행의 필드명만 출력 (명세 확인용)

설계 원칙
- 규칙 기반·결정적: 같은 입력이면 같은 출력. AI 해석 없음.
- 변경된 파일만 다시 씀 → git diff 최소화.
- 계류 일수: API의 단계별 날짜를 우선 쓰고, 날짜가 없으면 이전 JSON과 비교해 단계가 바뀐 날을 기록.
- 동명이인: MONA_CD(의원코드)를 1순위로, 코드가 없을 때만 '이름+정당' → '이름(유일할 때)' 순으로 매칭.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

import requests

KST = timezone(timedelta(hours=9))
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data"
BASE = "https://open.assembly.go.kr/portal/openapi/"
AGE = os.environ.get("ASSEMBLY_AGE", "22")

API_MEMBERS = "nwvrqwxyaytdsfvhu"      # 국회의원 인적사항
API_COMMITTEE = "nktulghcadyhmiqxi"    # 위원회 위원 명단
API_BILLS = "nzmimeepazxkubdpn"        # 국회의원 발의법률안
API_BILL_VOTE = "ncocpgfiaoituanbr"    # 의안별 본회의 표결현황
API_MEMBER_VOTE = "nojepdqqaweusdfbi"  # 국회의원 본회의 표결정보
API_ALL_MEMBER = "ALLNAMEMBER"         # 국회의원 정보 통합 (사진 URL 포함)

# 정당 공식 색 (없는 정당은 프론트에서 이름 해시 색으로 대체)
PARTY_COLORS = {
    "더불어민주당": "#152484",
    "국민의힘": "#E61E2B",
    "조국혁신당": "#0073CF",
    "개혁신당": "#FF7210",
    "진보당": "#D6001C",
    "기본소득당": "#00D2C3",
    "사회민주당": "#F58400",
    "무소속": "#8A94A6",
}
CLOSED_WORDS = ("폐기", "철회", "반려")
VOTED_WORDS = ("가결", "부결")
VOTE_CODE = {"찬성": "Y", "반대": "N", "기권": "A", "불참": "X"}
MAX_NEW_VOTE_FETCH = int(os.environ.get("MAX_NEW_VOTE_FETCH", "150"))


# ---------------------------------------------------------------- API
class Api:
    def __init__(self, key: str):
        self.key = key
        self.s = requests.Session()
        self.calls = 0

    def page(self, code: str, p: int, size: int, **params: Any) -> tuple[int, list[dict]]:
        q = {"KEY": self.key, "Type": "json", "pIndex": p, "pSize": size, **params}
        for attempt in range(4):
            try:
                r = self.s.get(BASE + code, params=q, timeout=40)
                r.raise_for_status()
                data = r.json()
                break
            except (requests.RequestException, ValueError) as e:
                if attempt == 3:
                    raise
                print(f"  retry {code} p{p}: {e}", file=sys.stderr)
                time.sleep(2 * (attempt + 1))
        self.calls += 1
        time.sleep(0.15)
        if "RESULT" in data:  # 데이터 없음/오류는 최상위 RESULT 로 옴
            res = data["RESULT"]
            if res.get("CODE") == "INFO-200":
                return 0, []
            raise RuntimeError(f"{code}: {res}")
        body = data[code]
        head = body[0]["head"]
        total = int(head[0]["list_total_count"])
        result = head[1]["RESULT"]
        if result.get("CODE") not in ("INFO-000",):
            raise RuntimeError(f"{code}: {result}")
        return total, body[1].get("row", [])

    def all(self, code: str, size: int = 1000, **params: Any) -> list[dict]:
        total, rows = self.page(code, 1, size, **params)
        p = 1
        while len(rows) < total:
            p += 1
            _, more = self.page(code, p, size, **params)
            if not more:
                break
            rows += more
        return rows


# ---------------------------------------------------------------- helpers
def now_kst() -> datetime:
    return datetime.now(KST)


def d10(v: Any) -> str | None:
    if not v:
        return None
    s = str(v).strip()
    m = re.match(r"(\d{4})[-.]?(\d{2})[-.]?(\d{2})", s)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def split_codes(v: Any) -> list[str]:
    if not v:
        return []
    return [c.strip() for c in re.split(r"[,;\s]+", str(v)) if c.strip()]


def split_names(v: Any) -> list[str]:
    if not v:
        return []
    return [n.strip() for n in re.split(r"[,;·]+", str(v)) if n.strip()]


def read_json(p: Path) -> Any:
    try:
        return json.loads(p.read_text())
    except (OSError, ValueError):
        return None


def write_if_changed(p: Path, obj: Any, ignore_keys: Iterable[str] = ()) -> bool:
    """내용이 같으면 쓰지 않음. ignore_keys 는 비교에서 제외 (예: meta.updated)."""
    p.parent.mkdir(parents=True, exist_ok=True)
    new = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    old = read_json(p)
    if old is not None:
        def strip(o: Any) -> Any:
            if isinstance(o, dict):
                return {k: strip(v) for k, v in o.items() if k not in ignore_keys}
            return o
        if json.dumps(strip(old), ensure_ascii=False, sort_keys=True) == json.dumps(strip(obj), ensure_ascii=False, sort_keys=True):
            return False
    p.write_text(new)
    return True


def cid_for(name: str, code: Any = None) -> str:
    if code:
        return f"D{code}"
    return "C" + hashlib.md5(name.encode()).hexdigest()[:6]


# ---------------------------------------------------------------- members / committees
class Resolver:
    """의원 식별: 코드 → (이름,정당) → 이름(유일)"""

    def __init__(self, members: list[dict]):
        self.codes = {m["id"] for m in members}
        self.by_np: dict[tuple[str, str], list[str]] = {}
        self.by_n: dict[str, list[str]] = {}
        for m in members:
            self.by_np.setdefault((m["name"], m["party"]), []).append(m["id"])
            self.by_n.setdefault(m["name"], []).append(m["id"])

    def __call__(self, name: str | None = None, party: str | None = None, code: str | None = None) -> str | None:
        if code and code in self.codes:
            return code
        if name:
            name = re.sub(r"(의원|위원)$", "", name.strip())
            if party and len(self.by_np.get((name, party), [])) == 1:
                return self.by_np[(name, party)][0]
            if len(self.by_n.get(name, [])) == 1:
                return self.by_n[name][0]
        return None


def sync_members(api: Api) -> tuple[list[dict], list[dict]]:
    rows = api.all(API_MEMBERS)
    print(f"  members rows={len(rows)}")
    members = []
    for r in rows:
        code = r.get("MONA_CD")
        if not code:
            continue
        members.append({
            "id": code,
            "name": (r.get("HG_NM") or "").strip(),
            "party": (r.get("POLY_NM") or "무소속").strip(),
            "district": (r.get("ORIG_NM") or "").strip() or "비례대표",
            "elect": r.get("ELECT_GBN_NM"),
            "terms": r.get("REELE_GBN_NM"),
            "committees": [],
            "photo": None,
        })
    resolve = Resolver(members)
    by_id = {m["id"]: m for m in members}

    crow = api.all(API_COMMITTEE)
    print(f"  committee rows={len(crow)}")
    comms: dict[str, dict] = {}
    unmatched = 0
    for r in crow:
        cname = (r.get("DEPT_NM") or r.get("CMIT_NM") or "").strip()
        if not cname or "특별" in cname:
            continue
        cid = cid_for(cname, r.get("DEPT_CD"))
        c = comms.setdefault(cid, {"id": cid, "name": cname, "chair": None, "secretaries": {}, "members": []})
        mid = resolve(r.get("HG_NM"), (r.get("POLY_NM") or "").strip() or None, r.get("MONA_CD"))
        if not mid:
            unmatched += 1
            continue
        role = (r.get("JOB_RES_NM") or "위원").strip()
        role = "위원장" if "위원장" in role else ("간사" if "간사" in role else "위원")
        if role == "위원장":
            c["chair"] = mid
        else:
            if role == "간사":
                c["secretaries"].setdefault(by_id[mid]["party"], []).append(mid)
            if mid not in c["members"]:
                c["members"].append(mid)
        by_id[mid]["committees"].append({"id": cid, "name": cname, "role": role})
    if unmatched:
        print(f"  ! committee rows not matched to member: {unmatched}")
    committees = sorted(comms.values(), key=lambda c: c["name"])
    return members, committees


# ---------------------------------------------------------------- bills
def derive_stage(r: dict) -> tuple[str, str | None, str | None]:
    """(stage, stage_since, result)"""
    proc = (r.get("PROC_RESULT") or "").strip()
    cmt_res = (r.get("CMT_PROC_RESULT_CD") or "").strip()
    if proc and any(w in proc for w in CLOSED_WORDS):
        return "closed", d10(r.get("PROC_DT")) or d10(r.get("CMT_PROC_DT")), proc
    if proc and any(w in proc for w in VOTED_WORDS):
        return "voted", d10(r.get("PROC_DT")), proc
    if cmt_res and any(w in cmt_res for w in CLOSED_WORDS):
        return "closed", d10(r.get("CMT_PROC_DT")), cmt_res
    if d10(r.get("LAW_PROC_DT")):
        return "plenary", d10(r.get("LAW_PROC_DT")), None
    if d10(r.get("LAW_SUBMIT_DT")) or d10(r.get("CMT_PROC_DT")):
        return "judiciary", d10(r.get("LAW_SUBMIT_DT")) or d10(r.get("CMT_PROC_DT")), None
    if d10(r.get("COMMITTEE_DT")) or (r.get("COMMITTEE") and r.get("COMMITTEE_ID")):
        return "committee", d10(r.get("COMMITTEE_DT")), None
    return "proposed", d10(r.get("PROPOSE_DT")), None


def timeline_of(r: dict, stage: str) -> list[dict]:
    t = []
    def add(st: str, key: str, label: str) -> None:
        d = d10(r.get(key))
        if d:
            t.append({"stage": st, "date": d, "label": label})
    add("proposed", "PROPOSE_DT", "발의·접수")
    add("committee", "COMMITTEE_DT", f"{r.get('COMMITTEE') or '소관위원회'} 회부")
    add("committee", "CMT_PRESENT_DT", "소관위원회 상정")
    add("committee", "CMT_PROC_DT", f"소관위원회 처리 ({r.get('CMT_PROC_RESULT_CD') or '-'})")
    add("judiciary", "LAW_SUBMIT_DT", "법제사법위원회 체계·자구 심사 회부")
    add("judiciary", "LAW_PRESENT_DT", "법제사법위원회 상정")
    add("plenary", "LAW_PROC_DT", f"법제사법위원회 처리 ({r.get('LAW_PROC_RESULT_CD') or '-'})")
    if stage in ("voted", "closed"):
        add(stage, "PROC_DT", f"본회의 처리 ({r.get('PROC_RESULT') or '-'})")
    t.sort(key=lambda x: x["date"])
    return t


def proposers(r: dict, resolve: Resolver) -> tuple[list[str], list[str], list[str]]:
    lead_codes = split_codes(r.get("RST_MONA_CD"))
    co_codes = [c for c in split_codes(r.get("PUBL_MONA_CD")) if c not in lead_codes]
    unmatched: list[str] = []
    if not lead_codes:
        for n in split_names(r.get("RST_PROPOSER")):
            mid = resolve(n)
            (lead_codes.append(mid) if mid else unmatched.append(n))
    if not co_codes:
        for n in split_names(r.get("PUBL_PROPOSER")):
            mid = resolve(n)
            if mid and mid not in lead_codes:
                co_codes.append(mid)
            elif not mid:
                unmatched.append(n)
    return lead_codes, co_codes, unmatched


def proposer_count(r: dict, n: int) -> int:
    m = re.search(r"등\s*(\d+)\s*인", str(r.get("PROPOSER") or ""))
    return int(m.group(1)) if m else max(n, 1)


# ---------------------------------------------------------------- photos
IMG_RE = re.compile(r"^https?://\S+\.(jpe?g|png|gif|webp)(\?\S*)?$", re.I)


def _photo_url(row: dict) -> str | None:
    v = (row.get("NAAS_PIC") or "").strip()
    if v.startswith("http"):
        return v
    for v in row.values():  # 필드명이 바뀐 경우 대비
        if isinstance(v, str) and IMG_RE.match(v.strip()):
            return v.strip()
    return None


def attach_photos(api: Api, members: list[dict], prev: dict[str, str]) -> None:
    """국회 공식 사진 URL(ALLNAMEMBER NAAS_PIC)만 기록. 파일은 받지 않고 브라우저가 직접 불러온다.
    API 실패 시 이전 값 유지."""
    pics: dict[str, str] = {}
    try:
        for r in api.all(API_ALL_MEMBER):
            url = _photo_url(r)
            if r.get("NAAS_CD") and url:
                pics[r["NAAS_CD"]] = url
    except Exception as e:  # noqa: BLE001 — 사진 실패가 전체 수집을 막지 않게
        print(f"  ! 통합 API 실패, 이전 사진 주소 유지: {e}")
    for m in members:
        m["photo"] = pics.get(m["id"]) or prev.get(m["id"])
    print(f"  사진 주소: {sum(1 for m in members if m.get('photo'))}/{len(members)}")


# ---------------------------------------------------------------- main
def inspect(api: Api) -> None:
    for code, params in [
        (API_MEMBERS, {}), (API_COMMITTEE, {}), (API_BILLS, {"AGE": AGE}),
        (API_BILL_VOTE, {"AGE": AGE}), (API_ALL_MEMBER, {}),
    ]:
        total, rows = api.page(code, 1, 1, **params)
        print(f"\n## {code} total={total}")
        print(json.dumps(rows[0] if rows else {}, ensure_ascii=False, indent=1))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--members", action="store_true", help="의원·위원회 강제 갱신")
    ap.add_argument("--inspect", action="store_true", help="API 필드 확인만")
    args = ap.parse_args()

    key = os.environ.get("ASSEMBLY_API_KEY", "").strip()
    if not key:
        print("ASSEMBLY_API_KEY 환경변수가 없습니다. 수집을 건너뜁니다.", file=sys.stderr)
        return 0
    api = Api(key)
    if args.inspect:
        inspect(api)
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    changed = 0
    ts = now_kst().isoformat(timespec="seconds")
    meta_base = {"updated": ts, "sample": False, "age": int(AGE), "source": "열린국회정보 (open.assembly.go.kr)"}

    # 1) 의원·위원회 (주 1회)
    prev_members = read_json(OUT / "members.json") or {}
    prev_meta = prev_members.get("meta", {})
    stale = True
    if prev_meta and not prev_meta.get("sample"):
        try:
            stale = now_kst() - datetime.fromisoformat(prev_meta.get("members_updated", "2000-01-01T00:00:00+09:00")) > timedelta(days=7)
        except ValueError:
            stale = True
    if args.members or stale:
        print("[1/4] 의원·위원회 갱신")
        members, committees = sync_members(api)
        attach_photos(api, members, {m["id"]: m["photo"] for m in prev_members.get("members", []) if m.get("photo")})
        m_meta = {**meta_base, "members_updated": ts, "photos_checked": ts}
        parties = {p: PARTY_COLORS[p] for p in sorted({m["party"] for m in members}) if p in PARTY_COLORS}
        changed += write_if_changed(OUT / "members.json", {"meta": m_meta, "parties": parties, "members": members}, ["updated"])
        changed += write_if_changed(OUT / "committees.json", {"meta": m_meta, "committees": committees}, ["updated"])
    else:
        print("[1/4] 의원·위원회: 최신 (건너뜀)")
        members = prev_members["members"]
        # 사진 주소를 아직 확인하지 않았으면 사진만 보충 (이후엔 주 1회 의원 갱신 때)
        if not prev_meta.get("photos_checked"):
            attach_photos(api, members, {})
            changed += write_if_changed(OUT / "members.json", {**prev_members, "meta": {**prev_meta, "photos_checked": ts}, "members": members}, ["updated"])
    resolve = Resolver(members)

    # 2) 법안 목록 (전체 스캔 — 오래된 법안의 단계 변화도 잡기 위함)
    print("[2/4] 발의법률안")
    rows = api.all(API_BILLS, AGE=AGE)
    print(f"  bills rows={len(rows)}")
    prev_index = read_json(OUT / "bills_index.json") or {}
    prev = {} if prev_index.get("meta", {}).get("sample") else {b["id"]: b for b in prev_index.get("bills", [])}
    summaries = read_json(ROOT / "scripts" / "summaries.json") or {}
    today = now_kst().date().isoformat()

    # 3) 본회의 표결 현황
    print("[3/4] 본회의 표결현황")
    vote_rows = api.all(API_BILL_VOTE, AGE=AGE)
    tally_by_bill = {}
    for v in vote_rows:
        bid = v.get("BILL_ID")
        if bid:
            tally_by_bill[bid] = {
                "yes": int(v.get("YES_TCNT") or 0), "no": int(v.get("NO_TCNT") or 0),
                "abstain": int(v.get("BLANK_TCNT") or 0),
                "absent": max(0, int(v.get("MEMBER_TCNT") or 0) - int(v.get("VOTE_TCNT") or 0)),
                "date": d10(v.get("PROC_DT")),
            }

    index = []
    new_vote_fetch = 0
    member_ids = {m["id"] for m in members}
    name_by_id = {m["id"]: m["name"] for m in members}
    if (OUT / "bills").exists() and prev == {}:
        # 샘플 데이터를 실데이터로 처음 교체하는 경우: 샘플 파일 제거
        for f in (OUT / "bills").glob("PRC_SAMPLE*.json"):
            f.unlink()
        for f in (OUT / "member_bills").glob("M*.json"):
            f.unlink()
    member_bills: dict[str, dict] = {mid: {"id": mid, "lead": [], "co": [], "votes": []} for mid in member_ids}

    for r in rows:
        bid = r.get("BILL_ID")
        if not bid:
            continue
        stage, since, result = derive_stage(r)
        old = prev.get(bid)
        if not since:
            since = old["stage_since"] if old and old.get("stage") == stage else today
        lead, co, unmatched = proposers(r, resolve)
        no = int(r.get("BILL_NO") or 0)
        title = (r.get("BILL_NAME") or "").strip()
        detail_path = OUT / "bills" / f"{bid}.json"
        old_detail = read_json(detail_path) if stage == "voted" else None

        bill = {
            "id": bid, "no": no, "title": title, "summary": summaries.get(bid),
            "stage": stage, "committee": r.get("COMMITTEE"), "committee_id": cid_for(r["COMMITTEE"], None) if r.get("COMMITTEE") else None,
            "propose_date": d10(r.get("PROPOSE_DT")) or today, "stage_since": since,
            "proposer_count": proposer_count(r, len(lead) + len(co)), "voted": stage == "voted",
            "lead": lead, "co": co, "unmatched": unmatched,
            "timeline": timeline_of(r, stage), "link": r.get("DETAIL_LINK"), "result": result,
        }
        if stage == "voted":
            t = tally_by_bill.get(bid)
            if t:
                bill["tally"] = {k: t[k] for k in ("yes", "no", "abstain", "absent")}
                bill["vote_date"] = t["date"] or since
            votes = (old_detail or {}).get("votes")
            if not votes and t and new_vote_fetch < MAX_NEW_VOTE_FETCH:
                new_vote_fetch += 1
                vrows = api.all(API_MEMBER_VOTE, size=400, BILL_ID=bid, AGE=AGE)
                votes = {}
                for vr in vrows:
                    mid = resolve(vr.get("HG_NM"), (vr.get("POLY_NM") or "").strip() or None, vr.get("MONA_CD"))
                    if mid:
                        votes[mid] = VOTE_CODE.get((vr.get("RESULT_VOTE_MOD") or "").strip(), "X")
                # 표결 명단에 없는 현직 의원은 불참 처리
                if votes:
                    for mid in member_ids:
                        votes.setdefault(mid, "X")
            if votes:
                bill["votes"] = votes
        # 상세 파일: 계산된 내용이 바뀐 경우만 기록
        changed += write_if_changed(detail_path, bill)

        brief = {"id": bid, "no": no, "title": title, "stage": stage}
        for mid in lead:
            if mid in member_bills:
                member_bills[mid]["lead"].append(brief)
        for mid in co:
            if mid in member_bills:
                member_bills[mid]["co"].append(brief)
        for mid, v in (bill.get("votes") or {}).items():
            if mid in member_bills:
                member_bills[mid]["votes"].append({**brief, "vote": v, "date": bill.get("vote_date") or since})

        lead_name = name_by_id.get(lead[0]) if lead else None
        item = {k: bill[k] for k in ("id", "no", "title", "stage", "committee", "propose_date", "stage_since", "proposer_count", "voted")}
        if bill["summary"]:
            item["summary"] = bill["summary"]
        if result:
            item["result"] = result
        if lead_name or r.get("RST_PROPOSER"):
            item["lead_name"] = lead_name or split_names(r.get("RST_PROPOSER"))[0]
        index.append(item)

    print(f"  새로 수집한 의원별 표결: {new_vote_fetch}건 (최대 {MAX_NEW_VOTE_FETCH})")

    # 4) 인덱스·역인덱스
    print("[4/4] 인덱스 기록")
    index.sort(key=lambda b: (b["stage_since"], b["no"]), reverse=True)
    pending = sum(1 for b in index if b["stage"] in ("proposed", "committee", "judiciary", "plenary"))
    changed += write_if_changed(OUT / "bills_index.json", {"meta": {**meta_base, "total": len(index), "pending": pending}, "bills": index}, ["updated"])
    for mid, data in member_bills.items():
        data["lead"].sort(key=lambda b: b["no"], reverse=True)
        data["co"].sort(key=lambda b: b["no"], reverse=True)
        data["votes"].sort(key=lambda b: b["date"], reverse=True)
        changed += write_if_changed(OUT / "member_bills" / f"{mid}.json", data)

    # 데이터가 바뀌었을 때만 갱신 시각 기록 (HUD '마지막 갱신')
    if changed:
        for name in ("bills_index.json", "members.json", "committees.json"):
            p = OUT / name
            obj = read_json(p)
            if obj and obj.get("meta", {}).get("updated") != ts:
                obj["meta"]["updated"] = ts
                p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    print(f"완료: API 호출 {api.calls}회, 변경 파일 {changed}개")
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
