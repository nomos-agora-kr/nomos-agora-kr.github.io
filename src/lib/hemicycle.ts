export interface Seat {
  x: number
  y: number
  r: number
  angle: number
  row: number
}

export const HEMI_W = 1000
export const HEMI_H = 520

/**
 * 반원형 좌석 배치. 각 열의 좌석 수를 반지름(호 길이)에 비례하게 나눠
 * 모든 좌석이 같은 크기·간격을 갖도록 한다. 결과는 왼쪽→오른쪽(각도 내림차순) 정렬.
 */
export function hemicycleSeats(n: number, rows = 0): Seat[] {
  if (n <= 0) return []
  const R = 486
  const cx = HEMI_W / 2
  const cy = HEMI_H - 22
  const rowsN = rows || Math.max(4, Math.round(Math.sqrt(n / 3)))
  const r0 = R * 0.4
  const radii = Array.from({ length: rowsN }, (_, i) => r0 + ((R - r0) * i) / (rowsN - 1))
  const total = radii.reduce((a, b) => a + b, 0)
  const counts = radii.map((r) => Math.floor((n * r) / total))
  let rest = n - counts.reduce((a, b) => a + b, 0)
  for (let i = rowsN - 1; rest > 0; i = (i - 1 + rowsN) % rowsN, rest--) counts[i]++

  const pitch = (Math.PI * R) / counts[rowsN - 1]
  const seatR = Math.min(pitch, (R - r0) / (rowsN - 1)) * 0.42
  const seats: Seat[] = []
  radii.forEach((radius, row) => {
    const k = counts[row]
    for (let j = 0; j < k; j++) {
      const angle = k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1)
      seats.push({ x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle), r: seatR, angle, row })
    }
  })
  // 같은 각도대에서 안쪽→바깥쪽 순으로 묶이도록 정렬하면 그룹이 부채꼴로 채워진다
  seats.sort((a, b) => b.angle - a.angle || a.row - b.row)
  return seats
}
