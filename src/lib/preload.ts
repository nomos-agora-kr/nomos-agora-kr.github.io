import { markPhotoFailed, photoSrc } from './photo'

/**
 * 의원 사진 우선순위 큐
 * - high: 지금 보는/곧 볼 법안의 발의자·위원 → 큐 맨 앞, 바로 시작
 * - low : 나머지 전체 → 브라우저가 한가할 때 조금씩
 * - 받은 이미지는 참조를 바로 놓음 → 디코딩된 비트맵이 메모리에 남지 않고, 압축본만 브라우저 캐시에 남음
 * - 같은 사진은 한 번만 요청, 데이터 절약 모드·2g 회선에서는 low 단계 생략
 */
const done = new Set<string>()
const inflight = new Set<string>()
let queue: string[] = []
let maxParallel = 3

function slowNet(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  return !!(c?.saveData || /2g/.test(c?.effectiveType ?? ''))
}

function idle(fn: () => void) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 1200 })
  else setTimeout(fn, 150)
}

function pump() {
  while (inflight.size < maxParallel && queue.length) {
    const src = queue.shift()!
    if (done.has(src) || inflight.has(src)) continue
    inflight.add(src)
    let img: HTMLImageElement | null = new Image()
    img.referrerPolicy = 'no-referrer'
    img.decoding = 'async'
    const finish = (ok: boolean) => {
      inflight.delete(src)
      done.add(src)
      if (!ok) markPhotoFailed(src)
      if (img) { img.onload = img.onerror = null; img = null }
      pump()
    }
    img.onload = () => finish(true)
    img.onerror = () => finish(false)
    img.src = src
  }
}

function norm(photos: (string | null | undefined)[]): string[] {
  return [...new Set(photos.map(photoSrc).filter((s): s is string => !!s && !done.has(s)))]
}

/** 배경 미리 받기 (낮은 우선순위). parallel 로 동시 요청 수 조절 */
export function preloadPhotos(photos: (string | null | undefined)[], parallel = 3) {
  if (slowNet()) return
  const add = norm(photos).filter((s) => !queue.includes(s))
  queue.push(...add)
  maxParallel = Math.max(maxParallel, parallel)
  if (parallel > 3) pump()
  else idle(pump)
}

/** 지금 필요한 사진 (높은 우선순위): 큐 맨 앞으로 */
export function prefetchPhotosNow(photos: (string | null | undefined)[]) {
  const urgent = norm(photos)
  if (!urgent.length) return
  const set = new Set(urgent)
  queue = [...urgent, ...queue.filter((s) => !set.has(s))]
  maxParallel = Math.max(maxParallel, 6)
  pump()
}
