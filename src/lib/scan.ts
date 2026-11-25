/** 프로필 보기 스캔 진행률(0~1) — 게이지가 쓰고, 좌석 점등 레이어가 직접 구독 (React 재렌더 없음) */
let frac = 0
const subs = new Set<(f: number) => void>()
export function setScanProgress(f: number) {
  if (f === frac) return
  frac = f
  subs.forEach((cb) => cb(f))
}
export function subscribeScan(cb: (f: number) => void): () => void {
  subs.add(cb) // 이전 실행의 진행률이 남아 있을 수 있어 즉시 호출하지 않음
  return () => { subs.delete(cb) }
}
