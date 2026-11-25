import { useEffect } from 'react'
import type { Member } from '../types'
import { getThumb, photoSrc, usePhotoBatches } from '../lib/photo'
import { prefetchPhotosNow } from '../lib/preload'
import { ThumbCanvas } from './ThumbCanvas'

interface Props {
  member: Member
  color: string
  size?: number
  dim?: boolean
  badge?: string
  onClick?: () => void
  title?: string
}

/** 프로필 칩: 사진(있으면) 또는 이니셜 + 정당색 외곽선. dim 이면 흑백·투명 처리 */
export function Avatar({ member, color, size = 40, dim, badge, onClick, title }: Props) {
  const initial = member.name.slice(1, 2) || member.name.slice(0, 1)
  const src = photoSrc(member.photo)
  usePhotoBatches() // 썸네일이 준비되면 다시 그림
  const thumb = getThumb(src)
  // 원본 사진을 칩마다 따로 띄우지 않고(휴대폰 메모리 부담), 썸네일 큐에 우선 요청만 함
  useEffect(() => { if (src && !thumb) prefetchPhotosNow([src]) }, [src, thumb])
  return (
    <button
      type="button"
      className={`avatar${dim ? ' dim' : ''}`}
      style={{ width: size, height: size, borderColor: color, fontSize: Math.round(size * 0.38) }}
      onClick={onClick}
      title={title ?? `${member.name} · ${member.party} · ${member.district}`}
      aria-label={`${member.name} ${member.party} 기록 파일 열기`}
    >
      <span className="avatar-face">
        {/* 이니셜을 항상 먼저 깔고, 사진은 실제로 도착했을 때만 위에 덮는다 (사진이 멈춰도 빈 원이 안 남음) */}
        <span className="avatar-initial" style={{ background: `color-mix(in srgb, ${color} 26%, #061423)` }}>
          {initial}
        </span>
        {thumb && <ThumbCanvas thumb={thumb} size={size} className="avatar-thumb" />}
      </span>
      {badge && <em className={`avatar-badge${badge === '대표' ? ' lead' : badge === '공동' ? ' co' : ''}`}>{badge}</em>}
    </button>
  )
}
