import type { BillDetail, BillsIndexFile, CommitteesFile, MemberBills, MembersFile } from '../types'

const BASE = `${import.meta.env.BASE_URL}data/`
const cache = new Map<string, Promise<unknown>>()

function getJSON<T>(path: string): Promise<T> {
  let p = cache.get(path)
  if (!p) {
    p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`)
      return r.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p as Promise<T>
}

export const loadMembers = () => getJSON<MembersFile>('members.json')
export const loadCommittees = () => getJSON<CommitteesFile>('committees.json')
export const loadBillsIndex = () => getJSON<BillsIndexFile>('bills_index.json')
export const loadBill = (id: string) => getJSON<BillDetail>(`bills/${encodeURIComponent(id)}.json`)
export const loadMemberBills = (id: string) => getJSON<MemberBills>(`member_bills/${encodeURIComponent(id)}.json`)
