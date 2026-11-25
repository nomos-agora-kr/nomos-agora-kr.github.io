import type { Stage, Vote } from '../types'

export const STAGE_ORDER: Stage[] = ['proposed', 'committee', 'judiciary', 'plenary']

export const STAGE_LABEL: Record<Stage, string> = {
  proposed: '발의',
  committee: '소관 상임위',
  judiciary: '법사위',
  plenary: '본회의',
  voted: '본회의 표결 완료',
  closed: '종료(폐기·대안반영 등)',
}

export const STAGE_SHORT: Record<Stage, string> = {
  proposed: '발의',
  committee: '상임위',
  judiciary: '법사위',
  plenary: '본회의 대기',
  voted: '표결 완료',
  closed: '종료',
}

export const VOTE_LABEL: Record<Vote, string> = { Y: '찬성', N: '반대', A: '기권', X: '불참' }
export const VOTE_COLOR: Record<Vote, string> = {
  Y: '#47c9ed',
  N: '#ff8a4c',
  A: '#c9b458',
  X: '#2a4457',
}

export function daysSince(iso: string, now = new Date()): number {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00+09:00` : iso)
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000))
}

export function fmtDate(iso: string): string {
  return iso.slice(0, 10).replaceAll('-', '.')
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/** 정당명 → 색. 사전에 없으면 이름 해시로 고정 색 생성 */
export function partyColor(parties: Record<string, string>, party: string): string {
  if (parties[party]) return parties[party]
  let h = 0
  for (const ch of party) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 55% 58%)`
}

export function bodyStage(stage: Stage): boolean {
  return stage === 'voted'
}

/** 어두운 배경 위 글자용 정당색: 원래 색에 흰색을 섞어 대비 확보 (외곽선은 원색 유지) */
export function partyTextColor(color: string): string {
  return `color-mix(in srgb, ${color} 55%, #ffffff)`
}
