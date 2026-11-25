import { markPhotoFailed, photoSrc } from './photo'

/**
 * 의원 사진을 화면 동작을 방해하지 않게 미리 받아 둔다.
 * - 브라우저가 한가할 때(requestIdleCallback) 시작, 동시에 3장씩만 요청, 낮은 우선순위
 * - 받은 이미지는 참조를 바로 놓아 디코딩된 비트맵이 메모리에 남지 않게 함 (압축본만 브라우저 캐시에 남음)
 * - 데이터 절약 모드·느린 회선(2g)에서는 하지 않음
 * - 한 페이지 생애에 한 번만 실행
 */
let started = false

export function preloadPhotos(photos: (string | null | undefined)[], concurrency = 3) {
  if (started) return
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (conn?.saveData || /2g/.test(conn?.effectiveType ?? '')) return
  const queue = [...new Set(photos.map(photoSrc).filter((s): s is string => !!s))]
  if (!queue.length) return
  started = true

  const next = () => {
    const src = queue.shift()
    if (!src) return
    let img: HTMLImageElement | null = new Image()
    img.referrerPolicy = 'no-referrer'
    img.decoding = 'async'
    ;(img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low'
    const done = (ok: boolean) => {
      if (!ok) markPhotoFailed(src)
      if (img) { img.onload = img.onerror = null; img = null }
      // 다음 요청은 다시 한가할 때
      idle(next)
    }
    img.onload = () => done(true)
    img.onerror = () => done(false)
    img.src = src
  }
  idle(() => { for (let i = 0; i < concurrency; i++) next() })
}

function idle(fn: () => void) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 1500 })
  else setTimeout(fn, 200)
}
