import { useEffect, useState } from 'react'
import type { BillBrief, Member, MemberBills } from '../types'
import { STAGE_SHORT, VOTE_COLOR, VOTE_LABEL, fmtDate, partyTextColor } from '../lib/format'
import { loadMemberBills } from '../lib/data'
import { Avatar } from './Avatar'

interface Props {
  member: Member | null
  partyColor: (p: string) => string
  onClose: () => void
  onOpenBill: (id: string) => void
}

type Tab = 'lead' | 'co' | 'votes'

/** 의원 기록 파일 — 데스크톱 우측 슬라이드, 모바일 하단 시트 */
export function Dossier({ member, partyColor, onClose, onOpenBill }: Props) {
  const [data, setData] = useState<MemberBills | null>(null)
  const [tab, setTab] = useState<Tab>('lead')
  const [voteFilter, setVoteFilter] = useState<string>('all')

  useEffect(() => {
    if (!member) return
    let alive = true
    setData(null)
    setTab('lead')
    setVoteFilter('all')
    loadMemberBills(member.id)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData({ id: member.id, lead: [], co: [], votes: [] }))
    return () => { alive = false }
  }, [member])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const open = !!member
  const color = member ? partyColor(member.party) : '#47c9ed'
  const votes = data?.votes.filter((v) => voteFilter === 'all' || v.vote === voteFilter) ?? []
  const voteCount = (k: string) => data?.votes.filter((v) => v.vote === k).length ?? 0

  return (
    <>
      <div className={`dossier-scrim${open ? ' open' : ''}`} onClick={onClose} aria-hidden />
      <aside className={`dossier hud-panel${open ? ' open' : ''}`} aria-hidden={!open} aria-label="의원 기록 파일">
        {member && (
          <>
            <div className="sheet-grip" aria-hidden />
            <header className="dossier-head">
              <Avatar member={member} color={color} size={72} />
              <div>
                <span className="card-overline">의원 기록 파일{member.former && <em className="former-tag">전 의원</em>}</span>
                <h2>{member.name}</h2>
                <p><b style={{ color: partyTextColor(color) }}>{member.party}</b> · {member.district}{member.terms ? ` · ${member.terms}` : ''}</p>
              </div>
              <button className="detail-close-button" onClick={onClose} aria-label="닫기">×</button>
            </header>

            <div className="dossier-roles">
              {member.former ? (
                <span className="muted">22대 국회 전직 의원 · 발의 기록은 그대로 남아 있습니다</span>
              ) : member.committees.length ? (
                member.committees.map((c) => (
                  <span key={c.id} className={`role-chip${c.role !== '위원' ? ' strong' : ''}`}>{c.name.replace('위원회', '위')} · {c.role}</span>
                ))
              ) : (
                <span className="muted">소속 상임위 정보 없음</span>
              )}
            </div>

            <div className="detail-stat-grid">
              <div><span>대표발의</span><strong>{data?.lead.length ?? '–'}</strong></div>
              <div><span>공동발의</span><strong>{data?.co.length ?? '–'}</strong></div>
              <div><span>본회의 표결 참여</span><strong>{data ? data.votes.length - voteCount('X') : '–'}<small>/{data?.votes.length ?? '–'}</small></strong></div>
              <div><span>찬성·반대·기권</span><strong className="vote-mini">{data ? `${voteCount('Y')}·${voteCount('N')}·${voteCount('A')}` : '–'}</strong></div>
            </div>

            <nav className="detail-tabs">
              <button className={tab === 'lead' ? 'active' : ''} onClick={() => setTab('lead')}>대표발의</button>
              <button className={tab === 'co' ? 'active' : ''} onClick={() => setTab('co')}>공동발의</button>
              <button className={tab === 'votes' ? 'active' : ''} onClick={() => setTab('votes')}>본회의 표결</button>
            </nav>

            <div className="dossier-body">
              {!data && <p className="muted">불러오는 중…</p>}
              {data && tab !== 'votes' && <BillList items={data[tab]} onOpen={onOpenBill} />}
              {data && tab === 'votes' && (
                <>
                  <div className="vote-filter">
                    {['all', 'Y', 'N', 'A', 'X'].map((k) => (
                      <button key={k} className={voteFilter === k ? 'active' : ''} onClick={() => setVoteFilter(k)}>
                        {k === 'all' ? '전체' : VOTE_LABEL[k as 'Y']}
                      </button>
                    ))}
                  </div>
                  {votes.length === 0 && <p className="muted">해당 기록이 없습니다.</p>}
                  <ol className="vote-timeline">
                    {votes.map((v) => (
                      <li key={v.id}>
                        <time>{fmtDate(v.date)}</time>
                        <i style={{ background: VOTE_COLOR[v.vote] }} />
                        <button className="link-btn" onClick={() => onOpenBill(v.id)}>{v.title}</button>
                        <b style={{ color: VOTE_COLOR[v.vote] === '#2a4457' ? '#6f8899' : VOTE_COLOR[v.vote] }}>{VOTE_LABEL[v.vote]}</b>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
            <footer className="source-line">출처: 열린국회정보 · 공개된 공식 기록을 그대로 표시합니다</footer>
          </>
        )}
      </aside>
    </>
  )
}

function BillList({ items, onOpen }: { items: BillBrief[]; onOpen: (id: string) => void }) {
  if (!items.length) return <p className="muted">해당 기록이 없습니다.</p>
  return (
    <ul className="dossier-bills">
      {items.map((b) => (
        <li key={b.id}>
          <button onClick={() => onOpen(b.id)}>
            <span className={`stage-chip s-${b.stage}`}>{STAGE_SHORT[b.stage]}</span>
            <span className="t">{b.title}</span>
            <small>제{b.no}호</small>
          </button>
        </li>
      ))}
    </ul>
  )
}
