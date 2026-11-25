import { useEffect, useRef } from 'react'

/** 썸네일 캔버스를 원하는 크기로 복사해 그림 (네트워크 없음) */
export function ThumbCanvas({ thumb, size, className }: { thumb: HTMLCanvasElement; size: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = Math.round(size * dpr)
    c.height = Math.round(size * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(thumb, 0, 0, c.width, c.height)
  }, [thumb, size])
  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%' }} aria-hidden />
}
