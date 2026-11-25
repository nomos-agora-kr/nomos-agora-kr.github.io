import { useMemo, useState } from 'react'
import type { BillIndexItem, Stage } from '../types'
import { STAGE_SHORT, daysSince } from '../lib/format'

interface Props {
  bills: BillIndexItem[]
  selected: string | null
  onOpen: (id: string) => void
}

const FILTERS: { key: 'all' | Stage; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'proposed', label: '발의' },
  { key: 'committee', label: '상임위' },
  { key: 'judiciary', label: '법사위' },
  { key: 'plenary', label: '본회의 대기' },
  { key: 'voted', label: '표결 완료' },
  { key: 'closed', label: '종료' },
]
type Sort = 'recent' | 'stalled'
const PAGE = 60

export function BillList({ bills, selected, onOpen }: Props) {
  const [filter, setFilter] = useState<'all' | Stage>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [limit, setLimit] = useState(PAGE)
  const [expanded, setExpanded] = useState(false)

  const list = useMemo(() => {
    const f = bills.filter((b) => filter === 'all' || b.stage === filter)
    if (sort === 'stalled')
      return [...f].filter((b) => b.stage !== 'voted' && b.stage !== 'closed').sort((a, b) => a.stage_since.localeCompare(b.stage_since))
    return f
  }, [bills, filter, sort])

  return (
    <aside className={`hud-panel bill-list${selected && !expanded ? ' compact' : ''}`} aria-label="법안 목록">
      <div className="panel-section">
        <div className="list-head">
          <h2>법안 목록</h2>
          {selected && (
            <button className="ghost-btn mobile-only" onClick={() => setExpanded((v) => !v)}>
              {expanded ? '목록 접기' : '목록 펼치기'}
            </button>
          )}
        </div>
        <div className="filter-chips">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => { setFilter(f.key); setLimit(PAGE) }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="sort-row">
          <button className={sort === 'recent' ? 'active' : ''} onClick={() => setSort('recent')}>최근 변동순</button>
          <button className={sort === 'stalled' ? 'active' : ''} onClick={() => setSort('stalled')}>오래 계류된 순</button>
          <span>{list.length.toLocaleString()}건</span>
        </div>
      </div>
      <ul className="bill-items">
        {list.slice(0, limit).map((b) => {
          const pending = b.stage !== 'voted' && b.stage !== 'closed'
          return (
            <li key={b.id}>
              <button className={selected === b.id ? 'active' : ''} onClick={() => { onOpen(b.id); setExpanded(false) }}>
                <div className="bi-top">
                  <span className={`stage-chip s-${b.stage}`}>{STAGE_SHORT[b.stage]}</span>
                  {pending ? <em>{daysSince(b.stage_since)}일째</em> : <em className="res">{b.result ?? ''}</em>}
                </div>
                <strong>{b.title}</strong>
                {b.summary && <p>{b.summary}</p>}
                <small>{b.lead_name ? `${b.lead_name} 등 ${b.proposer_count}인` : `${b.proposer_count}인`} · {b.committee ?? '위원회 미정'}</small>
              </button>
            </li>
          )
        })}
      </ul>
      {list.length > limit && (
        <button className="ghost-btn more" onClick={() => setLimit((l) => l + PAGE)}>더 보기 ({list.length - limit}건 남음)</button>
      )}
    </aside>
  )
}
