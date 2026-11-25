import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BillsIndexFile, CommitteesFile, Member, MembersFile } from './types'
import { loadBill, loadBillsIndex, loadCommittees, loadMembers } from './lib/data'
import { preloadPhotos, prefetchPhotosNow } from './lib/preload'
import { partyColor as pc } from './lib/format'
import { navigate, useRoute } from './lib/router'
import { TopHud } from './components/TopHud'
import { BillList } from './components/BillList'
import { BillView } from './components/BillView'
import { Dossier } from './components/Dossier'
import { SeatMap, type StatusDef } from './components/SeatMap'
import { Landing } from './components/Landing'
import { AgoraBill, AgoraHome } from './components/Agora'

const HL_STATUSES: StatusDef[] = [
  { key: 'hl', label: '검색한 지역구', color: '#e9f6ff', vivid: true },
  { key: 'none', label: '그 외', color: '#1b3446', vivid: false },
]

export default function App() {
  const route = useRoute()
  const [mf, setMf] = useState<MembersFile | null>(null)
  const [cf, setCf] = useState<CommitteesFile | null>(null)
  const [bf, setBf] = useState<BillsIndexFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<{ ids: Set<string>; label: string } | null>(null)

  useEffect(() => {
    Promise.all([loadMembers(), loadCommittees(), loadBillsIndex()])
      .then(([m, c, b]) => { setMf(m); setCf(c); setBf(b) })
      .catch((e) => setError(String(e)))
  }, [])

  const members = useMemo(() => mf?.members ?? [], [mf])
  // 전직 의원은 좌석도에는 없고, 발의자·검색·기록 파일에서만 쓰임
  const allMembers = useMemo(() => [...members, ...(mf?.former ?? [])], [members, mf])
  const byId = useMemo(() => new Map(allMembers.map((m) => [m.id, m])), [allMembers])
  const parties = useMemo(() => mf?.parties ?? {}, [mf])
  const partyColor = useCallback((p: string) => pc(parties, p), [parties])
  const selectedMember = route.member ? byId.get(route.member) ?? null : null

  // 법안의 발의자 + 현재 심사 위원회 위원 사진을 우선 받기
  const prefetchBill = useCallback((id: string) => {
    loadBill(id).then((b) => {
      const ids = [...b.lead, ...b.co]
      const cname = b.stage === 'judiciary' || b.stage === 'plenary' ? '법제사법위원회' : b.committee
      const c = cf?.committees.find((x) => (b.committee_id && x.id === b.committee_id) || x.name === cname)
      if (c) ids.push(...([c.chair, ...c.members].filter(Boolean) as string[]))
      prefetchPhotosNow(ids.map((i) => byId.get(i)?.photo))
    }).catch(() => {})
  }, [byId, cf])

  // C. 대시보드에 들어오면 전체 사진을 빠르게(6장씩) — 첫 화면에서 프로필 보기를 누르기 전에 최대한 확보
  useEffect(() => {
    if (route.view === 'explore' && members.length) preloadPhotos(members.map((m) => m.photo), 6)
  }, [route.view, members])
  // 법안을 열면 그 법안 사진이 최우선
  useEffect(() => { if (route.bill && cf) prefetchBill(route.bill) }, [route.bill, cf, prefetchBill])

  const openMember = useCallback((m: Member) => navigate({ member: m.id }), [])
  const closeMember = useCallback(() => navigate({ member: null }), [])
  const scrollTop = () => {
    document.querySelector('.main-stage')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }
  const openBill = useCallback((id: string) => {
    navigate({ bill: id, member: null })
    document.querySelector('.main-stage')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [])
  const switchTab = useCallback((tab: 'nomos' | 'agora') => { navigate({ tab, member: null }); scrollTop() }, [])
  const billIndex = useMemo(() => new Map((bf?.bills ?? []).map((b) => [b.id, b])), [bf])

  if (error) {
    return (
      <div className="app boot-error">
        <p>데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        <code>{error}</code>
      </div>
    )
  }

  const meta = bf?.meta ?? null
  return (
    <div className={`app${selectedMember ? ' dossier-open' : ''}`}>
      <TopHud
        meta={meta}
        total={meta?.total ?? bf?.bills.length ?? 0}
        pending={meta?.pending ?? 0}
        bills={bf?.bills ?? []}
        members={allMembers}
        partyColor={partyColor}
        onOpenBill={openBill}
        onOpenMember={openMember}
        onDistrict={(ids, label) => { setHighlight({ ids: new Set(ids), label }); navigate({ view: 'explore', bill: null, member: null }) }}
        onHome={() => { setHighlight(null); navigate({ view: 'landing', bill: null, member: null }) }}
        tab={route.view === 'explore' ? route.tab : null}
        onTab={switchTab}
        onReset={() => { setHighlight(null); navigate({ view: 'explore', tab: 'nomos', bill: null, member: null }); scrollTop() }}
      />
      {meta?.sample && (
        <div className="sample-banner" role="note">
          샘플 데이터입니다 — 화면 속 의원·정당·표결은 모두 가상이며 실제 국회 기록이 아닙니다.
        </div>
      )}

      {route.view === 'landing' ? (
        <main className="landing-scroll">
          <Landing
            meta={meta}
            bills={bf?.bills ?? []}
            members={members}
            partyColor={partyColor}
            onExplore={() => navigate({ view: 'explore', tab: 'nomos', bill: null })}
            onOpenBill={(id) => { navigate({ tab: 'nomos', bill: id, member: null }); scrollTop() }}
            onOpenAgora={(id) => { navigate(id ? { tab: 'agora', bill: id, member: null } : { tab: 'agora', bill: null, member: null }); scrollTop() }}
          />
          <SiteFooter />
        </main>
      ) : (
      <div className="workspace">
        <BillList bills={bf?.bills ?? []} selected={route.bill} onOpen={openBill} onIntent={prefetchBill} />

        <main className="main-stage">
          {!mf || !cf || !bf ? (
            <div className="hud-panel empty-state">불러오는 중…</div>
          ) : route.tab === 'agora' ? (
            route.bill
              ? <AgoraBill billId={route.bill} bill={billIndex.get(route.bill)} onNomos={() => switchTab('nomos')} />
              : <AgoraHome bills={bf.bills} onOpen={openBill} />
          ) : route.bill ? (
            <BillView
              billId={route.bill}
              members={members}
              byId={byId}
              parties={parties}
              partyColor={partyColor}
              committees={cf.committees}
              onSelect={openMember}
              selectedId={route.member}
              onAgora={() => switchTab('agora')}
            />
          ) : (
            <section className="overview">
              <div className="hero-title">
                <p>NOMOS · AGORA</p>
                <h1>법안에 올린 이름은 역사에 남습니다.</h1>
                <span>공개된 국회 공식 기록을 그대로 보여줍니다. 왼쪽에서 법안을 고르거나, 좌석을 눌러 의원 기록 파일을 열어 보세요.</span>
              </div>
              <div className="hud-panel stage-panel">
                <div className="stage-panel-head">
                  <span className="card-overline">
                    {meta?.age ?? 22}대 국회 본회의장 · {members.length}석
                    {highlight && ` · '${highlight.label}' 지역구 ${highlight.ids.size}명`}
                  </span>
                  {highlight && <button className="ghost-btn" onClick={() => setHighlight(null)}>하이라이트 해제</button>}
                </div>
                <SeatMap
                  key={highlight ? `hl-${highlight.label}` : 'all'}
                  members={members}
                  parties={parties}
                  partyColor={partyColor}
                  committees={cf.committees}
                  statusOf={highlight ? (m) => (highlight.ids.has(m.id) ? 'hl' : 'none') : undefined}
                  statuses={highlight ? HL_STATUSES : undefined}
                  onSelect={openMember}
                  selectedId={route.member}
                />
              </div>
            </section>
          )}
          <SiteFooter />
        </main>
      </div>
      )}

      <Dossier member={selectedMember} partyColor={partyColor} onClose={closeMember} onOpenBill={openBill} />
    </div>
  )
}

const CONTACT = 'nomosagora.kr@gmail.com'
function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>출처: 열린국회정보(open.assembly.go.kr) · 본 사이트는 평가 없이 공개된 국회 공식 기록을 그대로 보여줍니다.</p>
      <p>신고·건의 <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </footer>
  )
}
