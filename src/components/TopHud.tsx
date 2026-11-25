import { useEffect, useMemo, useRef, useState } from 'react'
import type { BillIndexItem, Member, Meta } from '../types'
import { STAGE_SHORT, fmtDateTime } from '../lib/format'

interface Props {
  meta: Meta | null
  total: number
  pending: number
  bills: BillIndexItem[]
  members: Member[]
  partyColor: (p: string) => string
  onOpenBill: (id: string) => void
  onOpenMember: (m: Member) => void
  onDistrict: (ids: string[], label: string) => void
  onHome: () => void
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

export function TopHud({ meta, total, pending, bills, members, partyColor, onOpenBill, onOpenMember, onDistrict, onHome }: Props) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [distOpen, setDistOpen] = useState(false)
  const [dq, setDq] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) { setOpen(false); setDistOpen(false) }
    }
    document.addEventListener('mousedown', on)
    return () => document.removeEventListener('mousedown', on)
  }, [])

  const results = useMemo(() => {
    const k = norm(q)
    if (!k) return { b: [] as BillIndexItem[], m: [] as Member[] }
    const isNo = /^\d+$/.test(k)
    const b = bills.filter((x) => (isNo ? String(x.no).includes(k) : norm(x.title).includes(k) || norm(x.summary ?? '').includes(k))).slice(0, 8)
    const m = members.filter((x) => norm(x.name).includes(k) || norm(x.district).includes(k) || norm(x.party) === k).slice(0, 8)
    return { b, m }
  }, [q, bills, members])

  const distMatches = useMemo(() => {
    const k = norm(dq)
    if (k.length < 2) return []
    return members.filter((m) => m.district !== '비례대표' && norm(m.district).includes(k))
  }, [dq, members])

  const randomMember = () => {
    if (!members.length) return
    onOpenMember(members[Math.floor(Math.random() * members.length)])
  }

  return (
    <header className="top-navigation" ref={boxRef}>
      <button className="brand" onClick={onHome} aria-label="처음 화면으로">
        <span className="brand-mark" />
        <span>
          <strong>NOMOS · AGORA</strong>
          노모스, 아고라
        </span>
      </button>

      <div className="hud-stats" aria-label="실시간 현황">
        <div><span>{meta?.age ?? 22}대 발의 법안</span><b>{total.toLocaleString()}</b></div>
        <div><span>계류 중</span><b>{pending.toLocaleString()}</b></div>
        <div><span>마지막 갱신</span><b>{meta ? fmtDateTime(meta.updated) : '—'}</b></div>
      </div>

      <div className="top-navigation-tools">
        <div className="search-wrap">
          <input
            className="search-shell"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="법안명·의안번호·의원·지역구 검색"
            aria-label="법안/의원 통합 검색"
          />
          {open && q && (
            <div className="search-pop hud-panel">
              {results.b.length === 0 && results.m.length === 0 && <p className="muted">결과가 없습니다.</p>}
              {results.m.length > 0 && <span className="pop-label">의원</span>}
              {results.m.map((m) => (
                <button key={m.id} onClick={() => { onOpenMember(m); setOpen(false) }}>
                  <i style={{ background: partyColor(m.party) }} />
                  <b>{m.name}</b><small>{m.party} · {m.district}</small>
                </button>
              ))}
              {results.b.length > 0 && <span className="pop-label">법안</span>}
              {results.b.map((b) => (
                <button key={b.id} onClick={() => { onOpenBill(b.id); setOpen(false); setQ('') }}>
                  <span className={`stage-chip s-${b.stage}`}>{STAGE_SHORT[b.stage]}</span>
                  <b>{b.title}</b><small>제{b.no}호</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="nav-btn" onClick={() => setDistOpen((v) => !v)} aria-expanded={distOpen}>내 지역구 찾기</button>
        <button className="nav-btn" onClick={randomMember}>아무나 추적</button>
        {distOpen && (
          <div className="district-pop hud-panel">
            <label>
              <span>시·군·구 이름으로 찾기</span>
              <input autoFocus value={dq} onChange={(e) => setDq(e.target.value)} placeholder="예: 마포구, 수원시, 해운대" />
            </label>
            {dq.length >= 2 && distMatches.length === 0 && <p className="muted">일치하는 지역구가 없습니다.</p>}
            {distMatches.length > 0 && (
              <>
                <button className="ghost-btn" onClick={() => { onDistrict(distMatches.map((m) => m.id), dq); setDistOpen(false) }}>
                  좌석도에서 {distMatches.length}명 하이라이트
                </button>
                <ul>
                  {distMatches.slice(0, 12).map((m) => (
                    <li key={m.id}>
                      <button onClick={() => { onOpenMember(m); setDistOpen(false) }}>
                        <i style={{ background: partyColor(m.party) }} />
                        <b>{m.district}</b><small>{m.name} · {m.party}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="hint">동(洞) 단위 검색은 지역구 경계 데이터가 연결되면 지원됩니다.</p>
          </div>
        )}
      </div>
    </header>
  )
}
