import type { Committee, Member } from '../types'
import { Avatar } from './Avatar'

interface Props {
  committee: Committee
  byId: Map<string, Member>
  partyColor: (p: string) => string
  proposerIds: Set<string>
  onSelect: (m: Member) => void
}

/**
 * 상임위 회의장 구조: 정면 중앙 위원장, 좌우로 정당별 마주 보는 배치,
 * 위원장에 가까운 최전방에 각 당 간사.
 */
export function CommitteeTable({ committee, byId, partyColor, proposerIds, onSelect }: Props) {
  const chair = committee.chair ? byId.get(committee.chair) : undefined
  const secIds = new Set(Object.values(committee.secretaries).flat())
  const all = [committee.chair, ...committee.members].filter(Boolean).map((id) => byId.get(id!)).filter(Boolean) as Member[]

  // 정당별 인원: 최다 정당은 좌측, 나머지는 우측
  const partyCount = new Map<string, number>()
  all.forEach((m) => partyCount.set(m.party, (partyCount.get(m.party) ?? 0) + 1))
  const partiesSorted = [...partyCount.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p)
  const leftParty = partiesSorted[0]
  const seated = committee.members.map((id) => byId.get(id)).filter(Boolean) as Member[]
  const order = (m: Member) => (secIds.has(m.id) ? 0 : 1)
  const sortSide = (arr: Member[]) =>
    [...arr].sort((a, b) => order(a) - order(b) || partiesSorted.indexOf(a.party) - partiesSorted.indexOf(b.party) || a.name.localeCompare(b.name, 'ko'))
  const left = sortSide(seated.filter((m) => m.party === leftParty))
  const right = sortSide(seated.filter((m) => m.party !== leftParty))

  const chip = (m: Member, size = 46) => (
    <div className={`cmt-seat${proposerIds.has(m.id) ? ' is-proposer' : ''}`} key={m.id}>
      <Avatar
        member={m}
        color={partyColor(m.party)}
        size={size}
        badge={secIds.has(m.id) ? '간사' : undefined}
        onClick={() => onSelect(m)}
      />
      <span className="cmt-name">{m.name}</span>
      <span className="cmt-party" style={{ color: partyColor(m.party) }}>{m.party}</span>
    </div>
  )

  return (
    <div className="cmt-room" aria-label={`${committee.name} 위원 배치`}>
      <div className="cmt-head">
        <span className="card-overline">현재 결정권 · {committee.name}</span>
        <span className="cmt-sub">위원 {all.length}명 · 강조 테두리 = 이 법안의 발의자</span>
      </div>
      <div className="cmt-chair">
        {chair ? (
          <>
            {chip(chair, 64)}
            <em className="role-tag">위원장</em>
          </>
        ) : (
          <span className="muted">위원장 정보 없음</span>
        )}
      </div>
      <div className="cmt-floor">
        <div className="cmt-side left">
          <div className="cmt-side-label"><span><i style={{ background: partyColor(leftParty) }} />{leftParty} {partyCount.get(leftParty)}</span></div>
          <div className="cmt-grid">{left.map((m) => chip(m))}</div>
        </div>
        <div className="cmt-aisle" aria-hidden />
        <div className="cmt-side right">
          <div className="cmt-side-label">
            {partiesSorted.slice(1).map((p) => (
              <span key={p}><i style={{ background: partyColor(p) }} />{p} {partyCount.get(p)}</span>
            ))}
          </div>
          <div className="cmt-grid">{right.map((m) => chip(m))}</div>
        </div>
      </div>
    </div>
  )
}
