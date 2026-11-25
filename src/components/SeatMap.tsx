import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { photoSrc, usePhotoSettled } from '../lib/photo'
import { prefetchPhotosNow } from '../lib/preload'
import { setScanProgress } from '../lib/scan'
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
  // 프로필 보기 연출: 들어올 때마다 스캔부터 다시
  const [photoPhase, setPhotoPhase] = useState<'scan' | 'show'>('scan')
  const [runId, setRunId] = useState(0)
  const enterProfile = () => { setScanProgress(0); setPhotoPhase('scan'); setRunId((n) => n + 1); setMode('profile') }
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

  // 프로필 보기 수신 게이지: 사진으로 보여 줄 의원 기준
  const targets = useMemo(
    () => (mode === 'profile' ? members.filter((m) => !isDim(m)).map((m) => photoSrc(m.photo)).filter(Boolean) as string[] : []),
    [mode, members, isDim],
  )
  // 프로필 보기에 필요한 사진을 큐 맨 앞으로 (좌석은 받아진 사진만 붙임)
  useEffect(() => { if (targets.length) prefetchPhotosNow(targets) }, [targets])
  return (
    <div className="seatmap">
      <div className="seatmap-tools">
        <div className="seatmap-left">
        <div className="seg" role="group" aria-label="보기 모드">
          <button className={mode === 'dot' ? 'active' : ''} onClick={() => setMode('dot')}>간략히 보기</button>
          <button className={mode === 'profile' ? 'active' : ''} onClick={() => mode !== 'profile' && enterProfile()}>프로필 보기</button>
        </div>
        {mode === 'profile' && <LoadGauge key={`${runId}-${targets.length}`} targets={targets} onReveal={() => setPhotoPhase('show')} />}
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
        photoPhase={photoPhase}
        onSelect={onSelect}
        selectedId={selectedId}
        mode={mode}
      />
    </div>
  )
}

const MIN_SCAN_MS = 2800 // 미리 받아져 있어도 이만큼은 '받는 중'으로 보여 줌
const MAX_SCAN_MS = 12000 // 사진이 끝내 안 와도 이 시간이 지나면 받은 것까지만 공개

/**
 * 프로필 수신 게이지 + 연출 진행
 * 표시 수 = min(실제 도착 수, 시간에 비례한 수) → 일정한 속도로 차오르고, 다 차면 한 번에 공개
 * 도착 알림·매 프레임 갱신은 이 작은 컴포넌트만 받음 (좌석도는 공개 순간 한 번만 다시 그림)
 */
function LoadGauge({ targets, onReveal }: { targets: string[]; onReveal: () => void }) {
  const settled = usePhotoSettled()
  const total = targets.length
  const real = targets.reduce((n, t) => n + (settled(t) ? 1 : 0), 0)
  const reduce = useRef(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const t0 = useRef(performance.now())
  const [now, setNow] = useState(t0.current)
  const [phase, setPhase] = useState<'loading' | 'done' | 'hidden'>('loading')
  const elapsed = now - t0.current
  const byTime = reduce.current ? total : Math.floor((total * Math.min(1, elapsed / MIN_SCAN_MS)))
  const shown = elapsed >= MAX_SCAN_MS ? total : Math.min(real, byTime)

  useEffect(() => {
    if (phase !== 'loading') return
    let raf = requestAnimationFrame(function tick(t) { setNow(t); raf = requestAnimationFrame(tick) })
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // 좌석 점등 레이어에 진행률 전달 (게이지와 같은 속도로 켜짐)
  useEffect(() => { if (total) setScanProgress(shown / total) }, [shown, total])

  useEffect(() => {
    if (phase !== 'loading' || total === 0 || shown < total) return
    setPhase('done')
    onReveal()
    const t = setTimeout(() => setPhase('hidden'), 1400)
    return () => clearTimeout(t)
  }, [phase, shown, total, onReveal])

  if (total === 0) return null
  return (
    <div className={`load-gauge ${phase}`} role="status" aria-live="polite">
      <span className="lb">{phase === 'loading' ? '프로필 수신 중' : '수신 완료'}</span>
      <span className="trk"><span className="fil" style={{ transform: `scaleX(${shown / total})` }} /></span>
      <span className="num">{shown} / {total}</span>
    </div>
  )
}
