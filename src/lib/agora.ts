/**
 * 아고라(찬반·한 줄 의견) 클라이언트
 * - API 주소: 빌드 환경변수 VITE_AGORA_API(로컬 시험용) → 없으면 배포 워크플로가 기록한 data/agora.json
 * - 봇 확인: Cloudflare Turnstile (보낼 때만 스크립트를 불러옴)
 * - 내 참여 기록(며칠 찬성/반대했는지, 신고한 글)은 이 기기 브라우저에만 저장 — 서버는 모름
 */
const ENV_API = (import.meta.env.VITE_AGORA_API as string | undefined)?.replace(/\/$/, '') ?? ''
let API = ENV_API
let configP: Promise<string> | null = null
export function loadAgoraConfig(): Promise<string> {
  if (ENV_API) return Promise.resolve(ENV_API)
  if (!configP) {
    configP = fetch(`${import.meta.env.BASE_URL}data/agora.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { api?: string }) => (API = (d.api ?? '').replace(/\/$/, '')))
      .catch(() => '')
  }
  return configP
}
export const agoraReadySync = () => !!API
export const TURNSTILE_SITE_KEY = '0x4AAAAAAGR9IdaMijat_tJB'

type Turnstile = { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void }
declare global { interface Window { turnstile?: Turnstile } }

let scriptP: Promise<Turnstile> | null = null
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptP) {
    scriptP = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
      s.onerror = () => { scriptP = null; reject(new Error('turnstile')) }
      document.head.appendChild(s)
    })
  }
  return scriptP
}

/** host 안에 Turnstile 을 그려 토큰을 받음. 대부분 자동 통과, 의심스러울 때만 체크박스가 보임 */
export async function getBotToken(host: HTMLElement): Promise<string> {
  // 로컬 시험 서버는 Turnstile 검증을 흉내 내므로 아무 토큰이나 통과
  if (import.meta.env.DEV && ENV_API.includes('localhost')) return 'local-test'
  const ts = await loadTurnstile()
  return new Promise((resolve, reject) => {
    const id = ts.render(host, {
      sitekey: TURNSTILE_SITE_KEY,
      appearance: 'interaction-only',
      theme: 'dark',
      language: 'ko',
      callback: (token: string) => { resolve(token); setTimeout(() => ts.remove(id), 0) },
      'error-callback': () => { reject(new Error('bot_check')); setTimeout(() => ts.remove(id), 0) },
      'expired-callback': () => reject(new Error('expired')),
    })
  })
}

export type Side = 'Y' | 'N'
export interface Opinion { id: number; side: Side; text: string; ts: number }
export interface AgoraData { tally: { yes: number; no: number }; opinions: Opinion[] }

export function kstDay(t = Date.now()) { return new Date(t + 9 * 3600_000).toISOString().slice(0, 10) }

/** 이 기기의 참여 기록 (서버에는 없음) */
export interface MyRecord { days: Record<string, Side>; mine: number[]; reported: number[] }
const recKey = (bill: string) => `nomos:agora:${bill}`
export function myRecord(bill: string): MyRecord {
  try {
    const r = JSON.parse(localStorage.getItem(recKey(bill)) ?? '') as Partial<MyRecord>
    return { days: r.days ?? {}, mine: r.mine ?? [], reported: r.reported ?? [] }
  } catch { return { days: {}, mine: [], reported: [] } }
}
function saveRecord(bill: string, r: MyRecord) {
  try { localStorage.setItem(recKey(bill), JSON.stringify(r)) } catch { /* 저장소를 못 쓰는 환경 */ }
}

export class AgoraError extends Error { constructor(public code: string, public reason?: string) { super(code) } }

async function post<T>(path: string, body: unknown): Promise<T> {
  await loadAgoraConfig()
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = (await r.json().catch(() => ({}))) as T & { ok?: boolean; error?: string; reason?: string }
  if (!r.ok || !d.ok) throw new AgoraError(d.error ?? `http_${r.status}`, d.reason)
  return d
}

export async function sendVote(bill: string, side: Side, text: string, token: string): Promise<{ counted: boolean; agora: AgoraData }> {
  const d = await post<{ counted: boolean; agora: AgoraData }>('/vote', { bill, side, text: text.trim() || undefined, token })
  const rec = myRecord(bill)
  const today = kstDay()
  if (d.counted) {
    rec.days[today] = side
    const t = text.trim()
    if (t) {
      const o = d.agora.opinions.find((x) => x.side === side && x.text === t.replace(/\s+/g, ' ') && !rec.mine.includes(x.id))
      if (o) rec.mine.push(o.id)
    }
  } else if (!rec.days[today]) {
    rec.days[today] = side // 다른 화면·탭에서 이미 투표함
  }
  saveRecord(bill, rec)
  return d
}

export async function sendReport(bill: string, id: number, token: string): Promise<void> {
  await post('/report', { id, token })
  const rec = myRecord(bill)
  if (!rec.reported.includes(id)) rec.reported.push(id)
  saveRecord(bill, rec)
}

export async function fetchAgora(bill: string): Promise<AgoraData | null> {
  await loadAgoraConfig()
  if (!API) return null
  const r = await fetch(`${API}/agora/${encodeURIComponent(bill)}`)
  return r.ok ? ((await r.json()) as AgoraData) : null
}

export interface TrendingItem { id: string; count: number }
export async function fetchTrending(): Promise<TrendingItem[] | null> {
  await loadAgoraConfig()
  if (!API) return null
  const r = await fetch(`${API}/trending`)
  if (!r.ok) return []
  const d = (await r.json()) as { bills?: TrendingItem[] }
  return d.bills ?? []
}
