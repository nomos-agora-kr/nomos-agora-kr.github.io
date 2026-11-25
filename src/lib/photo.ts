import { useSyncExternalStore } from 'react'

/** 사진 경로: 외부 URL(국회 공식 사진)은 그대로, 상대 경로는 BASE 기준 */
export function photoSrc(photo?: string | null): string | null {
  if (!photo) return null
  return /^https?:\/\//.test(photo) ? photo : `${import.meta.env.BASE_URL}${photo}`
}

// 사진 상태 기록 (컴포넌트·미리받기 간 공유): 실패 → 이니셜 대체, 도착 → 게이지·점등
const failed = new Set<string>()
const loaded = new Set<string>()
export function markPhotoLoaded(src: string) {
  if (loaded.has(src)) return
  loaded.add(src)
  version++
  subs.forEach((f) => f())
}
export function isPhotoLoaded(src: string | null): boolean {
  return !!src && loaded.has(src)
}
/** 도착(성공·실패 포함) 여부 */
export function usePhotoSettled(): (src: string | null) => boolean {
  useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb) },
    () => version,
  )
  return (src) => !src || loaded.has(src) || failed.has(src)
}
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
