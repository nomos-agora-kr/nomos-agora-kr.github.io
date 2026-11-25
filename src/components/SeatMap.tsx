import { useCallback, useMemo, useState } from 'react'
import type { Committee, Member } from '../types'
import { Hemicycle, type SeatGroup } from './Hemicycle'

export interface StatusDef {
  key: string
  label: string
  color: string
  /** 프로필 보기에서 사진을 보여줄지 */
  vivid: boolean
  /** 간략히 보기 점 모양 (기본 fill) */
  style?: 'fill' | 'ring'
  /** 프로필 보기에서 사진에 이 색 테두리를 한 겹 더 (대표발의 구분용) */
  halo?: boolean
}

interface Props {
  members: Member[]
  parties: Record<string, string>
  partyColor: (p: string) => string
  committees: Committee[]
  /** 의원별 상태 (표결 결과 / 발의 여부 등). 없으면 정당 모드 */
  statusOf?: (m: Member) => string
  statuses?: StatusDef[]
  onSelect: (m: Member) => void
  selectedId?: string | null
  defaultMode?: 'dot' | 'profile'
  defaultGroup?: GroupBy
}

type GroupBy = 'party' | 'committee' | 'status'

export function SeatMap({
  members, parties, partyColor, committees, statusOf, statuses, onSelect, selectedId, defaultMode = 'dot', defaultGroup = 'party',
}: Props) {
  const [mode, setMode] = useState<'dot' | 'profile'>(defaultMode)
  const [groupBy, setGroupBy] = useState<GroupBy>(statusOf ? defaultGroup : 'party')
  const statusMap = useMemo(() => new Map((statuses ?? []).map((s) => [s.key, s])), [statuses])

  const partyOrder = useMemo(() => {
    const c = new Map<string, number>()
    members.forEach((m) => c.set(m.party, (c.get(m.party) ?? 0) + 1))
    return [...c.entries()].sort((a, b) => (a[0] === '무소속' ? 1 : b[0] === '무소속' ? -1 : b[1] - a[1])).map(([p]) => p)
  }, [members])

  const groups: SeatGroup[] = useMemo(() => {
    if (groupBy === 'status' && statuses) return statuses.map((s) => ({ key: s.key, label: s.label, color: s.color }))
    if (groupBy === 'committee')
      return [
        ...committees.map((c, i) => ({ key: c.id, label: c.name.replace('위원회', ''), color: `hsl(${(i * 47) % 360} 45% 55%)` })),
        { key: '-', label: '미배정', color: '#3a4d5c' },
      ]
    return partyOrder.map((p) => ({ key: p, label: p, color: parties[p] ?? partyColor(p) }))
  }, [groupBy, statuses, committees, partyOrder, parties, partyColor])

  const groupOf = useCallback(
    (m: Member) => {
      if (groupBy === 'status' && statusOf) return statusOf(m)
      if (groupBy === 'committee') return m.committees[0]?.id ?? '-'
      return m.party
    },
    [groupBy, statusOf],
  )

  const groupColor = useMemo(() => new Map(groups.map((g) => [g.key, g.color])), [groups])
  const dotColor = useCallback(
    (m: Member) => {
      if (statusOf) return statusMap.get(statusOf(m))?.color ?? '#33485a'
      // 상태가 없을 때는 현재 묶음 기준 색 (정당별=정당색, 상임위별=위원회색) → 범례와 일치
      return groupColor.get(groupOf(m)) ?? partyColor(m.party)
    },
    [statusOf, statusMap, partyColor, groupColor, groupOf],
  )
  const isDim = useCallback((m: Member) => (statusOf ? !statusMap.get(statusOf(m))?.vivid : false), [statusOf, statusMap])
  const dotStyle = useCallback((m: Member) => (statusOf ? statusMap.get(statusOf(m))?.style ?? 'fill' : 'fill'), [statusOf, statusMap])
  const haloOf = useCallback((m: Member) => {
    const st = statusOf ? statusMap.get(statusOf(m)) : undefined
    return st?.halo ? st.color : undefined
  }, [statusOf, statusMap])
  const statusLabel = useCallback((m: Member) => (statusOf ? statusMap.get(statusOf(m))?.label ?? null : null), [statusOf, statusMap])

  return (
    <div className="seatmap">
      <div className="seatmap-tools">
        <div className="seg" role="group" aria-label="보기 모드">
          <button className={mode === 'dot' ? 'active' : ''} onClick={() => setMode('dot')}>간략히 보기</button>
          <button className={mode === 'profile' ? 'active' : ''} onClick={() => setMode('profile')}>프로필 보기</button>
        </div>
        <div className="seg" role="group" aria-label="재정렬">
          <button className={groupBy === 'party' ? 'active' : ''} onClick={() => setGroupBy('party')}>정당별</button>
          <button className={groupBy === 'committee' ? 'active' : ''} onClick={() => setGroupBy('committee')}>상임위별</button>
          {statusOf && (
            <button className={groupBy === 'status' ? 'active' : ''} onClick={() => setGroupBy('status')}>
              {statuses?.[0]?.key === 'Y' ? '표결 결과별' : '발의 여부별'}
            </button>
          )}
        </div>
      </div>
      {statusOf && statuses && (
        <>
        <ul className="status-legend">
          {statuses.map((s) => (
            <li key={s.key}>
              <i className={s.style === 'ring' ? 'ring' : ''} style={s.style === 'ring' ? undefined : { background: s.color }} />
              {s.label}<b>{members.filter((m) => statusOf(m) === s.key).length}</b></li>
          ))}
        </ul>
        <p className="hint legend-note">
          점 테두리 색 = 정당{mode === 'profile' && ` · 프로필 보기는 ${statuses.filter((x) => x.vivid).map((x) => x.label).join('·')}만 사진으로 표시${statuses.some((x) => x.halo) ? ' (오렌지 테두리 = 대표발의)' : ''}`}
        </p>
        </>
      )}
      <Hemicycle
        members={members}
        groupOf={groupOf}
        groups={groups}
        dotColor={dotColor}
        isDim={isDim}
        partyColor={partyColor}
        statusLabel={statusLabel}
        dotStyle={dotStyle}
        haloOf={haloOf}
        onSelect={onSelect}
        selectedId={selectedId}
        mode={mode}
      />
    </div>
  )
}
