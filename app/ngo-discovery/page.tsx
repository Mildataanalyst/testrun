'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Header from '@/components/Header';
import { safeExternalUrl } from '@/lib/urlSafety';

type AnyRow = Record<string, any>;
type SafeResponse = { ok: boolean; status: number; data: any; error: string | null };
type Tab = 'general' | 'rapid' | 'bulk';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
const BACKEND_CONFIG_ERROR = 'Backend URL is not configured. Add NEXT_PUBLIC_BACKEND_URL in Vercel Settings → Environment Variables, then redeploy.';
const POLL_MS = 2500;
const RAPID_MAX = 20;
const BULK_MAX = 10000;
const MAX_DISCOVERY_BUDGET = 5500;
const states = ['Karnataka', 'Tamil Nadu', 'Telangana', 'Andhra Pradesh', 'Maharashtra'];

const runModes = [
  { key: 'test', label: 'Test Run', budget: 200, note: 'Small run to check whether the search logic is clean.' },
  { key: 'standard', label: 'Standard Run', budget: 1500, note: 'Serious pass without using the full balance.' },
  { key: 'full', label: 'Full Karnataka Run', budget: 4000, note: 'Deep Karnataka discovery using pathway-pattern logic.' },
  { key: 'extended', label: 'Extended Run', budget: 5500, note: 'Maximum Karnataka discovery. Pathway-pattern and niche routes get priority.' },
  { key: 'custom', label: 'Custom', budget: 200, note: 'Set your own query budget.' },
];

const pathwayOptions = [
  { key: 'residential_life_system', label: 'Residential / life-system', note: 'Residential schools, hostels, tribal/rural schools, vulnerable-cohort homes. Generic CCIs need a transformation signal.' },
  { key: 'full_day_alternative', label: 'Whole-child / alternative education', note: 'Long-horizon schools, dropout-to-mainstream routes, first-generation learners, college/career pathways.' },
  { key: 'child_protection_rehab', label: 'Child protection / rehabilitation', note: 'Lower weight unless distinctive: rescue/rehab plus education, recovery, reintegration or outcomes.' },
  { key: 'disability_special_needs', label: 'Disability / special needs', note: 'Lower weight unless distinctive: life-skills, therapy, arts/sports/STEM, vocational transition or strong outcomes.' },
  { key: 'sports_arts_stem_vocational', label: 'Sports / arts / STEM / niche pathways', note: 'Higher weight: Bridges/KSV/Agastya-like serious cohorts in sports, drama, music, arts, science, robotics.' },
  { key: 'exceptional_community_pathway', label: 'Exceptional community pathway', note: 'Off by default. Only rare deep community pathways, not generic tuition.' },
];
const defaultPathways = pathwayOptions.slice(0, 5).map(p => p.key);

function field(row: AnyRow, ...keys: string[]) { for (const k of keys) if (row?.[k] !== undefined && row?.[k] !== null && row?.[k] !== '') return row[k]; return ''; }
const rowName = (r: AnyRow) => field(r, 'Organisation', 'NGO Name', 'ngo_name', 'name', 'input_name');
const rowSource = (r: AnyRow) => field(r, 'Website / Source', 'Source URL', 'Article URL', 'Website', 'website', 'url');
const rowLocation = (r: AnyRow) => field(r, 'Location', 'Traced Place', 'District', 'State', 'location', 'district', 'state');
const rowPathway = (r: AnyRow) => field(r, 'Pathway', 'Story Category', 'Story Type', 'pathway');
const rowWhy = (r: AnyRow) => field(r, 'Why It Belongs', 'Why NGO Is Interesting', 'Story Summary', 'Notes', 'note');
const rowConfidence = (r: AnyRow) => field(r, 'Confidence', 'AI Confidence', 'confidence', 'conf');
const rowWebsiteMatch = (r: AnyRow) => field(r, 'Official Website Match', 'Website Match', 'Match', 'match_status');
const rowStatus = (r: AnyRow) => field(r, 'Output Tier', 'Status', 'Website Status', 'Repository Status', 'status');
const rowNote = (r: AnyRow) => field(r, 'Note', 'Notes', 'note', 'reason');
const rowWebsite = (r: AnyRow) => field(r, 'Website', 'website', 'url');

async function safeJSON(url: string, opts?: RequestInit): Promise<SafeResponse> {
  if (!BACKEND) return { ok:false, status:0, data:null, error:BACKEND_CONFIG_ERROR };
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); }
    catch { return { ok:false, status:res.status, data:null, error:'Server did not return JSON' + (text ? ' — ' + text.slice(0,120) : '') }; }
    return { ok:res.ok, status:res.status, data, error:res.ok ? null : (data?.error || 'Server error ' + res.status) };
  } catch (err:any) { return { ok:false, status:0, data:null, error:'Could not reach the server — ' + (err?.message || 'network error') }; }
}
function ExternalLink({ value, children }: { value: unknown; children: ReactNode }) { const url = safeExternalUrl(value); if (!url) return <>—</>; return <a href={url} target="_blank" rel="noopener noreferrer">{children}</a>; }
function StatBox({label,value}:{label:string;value:any}){return <div className="statbox"><strong>{value ?? '—'}</strong><span>{label}</span></div>}
function DownloadButton({ href, ready, children }: { href: string; ready: boolean; children: ReactNode }) {return <a className={ready?'dark-download ready':'dark-download off'} href={ready?href:'#'} onClick={e=>{if(!ready)e.preventDefault();}}>{children}</a>}
function parseNames(text: string) { return text.split(/\n+/).map(s => s.trim()).filter(Boolean); }
function csvFromNames(names: string[], state: string) { return 'name,state\n' + names.map(n => `"${n.replace(/"/g, '""')}","${state.replace(/"/g, '""')}"`).join('\n') + '\n'; }
function downloadText(name:string,text:string){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/csv'})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function discoveryDownload(runId: string, kind: string) { return BACKEND ? `${BACKEND}/discovery/export/${encodeURIComponent(runId)}/${kind}` : '#'; }
function repositoryDownload(runId: string, kind: string) { return BACKEND ? `${BACKEND}/repository/export/${encodeURIComponent(runId)}/${kind}` : '#'; }
function recheckDownload(runId: string, kind: string) { return BACKEND ? `${BACKEND}/repository/recheck/export/${encodeURIComponent(runId)}/${kind}` : '#'; }
function archiveDownload(row: AnyRow, kind: string) { const id=String(row?.run_id||''); return row?.module === 'no_website_recheck' ? recheckDownload(id, kind) : repositoryDownload(id, kind); }
function statusText(data: any) { return String(data?.run_status || data?.process_state || data?.stage || '').toLowerCase(); }
function isFailureStatus(data: any) { return ['error','failed','cancelled','canceled'].includes(statusText(data)); }
function discoveryResultsReady(data: any) { const stage=String(data?.stage||'').toLowerCase(); const downloads=data?.downloads||{}; return stage==='results_ready'||!!downloads.stories||!!downloads.story_csv; }
function repositoryResultsReady(data: any) { const stage = String(data?.stage || '').toLowerCase(); const rows = Array.isArray(data?.rows) ? data.rows : []; const downloads = data?.downloads || {}; return stage === 'results_ready' || stage === 'partial_results_ready' || rows.length > 0 || !!downloads.repository || !!downloads.audit; }
function confidenceClass(value: unknown){ const s=String(value||'').toLowerCase(); if(s.includes('high'))return 'tag good'; if(s.includes('low'))return 'tag bad'; return 'tag'; }
function lowConfidenceMessage(row: AnyRow){ const c=String(rowConfidence(row)||'').toLowerCase(); const m=String(rowWebsiteMatch(row)||'').toLowerCase(); if(c.includes('low')||m.includes('uncertain')||m.includes('no')) return 'Best match found, but it may be inaccurate. Verify manually before using.'; return 'Match looks usable, but still review before outreach.'; }
async function countCsvRows(file: File) { const text = await file.text(); const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean); if (!lines.length) return 0; const first = lines[0].toLowerCase(); return first.includes('name') ? Math.max(0, lines.length - 1) : lines.length; }

function HowItWorks({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return <div className="form-card" style={{marginTop: 0}}>
    <label>Simple explanation</label>
    <h3 style={{margin:'0 0 8px', fontSize:22, letterSpacing:'-.04em'}}>Search wide. Filter hard. Show simple.</h3>
    <p className="muted-empty">The system searches for Karnataka child-pathway organisations, not benchmark names. It separates results into Fresh strong leads, Manual-check promising, and Benchmark reference, so a strict run does not turn into a blank sheet.</p>
    <button className="ghost-btn" onClick={onToggle}>{open ? 'Hide details' : 'How does this work?'}</button>
    {open && <div className="advanced-panel" style={{margin:'14px 0 0'}}>
      <p className="muted-empty">Benchmark organisations are calibration anchors only. The backend hard-blocks literal benchmark-name queries, keeps naturally found benchmarks as reference, and uses a manual-check safety net so promising candidates are surfaced instead of disappearing into rejected when the evidence is incomplete. Wrong-state, donation-page, generic CCI/special-school and weak tuition-style rows still stay out of the main strong-lead tier.</p>
    </div>}
  </div>
}

function DiscoveryRow({ row }: { row: AnyRow }) {
  return <tr>
    <td>{rowName(row) || 'Needs review'}</td>
    <td><ExternalLink value={rowSource(row)}>open</ExternalLink></td>
    <td>{rowLocation(row) || '—'}</td>
    <td><span className="tag">{rowPathway(row) || '—'}</span></td>
    <td>{rowWhy(row) || 'Potential child pathway institution. Verify manually.'}</td>
    <td><span className="tag">{rowStatus(row) || 'include'}</span></td>
    <td><span className={confidenceClass(rowConfidence(row))}>{rowConfidence(row) || 'low'}</span></td>
  </tr>;
}

function VerifyRow({ row }: { row: AnyRow }) {
  return <tr>
    <td>{rowName(row) || '—'}</td>
    <td><ExternalLink value={rowWebsite(row)}>open</ExternalLink></td>
    <td>{rowLocation(row) || '—'}</td>
    <td>{rowConfidence(row) || '—'}</td>
    <td>{rowWebsiteMatch(row) || rowStatus(row) || '—'}</td>
    <td>{lowConfidenceMessage(row)} {rowNote(row)}</td>
  </tr>;
}

export default function NgoDiscoveryPage(){
  const [tab,setTab]=useState<Tab>('general');

  const [state,setState]=useState('Karnataka');
  const [runMode,setRunMode]=useState('test');
  const [budget,setBudget]=useState(200);
  const [pathways,setPathways]=useState<string[]>(defaultPathways);
  const [howOpen,setHowOpen]=useState(false);
  const [discRunId,setDiscRunId]=useState('');
  const [discPolling,setDiscPolling]=useState(false);
  const [discStarting,setDiscStarting]=useState(false);
  const [discStatus,setDiscStatus]=useState<any>(null);
  const [discResults,setDiscResults]=useState<any>(null);
  const [discArchive,setDiscArchive]=useState<AnyRow[]>([]);
  const [discArchiveOpen,setDiscArchiveOpen]=useState(false);
  const [repoArchive,setRepoArchive]=useState<AnyRow[]>([]);
  const [repoArchiveOpen,setRepoArchiveOpen]=useState(false);
  const [discError,setDiscError]=useState('');
  const discTimer=useRef<any>(null);

  const [verifyState,setVerifyState]=useState('Karnataka');
  const [namesText,setNamesText]=useState('');
  const [bulkCSV,setBulkCSV]=useState<File|null>(null);
  const bulkRef=useRef<HTMLInputElement|null>(null);
  const [repoRunId,setRepoRunId]=useState('');
  const [repoPolling,setRepoPolling]=useState(false);
  const [repoStarting,setRepoStarting]=useState(false);
  const [repoStatus,setRepoStatus]=useState<any>(null);
  const [repoResults,setRepoResults]=useState<any>(null);
  const [repoError,setRepoError]=useState('');
  const repoTimer=useRef<any>(null);

  function onModeChange(modeKey:string){ setRunMode(modeKey); const m=runModes.find(x=>x.key===modeKey); if(m && modeKey!=='custom') setBudget(m.budget); }
  function togglePathway(key:string){ setPathways(prev=>prev.includes(key)?prev.filter(x=>x!==key):[...prev,key]); }
  async function loadDiscoveryArchive(){ if(!BACKEND)return; const r=await safeJSON(`${BACKEND}/discovery/archive?limit=120`); if(r.ok&&r.data)setDiscArchive(r.data.rows||[]); }
  async function loadRepositoryArchive(){ if(!BACKEND)return; const r=await safeJSON(`${BACKEND}/repository/archive?limit=120`); if(r.ok&&r.data)setRepoArchive(r.data.rows||r.data.runs||[]); }
  useEffect(()=>{loadDiscoveryArchive(); loadRepositoryArchive();},[]);

  async function startDiscovery(){
    setDiscError(''); setDiscResults(null); setDiscStatus(null);
    if(!BACKEND){setDiscError(BACKEND_CONFIG_ERROR); return;}
    if(!state){setDiscError('Pick a state first.'); return;}
    if(!pathways.length){setDiscError('Select at least one pathway.'); return;}
    const safeBudget=Math.max(1,Math.min(MAX_DISCOVERY_BUDGET,Number(budget||200)));
    if(safeBudget>4000 && !window.confirm('This can use almost your full Serper balance. Continue?')) return;
    setDiscStarting(true);
    const url=`${BACKEND}/discovery/start?state=${encodeURIComponent(state)}&budget=${safeBudget}&run_mode=${encodeURIComponent(runMode)}&pathways=${encodeURIComponent(pathways.join(','))}`;
    const r=await safeJSON(url,{method:'POST'});
    setDiscStarting(false);
    if(!r.ok||!r.data){setDiscError(r.error||'Could not start General Discovery.'); return;}
    setDiscRunId(r.data.run_id); setDiscPolling(true); loadDiscoveryArchive();
  }
  async function pauseDiscovery(){ if(!BACKEND||!discRunId)return; const r=await safeJSON(`${BACKEND}/discovery/pause/${encodeURIComponent(discRunId)}`,{method:'POST'}); if(!r.ok)setDiscError(r.error||'Could not pause run.'); else setDiscPolling(false); }
  async function resumeDiscovery(id=discRunId){ if(!BACKEND||!id)return; const r=await safeJSON(`${BACKEND}/discovery/resume/${encodeURIComponent(id)}`,{method:'POST'}); if(!r.ok){setDiscError(r.error||'Could not resume run.'); return;} setDiscRunId(id); setDiscPolling(true); }
  async function cancelDiscovery(){ if(!BACKEND||!discRunId)return; await safeJSON(`${BACKEND}/discovery/cancel/${encodeURIComponent(discRunId)}`,{method:'POST'}); setDiscPolling(false); loadDiscoveryArchive(); }

  useEffect(()=>{ if(!discPolling||!discRunId)return; let stopped=false; async function tick(){ if(stopped)return; const s=await safeJSON(`${BACKEND}/discovery/status/${encodeURIComponent(discRunId)}`); if(s.ok&&s.data)setDiscStatus(s.data); else if(s.error)setDiscError(s.error); const rr=await safeJSON(`${BACKEND}/discovery/results/${encodeURIComponent(discRunId)}?limit=120`); if(rr.ok&&rr.data){setDiscResults(rr.data); if(discoveryResultsReady(rr.data)){setDiscPolling(false); loadDiscoveryArchive(); return;}} if(isFailureStatus(s.data)||String(s.data?.stage||'').toLowerCase().includes('paused')){setDiscPolling(false); loadDiscoveryArchive(); return;} discTimer.current=setTimeout(tick,POLL_MS);} tick(); return()=>{stopped=true; if(discTimer.current)clearTimeout(discTimer.current);};},[discPolling,discRunId]);

  const names=parseNames(namesText);
  async function startRepository(mode:'rapid'|'bulk'){
    setRepoError(''); setRepoResults(null); setRepoStatus(null);
    if(!BACKEND){setRepoError(BACKEND_CONFIG_ERROR);return;}
    const fd=new FormData();
    if(mode==='rapid'){
      if(!verifyState){setRepoError('State is required.'); return;}
      if(names.length<1){setRepoError('Paste at least one NGO name.');return;}
      if(names.length>RAPID_MAX){setRepoError(`Rapid Verify allows up to ${RAPID_MAX} names.`);return;}
      fd.append('file', new File([csvFromNames(names, verifyState)], 'rapid_verify.csv', {type:'text/csv'}));
    } else {
      if(!bulkCSV){setRepoError('Upload a CSV first.');return;}
      const count=await countCsvRows(bulkCSV); if(count>BULK_MAX){setRepoError(`Bulk Verify allows up to ${BULK_MAX} rows. This file appears to have ${count}.`);return;}
      fd.append('file', bulkCSV);
    }
    setRepoStarting(true);
    const r=await safeJSON(`${BACKEND}/repository/start?mode=${mode}`,{method:'POST',body:fd});
    setRepoStarting(false);
    if(!r.ok||!r.data){setRepoError(r.error||'Could not start verification.');return;}
    setRepoRunId(r.data.run_id); setRepoPolling(true); loadRepositoryArchive();
  }
  async function stopRepository(){ if(!BACKEND||!repoRunId)return; await safeJSON(`${BACKEND}/repository/cancel/${encodeURIComponent(repoRunId)}`,{method:'POST'}); setRepoPolling(false); loadRepositoryArchive(); }
  useEffect(()=>{ if(!repoPolling||!repoRunId)return; let stopped=false; async function tick(){ if(stopped)return; const s=await safeJSON(`${BACKEND}/repository/status/${encodeURIComponent(repoRunId)}`); if(s.ok&&s.data)setRepoStatus(s.data); else if(s.error)setRepoError(s.error); const rr=await safeJSON(`${BACKEND}/repository/results/${encodeURIComponent(repoRunId)}?limit=80`); if(rr.ok&&rr.data){setRepoResults(rr.data); if(repositoryResultsReady(rr.data)){setRepoPolling(false); loadRepositoryArchive(); return;}} if(isFailureStatus(s.data)){setRepoPolling(false); return;} repoTimer.current=setTimeout(tick,POLL_MS);} tick(); return()=>{stopped=true; if(repoTimer.current)clearTimeout(repoTimer.current);};},[repoPolling,repoRunId]);

  const discRows:AnyRow[]=discResults?.stories||discResults?.rows||[];
  const discDownloads=discResults?.downloads||discStatus?.downloads||{};
  const repoRows:AnyRow[]=repoResults?.rows||[];
  const repoDownloads=repoResults?.downloads||repoStatus?.downloads||{};
  const currentDisc=discStatus?.current_search||discStatus?.current_url||discStatus?.current_item||'Waiting to start';
  const currentRepo=repoStatus?.current_search||repoStatus?.current_url||repoStatus?.current_item||'Waiting to start';

  return <><Header active="repository"/><main className="dfp-wrap page-stack">
    <section className="module-hero"><div className="red-kicker">NGO Discovery Module</div><h1>Find Child <span>Pathways</span></h1><p>Find and verify Karnataka child trajectory-shifting institutions — whole-child schools, alternative education, rural/tribal residential pathways, vulnerable-cohort life systems, and serious sports/arts/STEM programs.</p><div className="hero-dots"/></section>
    <section className="discover-card">
      <div className="mode-tabs"><button className={tab==='general'?'active':''} onClick={()=>setTab('general')}>General Discovery <small>find new</small></button><button className={tab==='rapid'?'active':''} onClick={()=>setTab('rapid')}>Rapid Verify <small>name + state</small></button><button className={tab==='bulk'?'active':''} onClick={()=>setTab('bulk')}>Bulk Verify <small>csv</small></button></div>
      {tab==='general'&&<>
        <div className="story-top-controls"><label><span>State</span><select value={state} onChange={e=>setState(e.target.value)}>{states.map(s=><option key={s}>{s}</option>)}</select></label><label><span>Run mode</span><select value={runMode} onChange={e=>onModeChange(e.target.value)}>{runModes.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}</select></label><label><span>Query budget</span><input type="number" min={1} max={MAX_DISCOVERY_BUDGET} value={budget} onChange={e=>{setRunMode('custom');setBudget(Math.max(1,Math.min(MAX_DISCOVERY_BUDGET,Number(e.target.value||1))))}}/></label><button className="primary-red" disabled={discStarting||discPolling} onClick={startDiscovery}>{discStarting?'Starting…':'Start General Discovery'}</button>{discRunId&&discPolling&&<button className="ghost-btn" onClick={pauseDiscovery}>Pause safely</button>}{discRunId&&discPolling&&<button className="ghost-btn" onClick={cancelDiscovery}>Cancel</button>}</div>
        <div className="budget-strip"><b>{Number(budget||0).toLocaleString()} / {MAX_DISCOVERY_BUDGET.toLocaleString()} query cap</b><span>{runModes.find(m=>m.key===runMode)?.note || 'Manual query budget'} · No AI score. Output is tiered: Fresh strong lead, Manual-check promising, Benchmark reference.</span></div>
        <div className="category-grid-dark">{pathwayOptions.map(p=><button key={p.key} className={pathways.includes(p.key)?'active':''} onClick={()=>togglePathway(p.key)}><i>{pathways.includes(p.key)?'✓':'+'}</i><span><b>{p.label}</b><small>{p.note}</small></span></button>)}</div>
        <HowItWorks open={howOpen} onToggle={()=>setHowOpen(v=>!v)} />
        {pathways.includes('exceptional_community_pathway')&&<div className="error-box">Exceptional community pathway can be noisy. Use it only to catch rare high-contact models, not generic tuition or volunteer teaching.</div>}
        {discError&&<div className="error-box">{discError}</div>}
      </>}
      {tab==='rapid'&&<>
        <div className="form-card"><label>Input — paste known NGO names</label><textarea value={namesText} onChange={e=>setNamesText(e.target.value)} placeholder={'Shanti Bhavan\nMahesh Foundation\nHunger Heroes'} /><div className="counter">{names.length} / {RAPID_MAX}</div><div className="story-top-controls" style={{padding:'14px 0 0', gridTemplateColumns:'240px auto'}}><label><span>State — mandatory</span><select value={verifyState} onChange={e=>setVerifyState(e.target.value)}>{states.map(s=><option key={s}>{s}</option>)}</select></label><button className="primary-red" disabled={repoStarting||repoPolling} onClick={()=>startRepository('rapid')}>{repoStarting?'Starting…':'Run Rapid Verify'}</button></div><p className="muted-empty">Rapid Verify uses <b>name,state</b>. If the engine is not sure, it will say this is only the best match found and may be inaccurate.</p></div>
        {repoError&&<div className="error-box">{repoError}</div>}
      </>}
      {tab==='bulk'&&<>
        <div className="form-card"><label>Input — upload known-name CSV</label><div className="upload-box" onClick={()=>bulkRef.current?.click()}><strong>Upload NGO CSV</strong><span>Required columns: name, state</span><small>Optional: website, source, notes, darpan_website</small></div><input ref={bulkRef} type="file" accept=".csv" hidden onChange={e=>setBulkCSV(e.target.files?.[0]||null)}/>{bulkCSV&&<small>{bulkCSV.name}</small>}<button className="sample-btn" onClick={()=>downloadText('bulk_verify_sample.csv','name,state\nShanti Bhavan,Karnataka\nMahesh Foundation,Karnataka\n')}>Download sample CSV</button><div className="action-row" style={{padding:'14px 0 0'}}><button className="primary-red" disabled={repoStarting||repoPolling} onClick={()=>startRepository('bulk')}>{repoStarting?'Starting…':'Run Bulk Verify'}</button>{repoRunId&&repoPolling&&<button className="ghost-btn" onClick={stopRepository}>Stop safely</button>}</div><p className="muted-empty">If NGO Darpan has a declared website in your CSV later, treat it as the first candidate source, but still verify before using it.</p></div>
        {repoError&&<div className="error-box">{repoError}</div>}
      </>}
    </section>

    {(discStatus||discPolling)&&tab==='general'&&<section className="status-card"><div className="status-dot"/><div><b>{discStatus?.stage||(discPolling?'Starting…':'Waiting')}</b><p>{currentDisc}</p></div><div className="status-grid"><StatBox label="State" value={state}/><StatBox label="Queries used" value={discStatus?.processed??0}/><StatBox label="Budget" value={discStatus?.total??budget}/><StatBox label="Sources" value={discStatus?.links_found??'—'}/><StatBox label="Organisations" value={discStatus?.stories_found??discRows.length}/></div></section>}
    {(repoStatus||repoPolling)&&(tab==='rapid'||tab==='bulk')&&<section className="status-card"><div className="status-dot"/><div><b>{repoStatus?.stage||(repoPolling?'Starting…':'Waiting')}</b><p>{currentRepo}</p></div><div className="status-grid"><StatBox label="Mode" value={repoStatus?.mode||tab}/><StatBox label="Processed" value={repoStatus?.processed??0}/><StatBox label="Total" value={repoStatus?.total??'—'}/><StatBox label="Ready for AI" value={repoStatus?.ready_for_ai??'—'}/><StatBox label="Errors" value={repoStatus?.errors??'—'}/></div></section>}

    {tab==='general'&&discRunId&&<div className="download-row"><DownloadButton ready={!!discDownloads.stories||!!discDownloads.story_csv} href={discoveryDownload(discRunId,'leads')}>Clean output CSV</DownloadButton><DownloadButton ready={!!discDownloads.audit} href={discoveryDownload(discRunId,'audit')}>Audit</DownloadButton><DownloadButton ready={!!discDownloads.rejected} href={discoveryDownload(discRunId,'rejected')}>Rejected</DownloadButton><DownloadButton ready={!!discDownloads.candidates} href={discoveryDownload(discRunId,'candidates')}>Reviewed candidates</DownloadButton><DownloadButton ready={!!discDownloads.raw_candidates} href={discoveryDownload(discRunId,'raw_candidates')}>Raw candidates</DownloadButton><DownloadButton ready={!!discDownloads.queries} href={discoveryDownload(discRunId,'queries')}>Query plan</DownloadButton><DownloadButton ready={!!discDownloads.errors} href={discoveryDownload(discRunId,'errors')}>Errors</DownloadButton><DownloadButton ready={!!discDownloads.status} href={discoveryDownload(discRunId,'status')}>Status JSON</DownloadButton></div>}
    {(tab==='rapid'||tab==='bulk')&&repoRunId&&<div className="download-row"><DownloadButton ready={!!repoDownloads.repository} href={repositoryDownload(repoRunId,'repository')}>Verified CSV</DownloadButton><DownloadButton ready={!!repoDownloads.audit} href={repositoryDownload(repoRunId,'audit')}>Audit</DownloadButton><DownloadButton ready={!!repoDownloads.rejected} href={repositoryDownload(repoRunId,'rejected')}>Rejected</DownloadButton><DownloadButton ready={!!repoDownloads.errors} href={repositoryDownload(repoRunId,'errors')}>Errors</DownloadButton></div>}

    {tab==='general'&&!!discRows.length&&<section className="table-card"><div className="table-title"><b>General Discovery output</b><span>{discRows.length} surfaced leads · no AI score</span></div><div className="scroll-table"><table><thead><tr><th>Organisation</th><th>Source</th><th>Location</th><th>Pathway</th><th>Why it belongs</th><th>Output tier</th><th>Confidence</th></tr></thead><tbody>{discRows.slice(0,120).map((r,i)=><DiscoveryRow row={r} key={i}/>)}</tbody></table></div></section>}
    {(tab==='rapid'||tab==='bulk')&&!!repoRows.length&&<section className="table-card"><div className="table-title"><b>{tab==='rapid'?'Rapid Verify':'Bulk Verify'} output</b><span>{repoRows.length} rows</span></div><div className="scroll-table"><table><thead><tr><th>Input / NGO</th><th>Website</th><th>Location</th><th>Confidence</th><th>Match</th><th>Reviewer note</th></tr></thead><tbody>{repoRows.slice(0,80).map((r,i)=><VerifyRow row={r} key={i}/>)}</tbody></table></div></section>}

    <section className="collapse-card"><button className="collapse-head" onClick={()=>{setDiscArchiveOpen(!discArchiveOpen); loadDiscoveryArchive();}}><span className="mini-icon">▣</span><span><b>Discovery history & reports</b><small>Includes new General Discovery runs and older Story Discovery audits. Nothing old is hidden.</small></span><em>{discArchive.length || 0} runs</em></button>{discArchiveOpen&&<div className="collapse-body"><div className="archive-toolbar"><button className="quiet-btn" onClick={loadDiscoveryArchive}>Refresh</button></div><div className="archive-list">{discArchive.length===0&&<div className="muted-empty">No General/Story Discovery runs found yet.</div>}{discArchive.slice(0,100).map((r,i)=>{const id=String(r.run_id||''); const dl=r.downloads||{}; const legacy=r.module==='legacy_story'; return <div className="archive-row" key={id||i}><div><b>{legacy?'Legacy Story Discovery':'General Discovery'} — {r.state||'Statewide'}</b><small>{r.updated_at||'—'} · {r.run_mode||'run'} · {r.processed||0}/{r.total||0} queries · surfaced {r.stories_found||0}</small></div><div className="archive-links">{dl.stories&&<a href={discoveryDownload(id,'leads')}>{legacy?'Output':'Clean output'}</a>}{dl.audit&&<a href={discoveryDownload(id,'audit')}>Audit</a>}{dl.rejected&&<a href={discoveryDownload(id,'rejected')}>Rejected</a>}{dl.candidates&&<a href={discoveryDownload(id,'candidates')}>Reviewed</a>}{dl.raw_candidates&&<a href={discoveryDownload(id,'raw_candidates')}>Raw</a>}{dl.queries&&<a href={discoveryDownload(id,'queries')}>Queries</a>}{dl.errors&&<a href={discoveryDownload(id,'errors')}>Errors</a>}{(r.stage==='paused'||r.run_status==='paused')&&<button onClick={()=>resumeDiscovery(id)}>Resume</button>}</div></div>})}</div></div>}</section>

    <section className="collapse-card"><button className="collapse-head" onClick={()=>{setRepoArchiveOpen(!repoArchiveOpen); loadRepositoryArchive();}}><span className="mini-icon">▣</span><span><b>Verification history & previous exports</b><small>Restores the old repository archive: shortlist, audit, rejected, dedupe, donor-lite and re-check downloads.</small></span><em>{repoArchive.length || 0} runs</em></button>{repoArchiveOpen&&<div className="collapse-body"><div className="archive-toolbar"><button className="quiet-btn" onClick={loadRepositoryArchive}>Refresh</button>{BACKEND&&<a className="dark-download ready" href={`${BACKEND}/repository/export/global/history`}>Global scan history</a>}</div><div className="archive-list">{repoArchive.length===0&&<div className="muted-empty">No previous Repository / Verify runs found yet.</div>}{repoArchive.slice(0,100).map((r,i)=>{const id=String(r.run_id||''); const dl=r.downloads||{}; const moduleName=String(r.module||''); const title=moduleName==='no_website_recheck'?'No website re-check':(r.run_type==='dedupe_recheck'?'Deduped NGO re-check':'Repository / Verify run'); return <div className="archive-row" key={id||i}><div><b>{title}</b><small>{r.updated_at||'—'} · {id} · {r.stage||r.run_status||'—'} · shortlist {r.repository_count||0} · audit {r.audit_count||0} · rejected {r.rejected_count||0}</small></div><div className="archive-links">{dl.repository&&<a href={archiveDownload(r,'repository')}>Shortlist</a>}{dl.results&&<a href={archiveDownload(r,'results')}>Results</a>}{dl.audit&&<a href={archiveDownload(r,'audit')}>Audit</a>}{dl.rejected&&<a href={archiveDownload(r,'rejected')}>Rejected</a>}{dl.duplicates&&<a href={archiveDownload(r,'duplicates')}>Dedupe audit</a>}{dl['donor-lite']&&<a href={archiveDownload(r,'donor-lite')}>Donor-lite</a>}{dl.errors&&<a href={archiveDownload(r,'errors')}>Errors</a>}{dl.history&&<a href={archiveDownload(r,'history')}>History</a>}</div></div>})}</div></div>}</section>
    {!discStatus&&!repoStatus&&!discResults&&!repoResults&&<div className="empty-dark">Start with Test Run — 200 queries. Review clean output, audit, raw candidates and query plan before scaling.</div>}
    <footer className="page-foot">For internal use only</footer>
  </main></>;
}
