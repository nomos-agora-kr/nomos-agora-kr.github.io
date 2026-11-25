import { useEffect, useState } from 'react'

/**
 * 해시 라우트 — 정적 호스팅에서 새로고침/공유 링크 안전
 *   #/                    랜딩
 *   #/explore             대시보드 (본회의장 전체)
 *   #/bill/{id}           대시보드 + 법안
 *   ...?m={mona}          의원 기록 파일 열기 (어느 화면에서든)
 */
export type View = 'landing' | 'explore'

export interface Route {
  view: View
  bill: string | null
  member: string | null
}

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [path, q = ''] = h.split('?')
  const parts = path.split('/').filter(Boolean)
  const params = new URLSearchParams(q)
  const bill = parts[0] === 'bill' && parts[1] ? decodeURIComponent(parts[1]) : null
  return {
    view: bill || parts[0] === 'explore' ? 'explore' : 'landing',
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
  if (next.bill) r.view = 'explore'
  const q = r.member ? `?m=${encodeURIComponent(r.member)}` : ''
  window.location.hash = r.bill
    ? `/bill/${encodeURIComponent(r.bill)}${q}`
    : r.view === 'explore' ? `/explore${q}` : `/${q}`
}
