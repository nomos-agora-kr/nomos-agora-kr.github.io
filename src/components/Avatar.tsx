import type { Member } from '../types'
import { markPhotoFailed, photoSrc, usePhotoFailures } from '../lib/photo'

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
  const isFailed = usePhotoFailures()
  const src = photoSrc(member.photo)
  return (
    <button
      type="button"
      className={`avatar${dim ? ' dim' : ''}`}
      style={{ width: size, height: size, borderColor: color, fontSize: Math.round(size * 0.38) }}
      onClick={onClick}
      title={title ?? `${member.name} · ${member.party} · ${member.district}`}
      aria-label={`${member.name} ${member.party} 기록 파일 열기`}
    >
      {!isFailed(src) ? (
        <img
          src={src!} alt={`${member.name} 의원 공식 사진`} loading="lazy" width={size} height={size}
          referrerPolicy="no-referrer" onError={() => markPhotoFailed(src!)}
        />
      ) : (
        <span className="avatar-initial" style={{ background: `color-mix(in srgb, ${color} 26%, #061423)` }}>
          {initial}
        </span>
      )}
      {badge && <em className="avatar-badge">{badge}</em>}
    </button>
  )
}
