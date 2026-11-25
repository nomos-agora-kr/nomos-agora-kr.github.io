import { useSyncExternalStore } from 'react'

/** 사진 경로: 외부 URL(국회 공식 사진)은 그대로, 상대 경로는 BASE 기준 */
export function photoSrc(photo?: string | null): string | null {
  if (!photo) return null
  return /^https?:\/\//.test(photo) ? photo : `${import.meta.env.BASE_URL}${photo}`
}

// 불러오기 실패한 사진 기록 → 이니셜로 대체 (컴포넌트 간 공유)
const failed = new Set<string>()
const subs = new Set<() => void>()
let version = 0
export function markPhotoFailed(src: string) {
  if (failed.has(src)) return
  failed.add(src)
  version++
  subs.forEach((f) => f())
}
export function usePhotoFailures(): (src: string | null) => boolean {
  useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb) },
    () => version,
  )
  return (src) => !src || failed.has(src)
}
