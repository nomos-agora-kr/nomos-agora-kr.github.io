import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { BillIndexItem } from '../types'
import { STAGE_SHORT } from '../lib/format'
import {
  AgoraError, type AgoraData, type MyRecord, type Opinion, type Side, type TrendingItem,
  fetchAgora, fetchTrending, getBotToken, kstDay, loadAgoraConfig, myRecord, sendReport, sendVote,
} from '../lib/agora'
import { OPINION_MAX, REASON_TEXT, checkOpinion } from '../../shared/opinion'

const SIDE_LABEL: Record<Side, string> = { Y: '찬성', N: '반대' }

/** 최근 24시간 참여 순위 (null = 아고라 서버 미연결) — 60초마다 갱신 */
export function useTrending(): TrendingItem[] | null | undefined {
  const [items, setItems] = useState<TrendingItem[] | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () => fetchTrending().then((x) => alive && setItems(x)).catch(() => alive && setItems([]))
    load()
    const t = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return items
}

function useAgoraReady(): boolean | undefined {
  const [ready, setReady] = useState<boolean | undefined>(undefined)
  useEffect(() => { loadAgoraConfig().then((a) => setReady(!!a)) }, [])
  return ready
}

/* ───────────── 아고라 첫 화면: 지금 참여가 많은 법안 ───────────── */

export function AgoraHome({ bills, onOpen }: { bills: BillIndexItem[]; onOpen: (id: string) => void }) {
  const ready = useAgoraReady()
  const trending = useTrending()
  const byId = useMemo(() => new Map(bills.map((b) => [b.id, b])), [bills])
  const list = (trending ?? []).filter((x) => byId.has(x.id))

  return (
    <section className="agora-home">
      <div className="hero-title">
        <p>AGORA · 찬반 현황</p>
        <h1>법안에 대한 시민의 한 표와 한 줄</h1>
        <span>왼쪽에서 법안을 골라 찬성·반대를 남겨 보세요. 법안마다 하루 한 번, 매일 누적됩니다. 결과와 의견은 투표한 뒤에 보입니다.</span>
      </div>

      {ready === false && <AgoraOffline />}

      {ready && (
        <div className="hud-panel agora-rank">
          <div className="stage-panel-head">
            <span className="card-overline">최근 24시간 참여가 많은 법안</span>
            <span className="muted small">찬성+반대 투표 수 기준 · 결과는 투표 후 공개</span>
          </div>
          {trending === undefined ? (
            <p className="muted">불러오는 중…</p>
          ) : list.length === 0 ? (
            <p className="agora-empty">아직 오늘의 참여가 없어요. 관심 있는 법안을 열어 첫 한 표를 남겨 보세요.</p>
          ) : (
            <ol className="rank-list">
              {list.map((x, i) => {
                const b = byId.get(x.id)!
                return (
                  <li key={x.id} className={i < 5 ? 'top' : ''}>
                    <button onClick={() => onOpen(x.id)}>
                      <b className="rk">{i + 1}</b>
                      <span className="t">{b.title}</span>
                      <span className={`stage-chip s-${b.stage}`}>{STAGE_SHORT[b.stage]}</span>
                      <small>{x.count.toLocaleString()}표</small>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}

      <div className="hud-panel agora-rules">
        <span className="card-overline">아고라 이용 규칙</span>
        <ul>
          <li><b>하루 한 표</b>법안마다 하루에 한 번 찬성 또는 반대를 누를 수 있고, 매일 누적됩니다.</li>
          <li><b>한 줄 의견</b>투표할 때 {OPINION_MAX}자 이내로 이유를 남길 수 있어요. 욕설·비하 표현, 전화번호·주소는 쓸 수 없습니다.</li>
          <li><b>신고</b>부적절한 의견은 신고해 주세요. 신고가 쌓이면 바로 숨겨지고, 운영자가 확인 후 삭제합니다.</li>
          <li><b>내 기록</b>며칠 찬성·반대했는지는 이 기기에만 저장되고, 서버는 누가 투표했는지 알지 못합니다.</li>
        </ul>
      </div>
    </section>
  )
}

function AgoraOffline() {
  return (
    <div className="hud-panel agora-offline">
      <strong>아고라를 준비하고 있습니다.</strong>
      <span>찬반 서버가 연결되면 이곳에서 투표와 한 줄 의견을 남길 수 있어요.</span>
    </div>
  )
}

/* ───────────── 법안별 찬반 ───────────── */

interface BillProps { bill: BillIndexItem | undefined; billId: string; onNomos: () => void }

export function AgoraBill({ bill, billId, onNomos }: BillProps) {
  const ready = useAgoraReady()
  const [data, setData] = useState<AgoraData | null>(null)
  const [rec, setRec] = useState<MyRecord>(() => myRecord(billId))
  const [open, setOpen] = useState<Side | null>(null)
  const [notice, setNotice] = useState('')
  const hostRef = useRef<HTMLDivElement>(null)

  const today = kstDay()
  const votedToday = rec.days[today]
  const everVoted = Object.keys(rec.days).length > 0

  useEffect(() => {
    setRec(myRecord(billId)); setData(null); setOpen(null); setNotice('')
  }, [billId])
  // 결과는 투표한 기기에서만 불러옴
  useEffect(() => {
    if (!ready || !everVoted || data) return
    let alive = true
    fetchAgora(billId).then((d) => alive && d && setData(d)).catch(() => {})
    return () => { alive = false }
  }, [ready, everVoted, billId, data])

  // 투표한 기기에서는 20초마다 새 의견을 받아 옴 (화면을 보고 있을 때만)
  useEffect(() => {
    if (!ready || !everVoted) return
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      fetchAgora(billId).then((d) => d && setData(d)).catch(() => {})
    }, 20_000)
    return () => clearInterval(t)
  }, [ready, everVoted, billId])

  const onVoted = (d: AgoraData, counted: boolean, hadText: boolean) => {
    setData(d); setRec(myRecord(billId)); setOpen(null)
    setNotice(counted ? '' : `오늘 이 기기·네트워크에서 이미 참여한 기록이 있어 이번 표${hadText ? '와 의견' : ''}은 집계되지 않았어요. 내일 다시 참여할 수 있어요.`)
  }

  return (
    <article className="agora-bill">
      <header className="hud-panel agora-head">
        <div className="bill-head-top">
          <span className="card-overline">
            {bill ? `의안번호 ${bill.no} · ${bill.committee ?? '소관위 미정'}` : '법안'}
            {bill && <span className={`stage-chip s-${bill.stage}`}>{STAGE_SHORT[bill.stage]}</span>}
          </span>
          <button className="agora-link" onClick={onNomos}>노모스에서 법안 기록 보기</button>
        </div>
        <h1>{bill?.title ?? billId}</h1>
        {ready && <MyRecordStrip rec={rec} />}
      </header>

      {ready === false ? (
        <AgoraOffline />
      ) : (
        <>
          {notice && <p className="agora-notice" role="status">{notice}</p>}
          {data && <RatioBar yes={data.tally.yes} no={data.tally.no} />}
          <div className="vote-cards">
            {(['Y', 'N'] as const).map((s) => (
              <VoteCard
                key={s}
                side={s}
                billId={billId}
                data={data}
                rec={rec}
                votedToday={votedToday}
                open={open === s}
                onOpen={() => setOpen(s)}
                onClose={() => setOpen(null)}
                onVoted={onVoted}
                onReported={() => setRec(myRecord(billId))}
                host={hostRef}
              />
            ))}
          </div>
          <p className="hint agora-foot">
            찬반 수는 이 사이트 이용자의 참여 기록이며 여론조사가 아닙니다. 같은 기기·네트워크에서는 법안마다 하루 한 번만 집계됩니다.
          </p>
        </>
      )}
      <div ref={hostRef} className="turnstile-host" />
    </article>
  )
}

/** 이 기기의 참여 기록: 며칠째 찬성/반대했는지 (열렬함) */
function MyRecordStrip({ rec }: { rec: MyRecord }) {
  const days = Object.entries(rec.days).sort((a, b) => a[0].localeCompare(b[0]))
  if (!days.length) return <p className="my-record empty">아직 이 법안에 참여하지 않았어요.</p>
  const y = days.filter(([, s]) => s === 'Y').length
  const n = days.length - y
  const main: Side = y >= n ? 'Y' : 'N'
  const k = Math.max(y, n)
  const heat = k >= 7 ? '열렬히' : k >= 3 ? '꾸준히' : ''
  return (
    <div className="my-record">
      <span className="lb">내 기록 <small>이 기기에만 저장</small></span>
      <span className={`heat side-${main}`}>
        {heat && <b>{heat} </b>}{SIDE_LABEL[main]} 중 · {k}일
        {y > 0 && n > 0 && <small> (찬성 {y}일 · 반대 {n}일)</small>}
      </span>
      <span className="pips" aria-hidden>
        {days.slice(-14).map(([d, s]) => <i key={d} className={`side-${s}`} title={`${d} ${SIDE_LABEL[s]}`} />)}
      </span>
    </div>
  )
}

function RatioBar({ yes, no }: { yes: number; no: number }) {
  const t = yes + no || 1
  return (
    <div className="ratio" aria-label={`찬성 ${yes}표, 반대 ${no}표`}>
      <span className="y" style={{ width: `${(yes / t) * 100}%` }} />
      <span className="n" style={{ width: `${(no / t) * 100}%` }} />
    </div>
  )
}

interface CardProps {
  side: Side
  billId: string
  data: AgoraData | null
  rec: MyRecord
  votedToday: Side | undefined
  open: boolean
  onOpen: () => void
  onClose: () => void
  onVoted: (d: AgoraData, counted: boolean, hadText: boolean) => void
  onReported: () => void
  host: RefObject<HTMLDivElement | null>
}


function VoteCard({ side, billId, data, rec, votedToday, open, onOpen, onClose, onVoted, onReported, host }: CardProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { setText(''); setErr('') }, [billId])

  const count = data ? (side === 'Y' ? data.tally.yes : data.tally.no) : null
  const ops = data ? data.opinions.filter((o) => o.side === side) : []
  const len = [...text].length
  const mineToday = votedToday === side

  const submit = async () => {
    if (busy) return
    if (text.trim()) {
      const c = checkOpinion(text)
      if (!c.ok) { setErr(REASON_TEXT[c.reason]); return }
    }
    setBusy(true); setErr('')
    try {
      const token = await getBotToken(host.current!)
      const r = await sendVote(billId, side, text, token)
      setText('')
      onVoted(r.agora, r.counted, !!text.trim())
    } catch (e) {
      const ae = e as AgoraError
      setErr(ae.code === 'filtered' && ae.reason ? REASON_TEXT[ae.reason as keyof typeof REASON_TEXT] : ae.code === 'bot_check' ? '보안 확인에 실패했어요. 다시 시도해 주세요' : '잠시 후 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`vote-card side-${side}${mineToday ? ' chosen' : ''}${votedToday && !mineToday ? ' other' : ''}`}>
      <header>
        <h2>{SIDE_LABEL[side]}</h2>
        {count != null ? (
          <p className="count"><b>{count.toLocaleString()}</b>표</p>
        ) : (
          <p className="count locked"><b>?</b>표<small>투표하면 공개</small></p>
        )}
      </header>

      <div className="vote-action">
        {votedToday ? (
          <p className="voted-note">
            {mineToday ? `오늘 ${SIDE_LABEL[side]}했어요 ✓` : `오늘은 ${SIDE_LABEL[votedToday]}했어요`}
            <small>내일 다시 참여할 수 있어요 · 매일 누적됩니다</small>
          </p>
        ) : open ? (
          <div className="composer">
            <label>
              <span>{SIDE_LABEL[side]}하는 이유 한 줄 <small>(선택)</small></span>
              <input
                autoFocus
                value={text}
                maxLength={OPINION_MAX + 10}
                onChange={(e) => { setText(e.target.value); setErr('') }}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder={side === 'Y' ? '예: 꼭 필요한 법이라고 생각해요' : '예: 취지는 좋지만 보완이 필요해요'}
              />
            </label>
            <div className="composer-row">
              <span className={`len${len > OPINION_MAX ? ' over' : ''}`}>{len} / {OPINION_MAX}</span>
              {err && <span className="err">{err}</span>}
              <button className="ghost-btn" onClick={onClose} disabled={busy}>취소</button>
              <button className="vote-send" onClick={submit} disabled={busy || len > OPINION_MAX}>
                {busy ? '확인 중…' : `${SIDE_LABEL[side]} 보내기`}
              </button>
            </div>
          </div>
        ) : (
          <button className="vote-btn" onClick={onOpen}>{SIDE_LABEL[side]}합니다</button>
        )}
      </div>

      {!data ? (
        <p className="wall-locked">투표하면 시민들의 한 줄 의견이 보여요</p>
      ) : (
        <ChatFeed side={side} ops={ops} rec={rec} billId={billId} host={host} onReported={onReported} />
      )}
    </section>
  )
}

function ago(ts: number): string {
  const s = (Date.now() - ts) / 1000
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  const d = new Date(ts + 9 * 3600_000)
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`
}

/**
 * 실시간 댓글창처럼 정돈된 한 줄들이 아래에서 위로 쌓여 올라감
 * - 처음 공개될 때 오래된 것부터 차례로 흘러 들어옴
 * - 새 의견은 맨 아래에 붙고, 사용자가 맨 아래를 보고 있을 때만 자동으로 따라 내려감
 */
function ChatFeed({ side, ops, rec, billId, host, onReported }: {
  side: Side; ops: Opinion[]; rec: MyRecord; billId: string
  host: RefObject<HTMLDivElement | null>; onReported: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useRef<Set<number> | null>(null)
  const pinned = useRef(true)
  const lines = useMemo(() => [...ops].reverse(), [ops]) // 서버는 최신순 → 화면은 오래된 것이 위
  // 처음 그릴 때만 순서대로 흘러 들어오는 지연, 그 뒤 새로 온 줄은 바로
  const first = seen.current === null
  const delays = new Map<number, number>()
  if (first) lines.forEach((o, i) => delays.set(o.id, Math.min(i, 24) * 70))
  const fresh = new Set(lines.filter((o) => !seen.current?.has(o.id)).map((o) => o.id))
  useEffect(() => { seen.current = new Set(lines.map((o) => o.id)) }, [lines])
  useEffect(() => {
    const el = ref.current
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: first ? 'auto' : 'smooth' })
  }, [lines, first])
  const onScroll = () => {
    const el = ref.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }
  if (!lines.length) return <p className="wall-locked">아직 {SIDE_LABEL[side]} 의견이 없어요</p>
  return (
    <div className="chat-feed" ref={ref} onScroll={onScroll} role="log" aria-live="polite" aria-label={`${SIDE_LABEL[side]} 한 줄 의견`}>
      <ol>
        {lines.map((o) => (
          <ChatLine
            key={o.id}
            o={o}
            mine={rec.mine.includes(o.id)}
            reported={rec.reported.includes(o.id)}
            delay={fresh.has(o.id) ? delays.get(o.id) ?? 0 : -1}
            billId={billId}
            host={host}
            onReported={onReported}
          />
        ))}
      </ol>
    </div>
  )
}

function ChatLine({ o, mine, reported, delay, billId, host, onReported }: {
  o: Opinion; mine: boolean; reported: boolean; delay: number; billId: string
  host: RefObject<HTMLDivElement | null>; onReported: () => void
}) {
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const report = async () => {
    setBusy(true)
    try {
      const token = await getBotToken(host.current!)
      await sendReport(billId, o.id, token)
      onReported()
    } catch { /* 다음에 다시 */ } finally { setBusy(false); setAsk(false) }
  }
  return (
    <li className={`chat-line${mine ? ' mine' : ''}${delay >= 0 ? ' in' : ''}`} style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}>
      <p>{o.text}</p>
      <span className="meta">
        <time>{mine ? '내 의견 · ' : ''}{ago(o.ts)}</time>
        {!mine && (reported ? (
          <span className="reported">신고함</span>
        ) : ask ? (
          <span className="ask">신고할까요? <button onClick={report} disabled={busy}>{busy ? '…' : '예'}</button><button onClick={() => setAsk(false)}>아니요</button></span>
        ) : (
          <button className="rp" onClick={() => setAsk(true)} aria-label="이 의견 신고">신고</button>
        ))}
      </span>
    </li>
  )
}
