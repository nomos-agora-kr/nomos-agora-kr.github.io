import { useEffect, useMemo, useState } from 'react'
import type { BillDetail, Committee, Member } from '../types'
import { STAGE_LABEL, STAGE_ORDER, VOTE_COLOR, VOTE_LABEL, daysSince, fmtDate } from '../lib/format'
import { loadBill } from '../lib/data'
import { Avatar } from './Avatar'
import { CommitteeTable } from './CommitteeTable'
import { SeatMap, type StatusDef } from './SeatMap'

interface Props {
  billId: string
  members: Member[]
  byId: Map<string, Member>
  parties: Record<string, string>
  partyColor: (p: string) => string
  committees: Committee[]
  onSelect: (m: Member) => void
  selectedId: string | null
}

const CO_PREVIEW = 23

const VOTE_STATUSES: StatusDef[] = (['Y', 'N', 'A', 'X'] as const).map((k) => ({
  key: k, label: VOTE_LABEL[k], color: VOTE_COLOR[k], vivid: k === 'Y',
}))
const PROPOSE_STATUSES: StatusDef[] = [
  { key: 'lead', label: '대표발의', color: '#e9f6ff', vivid: true },
  { key: 'co', label: '공동발의', color: '#47c9ed', vivid: true },
  { key: 'cmt', label: '소관위 위원', color: '#2679a3', vivid: false },
  { key: 'none', label: '그 외', color: '#1b3446', vivid: false },
]

export function BillView({ billId, members, byId, parties, partyColor, committees, onSelect, selectedId }: Props) {
  const [bill, setBill] = useState<BillDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [zoomOut, setZoomOut] = useState(false)
  const [showAllCo, setShowAllCo] = useState(false)

  useEffect(() => {
    let alive = true
    setBill(null)
    setErr(null)
    setZoomOut(false)
    setShowAllCo(false)
    loadBill(billId).then((b) => alive && setBill(b)).catch((e) => alive && setErr(String(e)))
    return () => { alive = false }
  }, [billId])

  const committee = useMemo(() => {
    if (!bill) return undefined
    // 법사위 단계부터는 법사위가 결정권을 가짐
    if (bill.stage === 'judiciary' || bill.stage === 'plenary') return committees.find((c) => c.name === '법제사법위원회')
    return committees.find((c) => (bill.committee_id && c.id === bill.committee_id) || c.name === bill.committee)
  }, [bill, committees])

  const proposerIds = useMemo(() => new Set(bill ? [...bill.lead, ...bill.co] : []), [bill])
  const cmtIds = useMemo(() => new Set(committee ? [committee.chair, ...committee.members].filter(Boolean) as string[] : []), [committee])

  if (err) return <div className="hud-panel empty-state">법안 정보를 불러오지 못했습니다. ({err})</div>
  if (!bill) return <div className="hud-panel empty-state">불러오는 중…</div>

  const voted = bill.stage === 'voted' && !!bill.votes
  const statusOfVote = (m: Member) => bill.votes?.[m.id] ?? 'X'
  const statusOfPropose = (m: Member) => (bill.lead.includes(m.id) ? 'lead' : proposerIds.has(m.id) ? 'co' : cmtIds.has(m.id) ? 'cmt' : 'none')
  const leads = bill.lead.map((id) => byId.get(id)).filter(Boolean) as Member[]
  const cos = bill.co.map((id) => byId.get(id)).filter(Boolean) as Member[]
  const days = daysSince(bill.stage_since)
  const curIdx = bill.stage === 'voted' ? 4 : bill.stage === 'closed' ? -1 : STAGE_ORDER.indexOf(bill.stage)

  return (
    <article className="bill-view">
      <header className="hud-panel bill-head">
        <div className="bill-head-top">
          <span className="card-overline">의안번호 {bill.no} · {bill.committee ?? '소관위 미정'}</span>
          {bill.link && <a className="ext-link" href={bill.link} target="_blank" rel="noreferrer">의안정보시스템 원문 ↗</a>}
        </div>
        <h1>{bill.title}</h1>
        {bill.summary ? <p className="plain">{bill.summary}</p> : <p className="plain muted">쉬운 요약이 아직 등록되지 않았습니다.</p>}

        <ol className="progress" aria-label="진행 단계">
          {STAGE_ORDER.map((s, i) => {
            const state = curIdx > i ? 'done' : curIdx === i ? 'current' : 'todo'
            const tl = bill.timeline.find((t) => t.stage === s)
            return (
              <li key={s} className={state}>
                <span className="dot" />
                <strong>{STAGE_LABEL[s]}</strong>
                <small>{tl ? fmtDate(tl.date) : '—'}</small>
              </li>
            )
          })}
        </ol>
        {bill.stage !== 'voted' && bill.stage !== 'closed' ? (
          <p className="stall">
            <b>{STAGE_LABEL[bill.stage]}</b>에서 <em>{days}일째</em> 계류 중
            <span className="muted"> · {fmtDate(bill.stage_since)}부터</span>
          </p>
        ) : bill.stage === 'voted' && bill.tally ? (
          <div className="tally">
            <span className="result">{bill.result ?? '표결 완료'}</span>
            <span className="muted">{bill.vote_date && fmtDate(bill.vote_date)} 본회의</span>
            <TallyBar t={bill.tally} />
          </div>
        ) : (
          <p className="stall"><b>{bill.result ?? '종료'}</b> <span className="muted">· {fmtDate(bill.stage_since)}</span></p>
        )}
      </header>

      <section className="hud-panel proposers">
        <div className="proposers-head">
          <span className="card-overline">발의자 {bill.lead.length + bill.co.length + bill.unmatched.length}명 · 대표 {bill.lead.length} · 공동 {bill.co.length + bill.unmatched.length}</span>
        </div>
        <div className="proposer-grid">
          {[...leads.map((m) => [m, '대표'] as const), ...(showAllCo ? cos : cos.slice(0, CO_PREVIEW)).map((m) => [m, '공동'] as const)].map(([m, role]) => (
            <div className={`proposer${role === '대표' ? ' lead' : ''}`} key={m.id}>
              <Avatar member={m} color={partyColor(m.party)} size={56} badge={role} onClick={() => onSelect(m)} />
              <span>{m.name}</span>
              <small style={{ color: partyColor(m.party) }}>{m.party}</small>
            </div>
          ))}
          {bill.unmatched.map((n) => (
            <div className="proposer unmatched" key={n} title="의원 코드와 매칭되지 않은 이름 (전직 의원 등)">
              <span className="avatar-blank">?</span>
              <span>{n}</span>
              <small>확인 필요</small>
            </div>
          ))}
        </div>
        {cos.length > CO_PREVIEW && (
          <button className="ghost-btn more-co" onClick={() => setShowAllCo((v) => !v)}>
            {showAllCo ? '접기' : `공동발의자 ${cos.length}명 모두 보기`}
          </button>
        )}
      </section>

      <section className="hud-panel stage-panel">
        {voted ? (
          <>
            <div className="stage-panel-head">
              <span className="card-overline">본회의장 · 의원별 표결</span>
            </div>
            <SeatMap
              key={`v-${bill.id}`}
              members={members}
              parties={parties}
              partyColor={partyColor}
              committees={committees}
              statusOf={statusOfVote}
              statuses={VOTE_STATUSES}
              onSelect={onSelect}
              selectedId={selectedId}
              defaultGroup="party"
            />
          </>
        ) : (
          <>
            <div className="stage-panel-head">
              <span className="card-overline">{zoomOut ? '본회의장 300석에서 보기' : '위원회 심사 테이블'}</span>
              <button className="ghost-btn" onClick={() => setZoomOut((v) => !v)}>
                {zoomOut ? '← 위원회 테이블로' : `${members.length}석 전체에서 보기`}
              </button>
            </div>
            {zoomOut ? (
              <SeatMap
                key={`p-${bill.id}`}
                members={members}
                parties={parties}
                partyColor={partyColor}
                committees={committees}
                statusOf={statusOfPropose}
                statuses={PROPOSE_STATUSES}
                onSelect={onSelect}
                selectedId={selectedId}
                defaultGroup="party"
              />
            ) : committee ? (
              <CommitteeTable committee={committee} byId={byId} partyColor={partyColor} proposerIds={proposerIds} onSelect={onSelect} />
            ) : (
              <p className="muted">아직 소관 위원회에 회부되지 않았습니다. 발의자 정보만 공개되어 있어요.</p>
            )}
          </>
        )}
      </section>

      <section className="hud-panel timeline-panel">
        <span className="card-overline">단계별 기록</span>
        <ol className="timeline">
          {bill.timeline.map((t, i) => (
            <li key={i}><time>{fmtDate(t.date)}</time><span>{t.label}</span></li>
          ))}
        </ol>
      </section>
    </article>
  )
}

function TallyBar({ t }: { t: NonNullable<BillDetail['tally']> }) {
  const total = t.yes + t.no + t.abstain + t.absent || 1
  const segs = [
    ['Y', t.yes], ['N', t.no], ['A', t.abstain], ['X', t.absent],
  ] as const
  return (
    <div className="tally-bar-wrap">
      <div className="tally-bar">
        {segs.map(([k, v]) => <span key={k} style={{ width: `${(v / total) * 100}%`, background: VOTE_COLOR[k] }} />)}
      </div>
      <ul>
        {segs.map(([k, v]) => <li key={k}><i style={{ background: VOTE_COLOR[k] }} />{VOTE_LABEL[k]} <b>{v}</b></li>)}
      </ul>
    </div>
  )
}
