import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { BillIndexItem, Member, Meta } from '../types'
import { STAGE_SHORT, daysSince, fmtDate, fmtDateTime } from '../lib/format'
import { HEMI_H, HEMI_W, hemicycleSeats } from '../lib/hemicycle'
import { preloadPhotos } from '../lib/preload'
import { Typewriter, type TypeBlock } from './Typewriter'

interface Props {
  meta: Meta | null
  bills: BillIndexItem[]
  members: Member[]
  partyColor: (p: string) => string
  onExplore: () => void
  onOpenBill: (id: string) => void
}

const PENDING = new Set(['proposed', 'committee', 'judiciary', 'plenary'])
const DAY = 86400000

/** 기준일: 데이터 갱신 시각(KST)의 날짜 */
function refDate(meta: Meta | null): Date {
  const d = meta ? new Date(meta.updated) : new Date()
  return Number.isNaN(d.getTime()) ? new Date() : d
}

const HERO: TypeBlock[] = [
  {
    tag: 'h1', speed: 95,
    lines: [
      [{ text: '법안에 올린 ' }, { text: '이름', accent: true }, { text: '은' }],
      [{ text: '역사', accent: true }, { text: '에 남습니다.' }],
    ],
  },
  {
    tag: 'p', className: 'lp-lead', speed: 95,
    lines: [
      [{ text: '국회의원이 어떤 법안을 내고, 누가 심사하고, 어떻게 표결했는지' }],
      [{ text: '국회 공식 기록 그대로 보여 드립니다.' }],
    ],
  },
]

export function Landing({ meta, bills, members, onExplore, onOpenBill }: Props) {
  const [typed, setTyped] = useState(false)
  // 의원 사진을 낮은 우선순위로 미리 받아 둠
  // 타이핑 연출이 끝난 뒤에 시작 (동시에 하면 글자가 멈칫거림)
  useEffect(() => { if (typed && members.length) preloadPhotos(members.map((m) => m.photo)) }, [typed, members])

  const ref = refDate(meta)
  const since = (iso: string) => ref.getTime() - new Date(`${iso}T00:00:00+09:00`).getTime()

  const today = useMemo(() => {
    // 가장 최근 발의일 (주말·공휴일엔 오늘 발의가 없을 수 있음)
    const latest = bills.reduce((a, b) => (b.propose_date > a ? b.propose_date : a), '')
    const newest = bills.filter((b) => b.propose_date === latest)
    const voted = bills
      .filter((b) => b.stage === 'voted' && since(b.stage_since) <= 7 * DAY)
      .sort((a, b) => b.stage_since.localeCompare(a.stage_since))
    const advanced = bills
      .filter((b) => (b.stage === 'judiciary' || b.stage === 'plenary') && since(b.stage_since) <= 7 * DAY)
      .sort((a, b) => b.stage_since.localeCompare(a.stage_since))
    // 상임위를 통과한 뒤 다음 단계에서 오래 기다리는 법안
    const stalled = bills
      .filter((b) => b.stage === 'judiciary' || b.stage === 'plenary')
      .sort((a, b) => a.stage_since.localeCompare(b.stage_since))
    return { latest, newest, voted, advanced, stalled }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, meta])

  const counts = useMemo(() => ({
    total: bills.length,
    pending: bills.filter((b) => PENDING.has(b.stage)).length,
    voted: bills.filter((b) => b.stage === 'voted').length,
    closed: bills.filter((b) => b.stage === 'closed').length,
  }), [bills])

  // 배경 좌석도는 정당색 없이 단색 HUD 와이어프레임 (색 배치가 다른 상징으로 오해되지 않게)
  const seats = useMemo(() => hemicycleSeats(members.length || 300), [members.length])

  return (
    <div className="landing">
      {/* 1. 첫 화면 */}
      <section className="lp-hero">
        <svg className="lp-hemi" viewBox={`0 0 ${HEMI_W} ${HEMI_H}`} aria-hidden>
          {seats.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.78} style={{ animationDelay: `${Math.round((1 - s.angle / Math.PI) * 1400 + s.row * 40)}ms` }} />
          ))}
        </svg>
        <div className="lp-hero-text">
          <Typewriter blocks={HERO} onDone={() => setTyped(true)} />
          <div className={`lp-cta-wrap${typed ? ' show' : ''}`}>
            <HudButton onClick={onExplore}>법안 둘러보기</HudButton>
          </div>
        </div>
      </section>

      {/* 3. 숫자로 보는 22대 국회 */}
      <section className="lp-section lp-stats-section">
        <h2>숫자로 보는 {meta?.age ?? 22}대 국회</h2>
        <div className="lp-stats">
          <Stat label="발의된 법안" value={counts.total} />
          <Stat label="심사 중인 법안" value={counts.pending} />
          <Stat label="본회의 표결 완료" value={counts.voted} />
          <Stat label="폐기·대안반영 등 종료" value={counts.closed} />
          <Stat label="현직 국회의원" value={members.length} unit="명" />
        </div>
      </section>

      {/* 2. 오늘의 국회 */}
      <section className="lp-section">
        <h2>오늘의 국회</h2>
        <p className="lp-sub">{meta ? `${fmtDateTime(meta.updated)} 기준 · 평일 09~19시 매시간 갱신` : ''}</p>
        <div className="lp-feed">
          <FeedCard
            title={today.latest ? `새로 발의된 법안 · ${fmtDate(today.latest)}` : '새로 발의된 법안'}
            count={today.newest.length}
            items={today.newest}
            empty="최근 발의된 법안이 없습니다."
            meta={(b) => (b.lead_name ? `${b.lead_name} 등 ${b.proposer_count}인` : `${b.proposer_count}인`)}
            onOpen={onOpenBill}
          />
          <FeedCard
            title="이번 주 본회의 표결"
            count={today.voted.length}
            items={today.voted}
            empty="최근 7일간 본회의 표결이 없습니다."
            meta={(b) => `${b.result ?? '표결 완료'} · ${fmtDate(b.stage_since)}`}
            onOpen={onOpenBill}
          />
          <FeedCard
            title="이번 주 다음 단계로 넘어간 법안"
            count={today.advanced.length}
            items={today.advanced}
            empty="최근 7일간 단계가 바뀐 법안이 없습니다."
            meta={(b) => `${STAGE_SHORT[b.stage]} · ${fmtDate(b.stage_since)}`}
            onOpen={onOpenBill}
          />
          <FeedCard
            title="다음 단계를 가장 오래 기다리는 법안"
            note="상임위를 통과한 뒤 법사위·본회의에서 멈춰 있는 기간 순"
            items={today.stalled}
            empty="해당 법안이 없습니다."
            meta={(b) => `${STAGE_SHORT[b.stage]}에서 ${daysSince(b.stage_since)}일째`}
            highlight
            onOpen={onOpenBill}
          />
        </div>
      </section>

      {/* 4. 법안은 이렇게 만들어져요 */}
      <section className="lp-section">
        <h2>법안은 이렇게 만들어져요</h2>
        <ol className="lp-steps">
          <li>
            <span className="lp-step-no">01</span>
            <strong>발의</strong>
            <p>의원 10명 이상이 이름을 올려 법안을 냅니다. 대표발의자 1명과 공동발의자로 나뉩니다.</p>
          </li>
          <li>
            <span className="lp-step-no">02</span>
            <strong>소관 상임위원회</strong>
            <p>분야별 위원회가 내용을 심사합니다. 대부분의 법안이 이 단계에 머물러 있습니다.</p>
          </li>
          <li>
            <span className="lp-step-no">03</span>
            <strong>법제사법위원회</strong>
            <p>다른 법과 충돌하지 않는지, 문구가 맞는지 체계·자구를 심사합니다.</p>
          </li>
          <li>
            <span className="lp-step-no">04</span>
            <strong>본회의</strong>
            <p>국회의원 전체가 표결합니다. 의원 한 명 한 명의 찬성·반대·기권이 기록됩니다.</p>
          </li>
        </ol>
        <div className="lp-legend">
          <p className="lp-legend-title">좌석도 읽는 법</p>
          <ul>
            <li><i className="dot" style={{ background: '#ff8a4c' }} />대표발의</li>
            <li><i className="dot" style={{ background: '#ffffff' }} />공동발의</li>
            <li><i className="dot ring" />심사 중인 위원회 위원</li>
            <li><i className="dot" style={{ background: '#47c9ed' }} />본회의 찬성</li>
            <li><i className="dot" style={{ background: '#ff8a4c' }} />본회의 반대</li>
            <li><i className="dot outline" />테두리 색 = 소속 정당</li>
          </ul>
        </div>
      </section>

      {/* 5. 원칙 */}
      <section className="lp-section lp-principles">
        <h2>이 사이트의 원칙</h2>
        <ul>
          <li><strong>공식 기록만 씁니다.</strong><span>모든 수치와 기록의 출처는 국회 열린국회정보(open.assembly.go.kr)이며, 평일 09~19시 매시간 자동으로 갱신됩니다.</span></li>
          <li><strong>요약하거나 평가하지 않습니다.</strong><span>법안 내용을 해석하거나 의원을 평가하지 않습니다. 판단은 보시는 분의 몫입니다.</span></li>
          <li><strong>개인정보를 수집하지 않습니다.</strong><span>회원가입·로그인이 없고, 방문 분석·광고 추적 도구를 쓰지 않습니다.</span></li>
        </ul>
        <HudButton onClick={onExplore}>법안 둘러보기</HudButton>
      </section>
    </div>
  )
}

/** 화면에 보일 때 0 → value 로 1.6초간 올라가는 숫자 (동작 줄이기 설정이면 바로 표시) */
function useCountUp(value: number): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el || !value) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(value); return }
    let raf = 0
    const run = () => {
      const t0 = performance.now(), dur = 1600
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / dur)
        setN(Math.round(value * (1 - Math.pow(1 - k, 3))))
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); run() } }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value])
  return [ref, n]
}

function HudButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button className="hud-cta" onClick={onClick}>
      <span>{children}</span>
    </button>
  )
}

function Stat({ label, value, unit = '건' }: { label: string; value: number; unit?: string }) {
  const [ref, shown] = useCountUp(value)
  return (
    <div className="lp-stat" ref={ref}>
      <b>{shown.toLocaleString()}<small>{unit}</small></b>
      <span>{label}</span>
    </div>
  )
}

function FeedCard({
  title, note, count, items, empty, meta, onOpen, highlight,
}: {
  title: string
  note?: string
  count?: number
  items: BillIndexItem[]
  empty: string
  meta: (b: BillIndexItem) => string
  onOpen: (id: string) => void
  highlight?: boolean
}) {
  return (
    <article className="lp-card">
      <header>
        <h3>{title}</h3>
        {count !== undefined && <span className="lp-count">{count.toLocaleString()}건</span>}
      </header>
      {note && <p className="lp-note">{note}</p>}
      {items.length === 0 ? (
        <p className="lp-empty">{empty}</p>
      ) : (
        <ul>
          {items.slice(0, 5).map((b) => (
            <li key={b.id}>
              <button onClick={() => onOpen(b.id)}>
                <span className="t">{b.title}</span>
                <span className={`m${highlight ? ' hl' : ''}`}>{meta(b)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
