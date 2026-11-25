/**
 * 한 줄 의견 규칙 (브라우저·서버 공용)
 * - 30자 이하, 공백만 있는 글 불가
 * - 기본 욕설·비속어, 대표적인 혐오 표현 차단 (띄어쓰기·숫자·기호를 끼워 넣은 변형 포함)
 * - 전화번호·계좌번호처럼 긴 숫자, 이메일, 인터넷 주소 차단 (개인정보·광고 방지)
 * 완벽하지 않으므로 신고 → 자동 숨김 → 운영자 확인이 2차 방어선
 */
export const OPINION_MAX = 30

export type OpinionCheck = { ok: true; text: string } | { ok: false; reason: 'empty' | 'length' | 'profanity' | 'contact' }

// 정규화 후 부분 일치로 찾음 (공백·숫자·기호 제거, 소문자)
const BAD = [
  '씨발', '시발', '씨바', '씨팔', '시팔', '쓰발', '씨벌', 'ㅅㅂ', 'ㅆㅂ', 'ㅅㅃ', 'sibal', 'ssibal',
  '병신', '븅신', '빙신', '병쉰', 'ㅂㅅ', '좆', 'ㅈ같', '존나', 'ㅈㄴ', '지랄', 'ㅈㄹ',
  '개새끼', '개새', '개색', '개세끼', '개쉐', 'ㄱㅅㄲ', 'ㅅㄲ', '새끼야', '썅', '씹',
  '미친놈', '미친년', '미친새', '또라이', '엠창', '느금', '니애미', '니애비', '니미럴', '애미뒤', '느그애미',
  '꺼지라', '뒤져라', '뒈져', '죽어라',
  // 대표적인 혐오 표현
  '한남충', '김치녀', '된장녀', '틀딱', '쪽바리', '짱깨', '맘충', '급식충', '똥남아',
  'fuck', 'shit', 'bitch',
]
// 흔한 낱말 속에 우연히 들어간 경우 (예: '시발점', 병신년(丙申年))는 허용
const ALLOW = ['시발점', '시발역', '시바견', '병신년', '병신정변', '씹다', '씹어', '씹는']

export function normalizeForFilter(s: string): string {
  let t = s.normalize('NFKC').toLowerCase()
  for (const a of ALLOW) t = t.split(a).join('')
  return t.replace(/[\s\d\p{P}\p{S}_]+/gu, '')
}

export function checkOpinion(raw: string): OpinionCheck {
  const text = raw.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  if (!text) return { ok: false, reason: 'empty' }
  if ([...text].length > OPINION_MAX) return { ok: false, reason: 'length' }
  const digitsOnly = text.replace(/[\s.\-()]/g, '')
  if (/\d{7,}/.test(digitsOnly)) return { ok: false, reason: 'contact' }
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text) || /(https?:|www\.|\.(com|net|kr|org|io|co|me|ly)\b)/i.test(text)) return { ok: false, reason: 'contact' }
  const n = normalizeForFilter(text)
  if (BAD.some((w) => n.includes(w))) return { ok: false, reason: 'profanity' }
  return { ok: true, text }
}

export const REASON_TEXT: Record<'empty' | 'length' | 'profanity' | 'contact', string> = {
  empty: '내용을 입력해 주세요',
  length: `${OPINION_MAX}자 이하로 써 주세요`,
  profanity: '욕설·비하 표현은 쓸 수 없어요',
  contact: '전화번호·이메일·주소(링크)는 쓸 수 없어요',
}
