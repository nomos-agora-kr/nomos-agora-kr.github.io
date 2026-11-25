import { THUMB, markPhotoFailed, markPhotoLoaded, photoSrc, setThumb } from './photo'

/**
 * 의원 사진 우선순위 큐
 * - high: 지금 보는/곧 볼 법안의 발의자·위원 → 큐 맨 앞, 바로 시작
 * - low : 나머지 전체 → 브라우저가 한가할 때 조금씩
 * - 받은 이미지는 참조를 바로 놓음 → 디코딩된 비트맵이 메모리에 남지 않고, 압축본만 브라우저 캐시에 남음
 * - 같은 사진은 한 번만 요청, 데이터 절약 모드·2g 회선에서는 low 단계 생략
 */
const done = new Set<string>()

/**
 * 원본 → 72×72 썸네일. 해독·축소를 브라우저 백그라운드(createImageBitmap)에서 처리해
 * 화면 작업(타이핑·애니메이션)을 막지 않음. 지원하지 않는 브라우저만 기존 방식.
 */
async function makeThumb(src: string, img: HTMLImageElement): Promise<boolean> {
  const w = img.naturalWidth, h = img.naturalHeight
  if (!w || !h) return false
  const side = Math.min(w, h)
  const sx = (w - side) / 2, sy = (h - side) * 0.12 // 얼굴이 있는 위쪽 기준 정사각형
  const c = document.createElement('canvas')
  c.width = c.height = THUMB
  const ctx = c.getContext('2d')
  if (!ctx) return false
  try {
    await img.decode() // 해독은 브라우저 백그라운드 스레드에서
    const bmp = await createImageBitmap(img, sx, sy, side, side, { resizeWidth: THUMB, resizeHeight: THUMB, resizeQuality: 'high' })
    ctx.drawImage(bmp, 0, 0)
    bmp.close()
  } catch {
    ctx.drawImage(img, sx, sy, side, side, 0, 0, THUMB, THUMB)
  }
  setThumb(src, c)
  return true
}
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
    const finish = async (ok: boolean) => {
      const el = img
      if (img) { img.onload = img.onerror = null; img = null }
      if (ok && el) ok = await makeThumb(src, el)
      inflight.delete(src)
      done.add(src)
      if (ok) markPhotoLoaded(src)
      else markPhotoFailed(src)
      idle(pump)
    }
    // 응답이 끝없이 늦어지는 사진은 20초에 실패로 확정 → 연출이 무한히 기다리지 않음 (이니셜로 표시)
    let settledOnce = false
    const once = (ok: boolean) => { if (settledOnce) return; settledOnce = true; clearTimeout(timer); finish(ok) }
    const timer = setTimeout(() => once(false), 20000)
    img.onload = () => once(true)
    img.onerror = () => once(false)
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
