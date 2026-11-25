/**
 * Nomos, Agora — 아고라(찬반·한 줄 의견) API (Cloudflare Worker + D1)
 *
 * POST /vote     { bill, side: 'Y'|'N', text?, token } → { ok, counted, agora }
 * GET  /agora/:bill                                   → { tally, opinions }
 * POST /report   { id, token }                        → { ok, counted }
 * GET  /trending                                      → 최근 24시간 찬반 참여 수 상위 법안 (찬반 결과는 담지 않음)
 *
 * 개인정보 원칙
 * - 원본 IP·User-Agent 를 저장하지 않음. 그날만 존재하는 무작위 salt 와 섞은 SHA-256 해시만 저장.
 * - salt 는 다음 날 삭제 → 지난 해시는 누구의 것인지 되돌릴 수 없음. 중복 확인 기록은 48시간 뒤 삭제.
 * - 한 줄 의견에는 작성자 정보를 붙이지 않음.
 * 조작 방지
 * - Cloudflare Turnstile 봇 확인 (서버 검증), 같은 기기·네트워크는 법안마다 하루 한 표
 * - 의견 필터(욕설·연락처) + 신고 3건이면 자동 숨김 → 운영자 확인
 */
import { checkOpinion } from '../../shared/opinion'

export interface Env {
  DB: D1Database
  TURNSTILE_SECRET: string
  ALLOWED_ORIGINS: string
}

const WINDOW_H = 24
const KEEP_H = 48
const REPORT_HIDE = 3
const OPINION_LIMIT = 80
const BILL_RE = /^[A-Za-z0-9_]{6,64}$/

function kstDay(t = Date.now()): string {
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10)
}

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  return allowed.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {}
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } })
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function dailySalt(env: Env, day: string): Promise<string> {
  const row = await env.DB.prepare('SELECT salt FROM salts WHERE day = ?').bind(day).first<{ salt: string }>()
  if (row) return row.salt
  const salt = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')
  await env.DB.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)').bind(day, salt).run()
  const again = await env.DB.prepare('SELECT salt FROM salts WHERE day = ?').bind(day).first<{ salt: string }>()
  return again?.salt ?? salt
}

async function whoHash(env: Env, req: Request, day: string): Promise<string> {
  const salt = await dailySalt(env, day)
  return sha256(`${salt}|${req.headers.get('CF-Connecting-IP') ?? ''}|${req.headers.get('User-Agent') ?? ''}`)
}

async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  const form = new FormData()
  form.append('secret', env.TURNSTILE_SECRET)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
  const data = (await r.json()) as { success?: boolean }
  return !!data.success
}

async function cleanup(env: Env, now: number, today: string) {
  const old = now - KEEP_H * 3600_000
  await env.DB.batch([
    env.DB.prepare('DELETE FROM votes WHERE ts < ?').bind(old),
    env.DB.prepare('DELETE FROM reports WHERE ts < ?').bind(old),
    env.DB.prepare('DELETE FROM salts WHERE day < ?').bind(today),
  ])
}

interface Opinion { id: number; side: 'Y' | 'N'; text: string; ts: number }
async function agoraOf(env: Env, bill: string) {
  const [t, o] = await env.DB.batch([
    env.DB.prepare('SELECT yes, no FROM tallies WHERE bill_id = ?').bind(bill),
    env.DB.prepare('SELECT id, side, text, ts FROM opinions WHERE bill_id = ? AND hidden = 0 ORDER BY ts DESC LIMIT ?').bind(bill, OPINION_LIMIT),
  ])
  const tally = (t.results[0] as { yes: number; no: number } | undefined) ?? { yes: 0, no: 0 }
  return { tally: { yes: tally.yes, no: tally.no }, opinions: o.results as unknown as Opinion[] }
}

async function readBody<T>(req: Request): Promise<T | null> {
  try { return (await req.json()) as T } catch { return null }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const h = cors(req, env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })
    const ip = req.headers.get('CF-Connecting-IP') ?? ''

    // 최근 24시간 참여 수 (찬반 결과는 공개하지 않음) — 60초 캐시
    if (url.pathname === '/trending' && req.method === 'GET') {
      const cache = caches.default
      const key = new Request(`${url.origin}/trending`)
      const hit = await cache.match(key)
      if (hit) return new Response(hit.body, { headers: { ...Object.fromEntries(hit.headers), ...h } })
      const since = Date.now() - WINDOW_H * 3600_000
      const { results } = await env.DB.prepare(
        'SELECT bill_id AS id, COUNT(*) AS count FROM votes WHERE ts >= ? GROUP BY bill_id ORDER BY count DESC, MAX(ts) DESC LIMIT 20',
      ).bind(since).all<{ id: string; count: number }>()
      const res = json({ updated: new Date().toISOString(), window_hours: WINDOW_H, bills: results }, 200, { 'Cache-Control': 'public, max-age=60' })
      ctx.waitUntil(cache.put(key, res.clone()))
      return new Response(res.body, { headers: { ...Object.fromEntries(res.headers), ...h } })
    }

    // 법안 찬반 현황 (화면은 투표한 기기에서만 보여 줌)
    const m = url.pathname.match(/^\/agora\/([A-Za-z0-9_]{6,64})$/)
    if (m && req.method === 'GET') {
      return json(await agoraOf(env, m[1]), 200, { ...h, 'Cache-Control': 'no-store' })
    }

    if (url.pathname === '/vote' && req.method === 'POST') {
      if (!h['Access-Control-Allow-Origin']) return json({ ok: false, error: 'origin' }, 403, h)
      const body = await readBody<{ bill?: string; side?: string; text?: string; token?: string }>(req)
      if (!body) return json({ ok: false, error: 'bad_json' }, 400, h)
      const bill = String(body.bill ?? '')
      const side = body.side === 'Y' || body.side === 'N' ? body.side : null
      const token = String(body.token ?? '')
      if (!BILL_RE.test(bill) || !side || !token) return json({ ok: false, error: 'bad_request' }, 400, h)
      let text: string | null = null
      if (typeof body.text === 'string' && body.text.trim()) {
        const c = checkOpinion(body.text)
        if (!c.ok) return json({ ok: false, error: 'filtered', reason: c.reason }, 422, h)
        text = c.text
      }
      if (!(await verifyTurnstile(env, token, ip))) return json({ ok: false, error: 'bot_check' }, 403, h)

      const now = Date.now()
      const day = kstDay(now)
      const who = await whoHash(env, req, day)
      const r = await env.DB.prepare('INSERT OR IGNORE INTO votes (day, who, bill_id, side, ts) VALUES (?, ?, ?, ?, ?)')
        .bind(day, who, bill, side, now).run()
      const counted = (r.meta.changes ?? 0) > 0
      if (counted) {
        const col = side === 'Y' ? 'yes' : 'no'
        const ops = [
          env.DB.prepare(`INSERT INTO tallies (bill_id, yes, no, updated) VALUES (?, ?, ?, ?)
            ON CONFLICT(bill_id) DO UPDATE SET ${col} = ${col} + 1, updated = excluded.updated`)
            .bind(bill, side === 'Y' ? 1 : 0, side === 'N' ? 1 : 0, now),
        ]
        if (text) ops.push(env.DB.prepare('INSERT INTO opinions (bill_id, side, text, ts) VALUES (?, ?, ?, ?)').bind(bill, side, text, now))
        await env.DB.batch(ops)
      }
      ctx.waitUntil(cleanup(env, now, day))
      return json({ ok: true, counted, agora: await agoraOf(env, bill) }, 200, h)
    }

    if (url.pathname === '/report' && req.method === 'POST') {
      if (!h['Access-Control-Allow-Origin']) return json({ ok: false, error: 'origin' }, 403, h)
      const body = await readBody<{ id?: number; token?: string }>(req)
      const id = Number(body?.id)
      const token = String(body?.token ?? '')
      if (!Number.isInteger(id) || id <= 0 || !token) return json({ ok: false, error: 'bad_request' }, 400, h)
      if (!(await verifyTurnstile(env, token, ip))) return json({ ok: false, error: 'bot_check' }, 403, h)
      const now = Date.now()
      const day = kstDay(now)
      const who = await whoHash(env, req, day)
      const r = await env.DB.prepare('INSERT OR IGNORE INTO reports (day, who, opinion_id, ts) SELECT ?, ?, id, ? FROM opinions WHERE id = ?')
        .bind(day, who, now, id).run()
      const counted = (r.meta.changes ?? 0) > 0
      if (counted) {
        await env.DB.prepare(`UPDATE opinions SET reports = reports + 1,
          hidden = CASE WHEN reviewed = 0 AND reports + 1 >= ? THEN 1 ELSE hidden END WHERE id = ?`).bind(REPORT_HIDE, id).run()
      }
      return json({ ok: true, counted }, 200, h)
    }

    return json({ ok: false, error: 'not_found' }, 404, h)
  },
}
