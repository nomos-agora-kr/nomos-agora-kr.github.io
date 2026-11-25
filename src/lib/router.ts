import { useEffect, useState } from 'react'

/**
 * 해시 라우트 — 정적 호스팅에서 새로고침/공유 링크 안전
 *   #/                    랜딩
 *   #/explore             노모스 (법안 기록) — 본회의장 전체
 *   #/bill/{id}           노모스 + 법안
 *   #/agora               아고라 (찬반 현황) — 참여 많은 법안
 *   #/agora/{id}          아고라 + 법안 찬반
 *   ...?m={mona}          의원 기록 파일 열기 (어느 화면에서든)
 */
export type View = 'landing' | 'explore'
export type Tab = 'nomos' | 'agora'

export interface Route {
  view: View
  tab: Tab
  bill: string | null
  member: string | null
}

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [path, q = ''] = h.split('?')
  const parts = path.split('/').filter(Boolean)
  const params = new URLSearchParams(q)
  const agora = parts[0] === 'agora'
  const bill = (parts[0] === 'bill' || agora) && parts[1] ? decodeURIComponent(parts[1]) : null
  return {
    view: bill || agora || parts[0] === 'explore' ? 'explore' : 'landing',
    tab: agora ? 'agora' : 'nomos',
    bill,
    member: params.get('m'),
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function navigate(next: Partial<Route>) {
  const cur = parse()
  const r = { ...cur, ...next }
  if (next.bill || next.tab) r.view = 'explore'
  if (r.view === 'landing') r.tab = 'nomos'
  const q = r.member ? `?m=${encodeURIComponent(r.member)}` : ''
  const id = r.bill ? `/${encodeURIComponent(r.bill)}` : ''
  const hash = r.view === 'landing'
    ? `/${q}`
    : r.tab === 'agora' ? `/agora${id}${q}` : r.bill ? `/bill${id}${q}` : `/explore${q}`
  if (window.location.hash === `#${hash}`) return
  // pushState 로 이동 → 방문 통계(Cloudflare, SPA 모드)가 화면 전환을 페이지뷰로 인식
  history.pushState(null, '', `#${hash}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
