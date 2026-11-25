import { useEffect, useMemo, useState } from 'react'

export interface TypeSeg {
  text: string
  /** 강조 색으로 표시 */
  accent?: boolean
}
export interface TypeBlock {
  tag: 'h1' | 'p'
  className?: string
  /** 줄 단위. 각 줄은 조각(강조 여부)으로 구성 */
  lines: TypeSeg[][]
  /** 글자당 ms */
  speed: number
}

/** 한 글자씩 타이핑되듯 나타나는 텍스트. 화면 낭독기에는 전체 문장을 한 번에 제공 */
export function Typewriter({ blocks, onDone }: { blocks: TypeBlock[]; onDone?: () => void }) {
  const reduce = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])
  const lengths = blocks.map((b) => b.lines.reduce((n, l) => n + l.reduce((m, s) => m + [...s.text].length, 0), 0))
  const total = lengths.reduce((a, b) => a + b, 0)
  const [shown, setShown] = useState(reduce ? total : 0)

  useEffect(() => {
    if (shown >= total) { onDone?.(); return }
    // 현재 글자가 속한 블록의 속도 사용, 블록이 바뀌는 지점에선 잠깐 쉼
    let acc = 0, bi = 0
    while (bi < blocks.length && shown >= acc + lengths[bi]) { acc += lengths[bi]; bi++ }
    const pause = shown === acc && shown > 0 ? 380 : 0
    const t = setTimeout(() => setShown((n) => n + 1), blocks[bi].speed + pause)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, total])

  let remain = shown
  let cursorPlaced = false
  return (
    <>
      {blocks.map((b, bi) => {
        const Tag = b.tag
        const full = b.lines.map((l) => l.map((s) => s.text).join('')).join(' ')
        return (
          <Tag key={bi} className={b.className} aria-label={full}>
            {b.lines.map((line, li) => (
              <span key={li} className="tw-line" aria-hidden>
                {line.map((seg, si) => {
                  const chars = [...seg.text]
                  const take = Math.max(0, Math.min(chars.length, remain))
                  remain -= take
                  const visible = chars.slice(0, take).join('')
                  const hidden = chars.slice(take).join('')
                  const showCursor = !cursorPlaced && take < chars.length && shown < total
                  if (showCursor) cursorPlaced = true
                  return (
                    <span key={si} className={seg.accent ? 'tw-accent' : undefined}>
                      {visible}
                      {showCursor && <i className="tw-cursor" />}
                      {/* 아직 안 나온 글자는 자리만 차지 → 줄바꿈·레이아웃이 흔들리지 않음 */}
                      <span className="tw-ghost">{hidden}</span>
                    </span>
                  )
                })}
              </span>
            ))}
          </Tag>
        )
      })}
    </>
  )
}
