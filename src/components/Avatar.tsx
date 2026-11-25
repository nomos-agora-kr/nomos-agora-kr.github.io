import type { Member } from '../types'

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
  return (
    <button
      type="button"
      className={`avatar${dim ? ' dim' : ''}`}
      style={{ width: size, height: size, borderColor: color, fontSize: Math.round(size * 0.38) }}
      onClick={onClick}
      title={title ?? `${member.name} · ${member.party} · ${member.district}`}
      aria-label={`${member.name} ${member.party} 기록 파일 열기`}
    >
      {member.photo ? (
        <img src={`${import.meta.env.BASE_URL}${member.photo}`} alt="" loading="lazy" width={size} height={size} />
      ) : (
        <span className="avatar-initial" style={{ background: `color-mix(in srgb, ${color} 26%, #061423)` }}>
          {initial}
        </span>
      )}
      {badge && <em className="avatar-badge">{badge}</em>}
    </button>
  )
}
