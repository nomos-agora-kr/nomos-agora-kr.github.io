import { useEffect, useState } from 'react'

/** 해시 라우트: #/bill/{id}?m={mona}  — 정적 호스팅에서 새로고침/공유 링크 안전 */
export interface Route {
  bill: string | null
  member: string | null
}

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '')
  const [path, q = ''] = h.split('?')
  const parts = path.split('/').filter(Boolean)
  const params = new URLSearchParams(q)
  return {
    bill: parts[0] === 'bill' && parts[1] ? decodeURIComponent(parts[1]) : null,
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
  const q = r.member ? `?m=${encodeURIComponent(r.member)}` : ''
  window.location.hash = r.bill ? `/bill/${encodeURIComponent(r.bill)}${q}` : `/${q}`
}
