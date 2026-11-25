import { useCallback, useMemo, useState } from 'react'
import type { Committee, Member } from '../types'
import { Hemicycle, type SeatGroup } from './Hemicycle'

export interface StatusDef {
  key: string
  label: string
  color: string
  /** 프로필 보기에서 선명하게 유지할지 */
  vivid: boolean
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

  const dotColor = useCallback(
    (m: Member) => (statusOf ? statusMap.get(statusOf(m))?.color ?? '#33485a' : partyColor(m.party)),
    [statusOf, statusMap, partyColor],
  )
  const isDim = useCallback((m: Member) => (statusOf ? !statusMap.get(statusOf(m))?.vivid : false), [statusOf, statusMap])
  const statusLabel = useCallback((m: Member) => (statusOf ? statusMap.get(statusOf(m))?.label ?? null : null), [statusOf, statusMap])

  return (
    <div className="seatmap">
      <div className="seatmap-tools">
        <div className="seg" role="group" aria-label="보기 모드">
          <button className={mode === 'dot' ? 'active' : ''} onClick={() => setMode('dot')}>점 보기</button>
          <button className={mode === 'profile' ? 'active' : ''} onClick={() => setMode('profile')}>프로필 보기</button>
        </div>
        <div className="seg" role="group" aria-label="재정렬">
          <span className="seg-label">묶기</span>
          <button className={groupBy === 'party' ? 'active' : ''} onClick={() => setGroupBy('party')}>정당별</button>
          <button className={groupBy === 'committee' ? 'active' : ''} onClick={() => setGroupBy('committee')}>상임위별</button>
          {statusOf && (
            <button className={groupBy === 'status' ? 'active' : ''} onClick={() => setGroupBy('status')}>
              {statuses?.[0]?.key === 'Y' ? '표결 결과별' : '발의 여부별'}
            </button>
          )}
        </div>
      </div>
      {statusOf && statuses && mode === 'dot' && (
        <ul className="status-legend">
          {statuses.map((s) => (
            <li key={s.key}><i style={{ background: s.color }} />{s.label}<b>{members.filter((m) => statusOf(m) === s.key).length}</b></li>
          ))}
        </ul>
      )}
      <Hemicycle
        members={members}
        groupOf={groupOf}
        groups={groups}
        dotColor={dotColor}
        isDim={isDim}
        partyColor={partyColor}
        statusLabel={statusLabel}
        onSelect={onSelect}
        selectedId={selectedId}
        mode={mode}
      />
      {mode === 'profile' && statusOf && (
        <p className="hint">선명한 사진 = {statuses?.filter((s) => s.vivid).map((s) => s.label).join('·')} · 흐린 사진 = 그 외. 외곽선 색은 정당입니다.</p>
      )}
    </div>
  )
}
