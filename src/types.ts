export type Stage = 'proposed' | 'committee' | 'judiciary' | 'plenary' | 'voted' | 'closed'
export type Vote = 'Y' | 'N' | 'A' | 'X'

export interface Meta {
  updated: string
  sample?: boolean
  age?: number
  source: string
  total?: number
  pending?: number
}

export interface MemberCommittee {
  id: string
  name: string
  role: '위원장' | '간사' | '위원' | string
}

export interface Member {
  id: string
  name: string
  party: string
  district: string
  elect?: string
  terms?: string
  committees: MemberCommittee[]
  photo?: string | null
}

export interface MembersFile {
  meta: Meta
  parties: Record<string, string>
  members: Member[]
}

export interface Committee {
  id: string
  name: string
  chair: string | null
  secretaries: Record<string, string[]>
  members: string[]
}

export interface CommitteesFile {
  meta: Meta
  committees: Committee[]
}

export interface BillIndexItem {
  id: string
  no: number
  title: string
  summary?: string | null
  stage: Stage
  committee: string | null
  propose_date: string
  stage_since: string
  proposer_count: number
  voted: boolean
  lead_name?: string
  result?: string | null
}

export interface BillsIndexFile {
  meta: Meta
  bills: BillIndexItem[]
}

export interface TimelineItem {
  stage: Stage
  date: string
  label: string
}

export interface BillDetail extends BillIndexItem {
  committee_id?: string | null
  lead: string[]
  co: string[]
  unmatched: string[]
  timeline: TimelineItem[]
  link?: string | null
  tally?: { yes: number; no: number; abstain: number; absent: number }
  vote_date?: string
  votes?: Record<string, Vote>
}

export interface BillBrief {
  id: string
  no: number
  title: string
  stage: Stage
}

export interface MemberBills {
  id: string
  lead: BillBrief[]
  co: BillBrief[]
  votes: (BillBrief & { vote: Vote; date: string })[]
}
