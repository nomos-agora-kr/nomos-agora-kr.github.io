import { useSyncExternalStore } from 'react'

/** 사진 경로: 외부 URL(국회 공식 사진)은 그대로, 상대 경로는 BASE 기준 */
export function photoSrc(photo?: string | null): string | null {
  if (!photo) return null
  const base = import.meta.env.BASE_URL
  // 여러 번 호출해도 결과가 같도록 (이미 변환된 경로는 그대로)
  return /^https?:\/\//.test(photo) || photo.startsWith(base) ? photo : `${base}${photo}`
}

// 사진 상태 기록 (컴포넌트·미리받기 간 공유)
// - 실패: 드묾 → 즉시 알림, 좌석/아바타가 구독 (이니셜로 대체)
// - 도착: 잦음 → 한 프레임에 한 번으로 묶어 알림, 게이지만 구독 (전체 좌석 재렌더 방지)
const failed = new Set<string>()
const loaded = new Set<string>()
const failSubs = new Set<() => void>()
const loadSubs = new Set<() => void>()
let failVer = 0
let loadVer = 0
let loadScheduled = false

export function markPhotoFailed(src: string) {
  if (failed.has(src)) return
  failed.add(src)
  failVer++
  failSubs.forEach((f) => f())
  markLoadChanged()
}
export function markPhotoLoaded(src: string) {
  if (loaded.has(src)) return
  loaded.add(src)
  markLoadChanged()
}
function markLoadChanged() {
  loadVer++
  if (loadScheduled) return
  loadScheduled = true
  requestAnimationFrame(() => { loadScheduled = false; loadSubs.forEach((f) => f()) })
}
export function isPhotoLoaded(src: string | null): boolean {
  return !!src && loaded.has(src)
}
export function usePhotoFailures(): (src: string | null) => boolean {
  useSyncExternalStore((cb) => { failSubs.add(cb); return () => failSubs.delete(cb) }, () => failVer)
  return (src) => !src || failed.has(src)
}
/** 도착(성공·실패 포함) 여부 — 게이지용 */
export function usePhotoSettled(): (src: string | null) => boolean {
  useSyncExternalStore((cb) => { loadSubs.add(cb); return () => loadSubs.delete(cb) }, () => loadVer)
  return (src) => !src || loaded.has(src) || failed.has(src)
}

/** 도착 알림을 ms 단위로 묶어 받는 구독 (좌석도처럼 무거운 화면용) */
const slowSubs = new Set<() => void>()
let slowVer = 0
let slowTimer: ReturnType<typeof setTimeout> | null = null
loadSubs.add(() => {
  if (slowTimer) return
  slowTimer = setTimeout(() => { slowTimer = null; slowVer++; slowSubs.forEach((f) => f()) }, 300)
})
export function usePhotoBatches(): number {
  return useSyncExternalStore((cb) => { slowSubs.add(cb); return () => slowSubs.delete(cb) }, () => slowVer)
}

/**
 * 클라이언트 썸네일 캐시
 * 국회 서버가 사진의 재사용(캐시)을 허용하지 않아, 같은 사진을 화면에서 쓸 때마다 다시 내려받게 됨.
 * 그래서 받은 순간 72×72 로 줄여 메모리에 보관하고, 화면은 이 썸네일로 바로 그림 (299장 ≈ 6MB).
 * '도착(loaded)' = 썸네일 준비 완료.
 */
export const THUMB = 72
const thumbs = new Map<string, HTMLCanvasElement>()
export function setThumb(src: string, c: HTMLCanvasElement) { thumbs.set(src, c) }
export function getThumb(src: string | null): HTMLCanvasElement | undefined {
  return src ? thumbs.get(src) : undefined
}
