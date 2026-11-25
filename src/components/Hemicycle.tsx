import { useMemo, useState } from 'react'
import type { Member } from '../types'
import { HEMI_H, HEMI_W, hemicycleSeats } from '../lib/hemicycle'
import { markPhotoFailed, photoSrc, usePhotoFailures } from '../lib/photo'

export interface SeatGroup {
  key: string
  label: string
  color: string
}

interface Props {
  members: Member[]
  /** 그룹 키 산출 (정렬 순서는 groups 배열 순서) */
  groupOf: (m: Member) => string
  groups: SeatGroup[]
  /** 점 보기 색상 */
  dotColor: (m: Member) => string
  /** 프로필 보기에서 흑백 처리 여부 */
  isDim: (m: Member) => boolean
  partyColor: (party: string) => string
  statusLabel?: (m: Member) => string | null
  onSelect: (m: Member) => void
  selectedId?: string | null
  mode: 'dot' | 'profile'
}

export function Hemicycle({
  members, groupOf, groups, dotColor, isDim, partyColor, statusLabel, onSelect, selectedId, mode,
}: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const placed = useMemo(() => {
    const order = new Map(groups.map((g, i) => [g.key, i]))
    const sorted = [...members].sort(
      (a, b) => (order.get(groupOf(a)) ?? 99) - (order.get(groupOf(b)) ?? 99) || a.party.localeCompare(b.party, 'ko') || a.name.localeCompare(b.name, 'ko'),
    )
    const seats = hemicycleSeats(sorted.length)
    return sorted.map((m, i) => ({ m, s: seats[i] }))
  }, [members, groupOf, groups])

  const counts = useMemo(() => {
    const c = new Map<string, number>()
    members.forEach((m) => c.set(groupOf(m), (c.get(groupOf(m)) ?? 0) + 1))
    return c
  }, [members, groupOf])

  const h = hover != null ? placed[hover] : null
  const r = placed[0]?.s.r ?? 10

  return (
    <div className="hemi-wrap">
      <div className="hemi-canvas">
        <svg viewBox={`0 0 ${HEMI_W} ${HEMI_H}`} role="img" aria-label={`본회의장 ${members.length}석 좌석도`}>
          <defs>
            <clipPath id="seat-clip" clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5" /></clipPath>
            <radialGradient id="floor" cx="50%" cy="100%" r="80%">
              <stop offset="0%" stopColor="#0c2a40" stopOpacity=".55" />
              <stop offset="100%" stopColor="#020a14" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d={`M14 ${HEMI_H - 22} A486 486 0 0 1 ${HEMI_W - 14} ${HEMI_H - 22}`} fill="url(#floor)" stroke="rgba(60,157,210,.12)" />
          <rect x={HEMI_W / 2 - 44} y={HEMI_H - 34} width="88" height="20" rx="4" fill="#0b2335" stroke="#235773" />
          <text x={HEMI_W / 2} y={HEMI_H - 20} textAnchor="middle" className="hemi-podium">의장석</text>
          {placed.map(({ m, s }, i) => {
            const dim = isDim(m)
            const sel = selectedId === m.id
            return (
              <g
                key={m.id}
                className={`seat${sel ? ' selected' : ''}`}
                transform={`translate(${s.x} ${s.y})`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((v) => (v === i ? null : v))}
                onFocus={() => setHover(i)}
                onBlur={() => setHover((v) => (v === i ? null : v))}
                onClick={() => onSelect(m)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(m)}
                tabIndex={0}
                role="button"
                aria-label={`${m.name} ${m.party} ${m.district}${statusLabel?.(m) ? ` ${statusLabel(m)}` : ''}`}
              >
                {mode === 'dot' ? (
                  <circle r={s.r} fill={dotColor(m)} stroke={sel ? '#fff' : 'none'} strokeWidth={2} />
                ) : (
                  <SeatFace m={m} r={s.r} dim={dim} border={partyColor(m.party)} />
                )}
              </g>
            )
          })}
          {/* 호버 확대: 레이아웃을 밀지 않고 맨 위 레이어에 다시 그림 */}
          {h && (
            <g className="seat-zoom" transform={`translate(${h.s.x} ${h.s.y}) scale(2.4)`} pointerEvents="none">
              <circle r={r + 2} fill="#01040b" opacity=".7" />
              {mode === 'dot' ? (
                <circle r={r} fill={dotColor(h.m)} stroke="#fff" strokeWidth={1} />
              ) : (
                <SeatFace m={h.m} r={r} dim={isDim(h.m)} border={partyColor(h.m.party)} />
              )}
            </g>
          )}
        </svg>
        {h && (
          <div
            className="hemi-tip"
            style={{
              left: `${(h.s.x / HEMI_W) * 100}%`,
              top: `${(h.s.y / HEMI_H) * 100}%`,
              transform: `translate(-50%, ${h.s.y < 140 ? '34px' : 'calc(-100% - 34px)'})`,
            }}
          >
            <strong>{h.m.name}</strong>
            <span><i style={{ background: partyColor(h.m.party) }} />{h.m.party}</span>
            <span>{h.m.district}</span>
            {statusLabel?.(h.m) && <b>{statusLabel(h.m)}</b>}
          </div>
        )}
      </div>
      <p className="legend-title">좌석 배치 순서 (왼쪽부터)</p>
      <ul className="hemi-legend balanced">
        {groups.filter((g) => counts.get(g.key)).map((g) => (
          <li key={g.key}><i style={{ background: g.color }} />{g.label}<b>{counts.get(g.key)}</b></li>
        ))}
      </ul>
    </div>
  )
}

function SeatFace({ m, r, dim, border }: { m: Member; r: number; dim: boolean; border: string }) {
  const isFailed = usePhotoFailures()
  // 관련 없는 의원(dim)은 사진을 불러오지 않고 정당색 점으로만 표시 → 요청·렌더링 부담 감소
  if (dim) {
    return <circle r={r * 0.72} fill="#0d1c28" stroke={border} strokeWidth={Math.max(1.2, r * 0.18)} opacity={0.55} />
  }
  const initial = m.name.slice(1, 2) || m.name.slice(0, 1)
  const src = photoSrc(m.photo)
  return (
    <g>
      {/* 이니셜을 먼저 그리고 사진은 그 위에 (불러오기 전·실패 시에도 빈 원이 안 남음) */}
      <circle r={r} fill={`color-mix(in srgb, ${border} 34%, #061423)`} />
      <text y={r * 0.36} textAnchor="middle" fontSize={r * 1.02} className="seat-initial">{initial}</text>
      {!isFailed(src) && (
        <image
          href={src!}
          onError={() => markPhotoFailed(src!)}
          x={-r} y={-r} width={r * 2} height={r * 2}
          clipPath="url(#seat-clip)" preserveAspectRatio="xMidYMin slice"
        />
      )}
      <circle r={r} fill="none" stroke={border} strokeWidth={Math.max(1.4, r * 0.2)} />
    </g>
  )
}
