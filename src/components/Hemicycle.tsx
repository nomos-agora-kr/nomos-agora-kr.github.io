import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Member } from '../types'
import { HEMI_H, HEMI_W, hemicycleSeats } from '../lib/hemicycle'
import { getThumb, photoSrc, usePhotoBatches } from '../lib/photo'
import { ThumbCanvas } from './ThumbCanvas'

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
  /** 간략히 보기 점 모양: fill(칠함) / ring(속 빈 원). 기본 fill */
  dotStyle?: (m: Member) => 'fill' | 'ring'
  /** 프로필 보기 연출 단계: scan = 스캔 중(사진 숨김, HALO 깜빡임) / show = 한 번에 공개 */
  photoPhase?: 'scan' | 'show'
  /** 프로필 보기에서 사진 바깥에 두를 강조 테두리 색 (예: 대표발의 = 오렌지) */
  haloOf?: (m: Member) => string | undefined
  onSelect: (m: Member) => void
  selectedId?: string | null
  mode: 'dot' | 'profile'
}

export const Hemicycle = memo(function Hemicycle({
  members, groupOf, groups, dotColor, isDim, partyColor, statusLabel, dotStyle, haloOf, photoPhase = 'show', onSelect, selectedId, mode,
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

  const scanning = mode === 'profile' && photoPhase === 'scan'
  const showPhotos = mode === 'profile' && photoPhase === 'show'
  const photoSeats = useMemo<PhotoSeat[]>(
    () => (mode === 'profile'
      ? placed.filter(({ m }) => !isDim(m)).map(({ m, s }) => ({ x: s.x, y: s.y, r: s.r, src: photoSrc(m.photo), border: partyColor(m.party), halo: haloOf?.(m) }))
      : []),
    [mode, placed, isDim, partyColor, haloOf],
  )


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
                  <Dot r={s.r} fill={dotColor(m)} party={partyColor(m.party)} ring={dotStyle?.(m) === 'ring'} dim={dim} selected={sel} />
                ) : (
                  dim
                    ? <Dot r={s.r} fill={dotColor(m)} party={partyColor(m.party)} ring={dotStyle?.(m) === 'ring'} dim selected={sel} />
                    : <SeatFace m={m} r={s.r} border={partyColor(m.party)} halo={haloOf?.(m)} />
                )}
              </g>
            )
          })}
          {/* 호버 확대: 레이아웃을 밀지 않고 맨 위 레이어에 다시 그림 */}
          {h && !(mode === 'profile' && !isDim(h.m)) && (
            <g className="seat-zoom" transform={`translate(${h.s.x} ${h.s.y}) scale(2.4)`} pointerEvents="none">
              <circle r={r + 2} fill="#01040b" opacity=".7" />
              {mode === 'dot' ? (
                <Dot r={r} fill={dotColor(h.m)} party={partyColor(h.m.party)} ring={dotStyle?.(h.m) === 'ring'} dim={false} selected />
              ) : (
                isDim(h.m)
                  ? <Dot r={r} fill={dotColor(h.m)} party={partyColor(h.m.party)} ring={dotStyle?.(h.m) === 'ring'} dim={false} selected />
                  : <SeatFace m={h.m} r={r} border={partyColor(h.m.party)} halo={haloOf?.(h.m)} />
              )}
            </g>
          )}
        </svg>
        {mode === 'profile' && <PhotoLayer seats={photoSeats} show={showPhotos} />}
        {mode === 'profile' && (
          <div className={`hemi-fx ${scanning ? 'scanning' : 'revealed'}`} aria-hidden>
            {/* 사진이 나올 좌석들의 HALO — 레이어 하나를 통째로 깜빡임 (좌석도는 다시 그리지 않음) */}
            <svg className="halo-layer" viewBox={`0 0 ${HEMI_W} ${HEMI_H}`}>
              {placed.filter(({ m }) => !isDim(m)).map(({ m, s }) => (
                <circle key={m.id} cx={s.x} cy={s.y} r={s.r * 1.16} />
              ))}
            </svg>
            {scanning && <span className="hemi-beam" />}
          </div>
        )}
        {h && (
          <div
            className="hemi-tip"
            style={{
              left: `${(h.s.x / HEMI_W) * 100}%`,
              top: `${(h.s.y / HEMI_H) * 100}%`,
              transform: `translate(-50%, ${h.s.y < 140 ? '34px' : 'calc(-100% - 34px)'})`,
            }}
          >
            {mode === 'profile' && getThumb(photoSrc(h.m.photo)) && (
              <span className="tip-photo"><ThumbCanvas thumb={getThumb(photoSrc(h.m.photo))!} size={56} /></span>
            )}
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
})

/** 간략히 보기 점: 속 = 상태 색, 테두리 = 정당색. ring 이면 속을 비우고 정당색 테두리를 굵게 */
function Dot({ r, fill, party, ring, dim, selected }: { r: number; fill: string; party: string; ring: boolean; dim: boolean; selected: boolean }) {
  return (
    <>
      {ring ? (
        <circle r={r * 0.84} fill="#06121c" stroke={party} strokeWidth={r * 0.32} />
      ) : (
        <circle r={r * 0.9} fill={fill} stroke={party} strokeWidth={r * 0.2} strokeOpacity={dim ? 0.5 : 1} />
      )}
      {selected && <circle r={r * 1.08} fill="none" stroke="#fff" strokeWidth={1.6} />}
    </>
  )
}

function SeatFace({ m, r, border, halo }: { m: Member; r: number; border: string; halo?: string }) {
  const initial = m.name.slice(1, 2) || m.name.slice(0, 1)
  return (
    <g>
      {/* 이니셜·테두리만 SVG 로. 사진은 위의 캔버스 레이어(PhotoLayer)가 한 번에 그림 */}
      <circle r={r} fill={`color-mix(in srgb, ${border} 34%, #061423)`} />
      <text y={r * 0.36} textAnchor="middle" fontSize={r * 1.02} className="seat-initial">{initial}</text>
      <circle r={r} fill="none" stroke={border} strokeWidth={Math.max(1.4, r * 0.2)} />
      {halo && <circle r={r * 1.24} fill="none" stroke={halo} strokeWidth={Math.max(1.6, r * 0.26)} />}
    </g>
  )
}

interface PhotoSeat { x: number; y: number; r: number; src: string | null; border: string; halo?: string }

/** 썸네일 캐시로 사진 좌석을 캔버스 한 장에 그림 — 네트워크 재요청 없이 '한 번에' 공개 */
function PhotoLayer({ seats, show }: { seats: PhotoSeat[]; show: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const batch = usePhotoBatches() // 늦게 도착한 썸네일 반영
  const [size, setSize] = useState(0)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ro = new ResizeObserver(([e]) => setSize(Math.round(e.contentRect.width)))
    ro.observe(c)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    const c = ref.current
    if (!c || !size) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const k = (size / HEMI_W) * dpr
    c.width = Math.round(size * dpr)
    c.height = Math.round((size * HEMI_H / HEMI_W) * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    if (!show) return
    ctx.imageSmoothingQuality = 'high'
    for (const s of seats) {
      const t = getThumb(s.src)
      if (!t) continue
      const x = s.x * k, y = s.y * k, r = s.r * k
      ctx.save()
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip()
      ctx.drawImage(t, x - r, y - r, r * 2, r * 2)
      ctx.restore()
      ctx.lineWidth = Math.max(1.4, s.r * 0.2) * k
      ctx.strokeStyle = s.border
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke()
      if (s.halo) {
        ctx.lineWidth = Math.max(1.6, s.r * 0.26) * k
        ctx.strokeStyle = s.halo
        ctx.beginPath(); ctx.arc(x, y, r * 1.24, 0, Math.PI * 2); ctx.stroke()
      }
    }
  }, [seats, show, size, batch])
  return <canvas ref={ref} className="photo-layer" aria-hidden />
}
