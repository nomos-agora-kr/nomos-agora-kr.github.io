// 로컬 시험 전용 진입점 (배포 안 됨): Turnstile 검증 서버 응답을 흉내 냄. 토큰 'bad' 는 실패.
import worker from '../src/index'
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (u.includes('turnstile/v0/siteverify')) {
    const tok = (init?.body as FormData).get('response')
    return new Response(JSON.stringify({ success: tok !== 'bad' }))
  }
  return realFetch(input as RequestInfo, init)
}) as typeof fetch
export default worker
