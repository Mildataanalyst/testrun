'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { PM_PROFILES } from '@/lib/progressData';

type Task = { ngo_name: string; website?: string; background?: string };
type ResponseRow = {
  decision?: string;
  reason?: string;
  ngo_description?: string;
  contact_number?: string;
  referral_source?: string;
  referral_poc?: string;
  submitted?: boolean;
  submitted_at?: string;
  global_saved?: boolean;
  global_saved_at?: string;
};
type PmData = {
  name: string;
  deadline: string;
  deadline_note?: string;
  responsibility: string;
  task_type: 'shortlisting' | 'ngo_details' | string;
  tasks: Task[];
  responses: Record<string, ResponseRow>;
};
type WorkstreamData = { review_rules: string; pms: Record<string, PmData>; global_log?: any[]; ai_log?: any[] };
type AiReview = { headline?: string; quality_flags?: string[]; suggestions?: string[]; pace_comment?: string; encouragement?: string; source?: string };

const PM_NAMES = ['Milan', 'Rachit', 'Ipshita', 'Avika', 'Kamran', 'Piyush', 'Tanishq'];
const LEADERBOARD_NAMES = PM_NAMES.filter(n => n !== 'Milan' && n !== 'Tanishq');
const DEFAULT_RULES = 'Review only expression quality: length, clarity, and whether the PM captured their thought process. Do not critique the NGO, the decision, the source, the pathway, or whether they are right. Do not ask for contact, referral, POC, source, geography, cohort, operational proof, or extra NGO facts. Hinglish, fragments, spelling mistakes, no punctuation and stream of consciousness are fine. Encourage people to type more of what went through their head. No can be blank, one word, or very short.';
const DEFAULT_DEADLINE_NOTE = 'Once everyone submits, we compare Yes / Maybe / No, resolve overlaps, clean the cohorts, and move to human lead follow-ups. This needs to close by Wednesday so the lead list can be wrapped by the end of the week.';
const DEFAULT_TASKS: Task[] = [
  { ngo_name: 'Aina Trust', website: 'www.ainatrust.in/about-aina.html', background: 'Early childhood care centres, anganwadi strengthening, nutrition support and education programs for vulnerable young children.' },
  { ngo_name: 'Cerebloom Academy', website: 'https://cerebloom.org/', background: 'Rural science education and mentorship program for underserved students. Review regularity and depth.' },
  { ngo_name: 'Don Bosco Child Labour Mission', website: 'dbclm.org', background: 'Child labour rehabilitation, bridge schooling, open shelter and prevention work. Verify current scale and pathway depth.' },
];
const DEFAULT_DETAILS: Task[] = [
  { ngo_name: 'Referral NGO 1', background: 'Capture NGO details, POC contact number, and referral source.' },
  { ngo_name: 'Referral NGO 2', background: 'Capture NGO details, POC contact number, and referral source.' },
  { ngo_name: 'Referral NGO 3', background: 'Capture NGO details, POC contact number, and referral source.' },
];
const PM_ICONS: Record<string, string> = { Milan:'◆', Rachit:'◌', Ipshita:'✦', Avika:'★', Kamran:'▣', Piyush:'✚', Tanishq:'◇' };
const PM_LINES: Record<string, string[]> = {
  Milan: ['Judgement captured. Gurgaon may continue pretending this was planned.', 'Vending-machine-level efficiency, but with slightly more nutritional value.', 'This is usable. The spreadsheet has been temporarily humbled.'],
  Rachit: ['Networker-in-chief has produced actual signal, not just another hello.', 'Banana chips still pending, but the review moved.', 'Useful. More signal than a WhatsApp forward, which is a low bar but still cleared.'],
  Ipshita: ['Green tea may proceed after this display of adult supervision.', 'This reason has calories, unlike most status updates.', 'Veteran move: rough, useful, and not trying to win a grammar prize.'],
  Avika: ['Orange Lay’s-level crunch: unnecessary softness removed.', 'Fast and legible. Food-sharing policy remains unchanged.', 'Good. This shortlist has texture now, unlike most meeting notes.'],
  Kamran: ['Drama denied entry at the door.', 'Ministry of Travel stayed seated; the judgement still arrived.', 'Brutally practical. A rare victory over nonsense.'],
  Piyush: ['Karma points credited, pending audit.', 'Angel Faridabad has filed judgement.', 'Desk helicopters cleared this review for take-off.'],
  Tanishq: ['Details saved. Future follow-up will suffer less.', 'Data hygiene has entered the room and asked everyone to behave.', 'No archaeological excavation required later. Historic.'],
};
const PM_HALF_MILESTONE: Record<string, string> = {
  Avika: 'Avika, halfway done. Orange Lays checkpoint unlocked.',
  Ipshita: 'Ipshu, you deserve green tea. Halfway crossed.',
  Rachit: 'Rachit, banana chips have been spiritually approved.',
  Kamran: 'Kamran, may you avoid more drama. Halfway done.',
  Piyush: 'More karma points credited. Halfway done.',
  Tanishq: 'Data hygiene is approaching civilization. Halfway done.',
  Milan: 'Halfway done. The spreadsheet has not won yet.',
};
const ROASTS = [
  'Future reviewers may only suffer moderately.',
  'A spreadsheet cell just learned accountability.',
  'This is how chaos loses: one judgement at a time.',
  'The deadline remains cruel, but now it has data.',
  'No corporate English was harmed. Excellent restraint.',
  'Messy thought captured. That is literally the job.',
  'This was shorter than a meeting invite and more useful.',
  'Consolidation team receives one less mystery parcel.',
  'A clean submit. Suspicious, but welcome.',
  'The review has a pulse. We take those.',
];

function backendBase() { return (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, ''); }
function wordCount(value?: string) { return String(value || '').trim().split(/\s+/).filter(Boolean).length; }
function safeUrl(url?: string) { const raw = String(url || '').trim(); if (!raw) return ''; return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`; }
function defaultDeadline(offsetHours = 18) { const d = new Date(Date.now() + offsetHours * 3600000); const p = (x: number) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function makeDefaultData(): WorkstreamData { const pms: Record<string, PmData> = {}; PM_NAMES.forEach((name, i) => { const details = name === 'Tanishq'; pms[name] = { name, deadline: defaultDeadline(18 + i), deadline_note: DEFAULT_DEADLINE_NOTE, responsibility: details ? 'Capture NGO details, contact number and referral source clearly.' : 'Review assigned NGOs and capture judgement clearly. Stream of consciousness is fine.', task_type: details ? 'ngo_details' : 'shortlisting', tasks: details ? DEFAULT_DETAILS : DEFAULT_TASKS, responses: {} }; }); return { review_rules: DEFAULT_RULES, pms, global_log: [], ai_log: [] }; }
function submittedCount(pm?: PmData) { return Object.values(pm?.responses || {}).filter(r => r?.submitted).length; }
function countdown(deadline: string) { const diff = new Date(deadline).getTime() - Date.now(); if (!deadline || Number.isNaN(diff) || diff <= 0) return { full:'0h 00m 00s', hours:'0h', rest:'00m 00s' }; const sec = Math.floor(diff / 1000); const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60; return { full:`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`, hours:`${h}h`, rest:`${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s` }; }
function niceTime(ts?: string) { if (!ts) return ''; const d = new Date(ts.replace(' ', 'T')); return Number.isNaN(d.getTime()) ? ts : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function exportHref() { const base = backendBase(); return base ? `${base}/workstream/export.csv` : '#'; }
function parseCsvLine(line: string) { const cells: string[] = []; let cur = ''; let quoted = false; for (let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;continue;} if(ch==='"'){quoted=!quoted;continue;} if(ch===','&&!quoted){cells.push(cur.trim());cur='';continue;} cur+=ch;} cells.push(cur.trim()); return cells; }
function parseTasks(value: string): Task[] { const lines = value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); if(!lines.length) return []; const first = lines[0].toLowerCase(); const header = /ngo|name|website|source|description|background|details/.test(first); const headers = header ? (first.includes('|') ? lines[0].split('|').map(x=>x.trim().toLowerCase()) : parseCsvLine(lines[0]).map(x=>x.toLowerCase())) : []; const body = header ? lines.slice(1) : lines; return body.map(line => { const cells = line.includes('|') ? line.split('|').map(x=>x.trim()) : parseCsvLine(line); let name = cells[0] || ''; let website = cells[1] || ''; let background = cells.slice(2).join(' ').trim(); if(headers.length){ const get=(patterns:RegExp[], fallback:number)=>{ const idx=headers.findIndex(h=>patterns.some(p=>p.test(h))); return (idx>=0?cells[idx]:cells[fallback]) || ''; }; name=get([/ngo.*name/,/^name$/],0); website=get([/website/,/source/,/url/,/link/],1); background=get([/description/,/background/,/context/,/note/,/details/],2) || cells.slice(2).join(' '); } return { ngo_name: name || 'Untitled NGO', website, background }; }).filter(t=>t.ngo_name && t.ngo_name !== 'Untitled NGO'); }
function taskToText(tasks: Task[]) { return (tasks || []).map(t => `${t.ngo_name || ''} | ${t.website || ''} | ${t.background || ''}`).join('\n'); }
function profileFor(name: string) { return Array.from(PM_PROFILES as unknown as any[]).find(pm => pm.name === name) || { name, tagline: '', role: 'PM', about: 'Details to be added.', img: '' }; }
function pct(done: number, total: number) { return total ? Math.round((done / total) * 100) : 0; }
function submittedRows(pm?: PmData) { return Object.entries(pm?.responses || {}).filter(([, r]) => (r as ResponseRow)?.submitted) as Array<[string, ResponseRow]>; }
function latestSubmitMs(pm?: PmData) { const times = submittedRows(pm).map(([,r]) => new Date(String(r.submitted_at)).getTime()).filter(Number.isFinite); return times.length ? Math.max(...times) : 0; }
function formatDuration(seconds?: number | null) { if (!seconds) return '—'; return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds/60)}m ${String(seconds%60).padStart(2,'0')}s`; }
function avgPace(pm?: PmData) { const times = submittedRows(pm).map(([,r]) => new Date(String(r.submitted_at)).getTime()).filter(Number.isFinite).sort((a,b)=>a-b); if(times.length < 2) return '—'; const diffs = times.slice(1).map((t,i) => Math.max(1, Math.round((t - times[i]) / 1000))); const avg = Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length); return formatDuration(avg); }
function counts(pm?: PmData) { const rows = submittedRows(pm).map(([,r]) => r); return { yes: rows.filter(r=>r.decision==='Yes').length, maybe: rows.filter(r=>r.decision==='Maybe').length, no: rows.filter(r=>r.decision==='No').length }; }
function explanationQuality(decision: string, text: string, isDetails: boolean) { const words = wordCount(text); if (isDetails) { if (words >= 35) return 'Sharp'; if (words >= 18) return 'Clear'; if (words >= 7) return 'Usable'; return 'Thin'; } if (decision === 'No') return words <= 1 ? 'Clean' : words >= 12 ? 'Clear' : 'Usable'; if (decision === 'Maybe') { if (words >= 25) return 'Sharp'; if (words >= 8) return 'Clear'; return 'Thin'; } if (words >= 35) return 'Sharp'; if (words >= 12) return 'Clear'; if (words >= 1) return 'Usable'; return 'Thin'; }
function paceBadge(delta: number) { if (!delta) return 'First'; if (delta < 35) return 'Fast'; if (delta < 90) return 'Efficient'; if (delta < 180) return 'Thoughtful'; if (delta < 360) return 'Taking time'; return 'Slow burn'; }
function verdictLine(decision: string) { if (decision === 'Yes') return '🔥 Strong signal'; if (decision === 'Maybe') return '🟡 Maybe logged'; if (decision === 'No') return '🪓 Clean rejection'; return '✅ Details saved'; }
function reviewerMode(pm?: PmData) { const rows = submittedRows(pm).map(([,r]) => r); if (!rows.length) return 'Not started'; const c = counts(pm); const total = rows.length; const avgWords = Math.round(rows.reduce((s,r)=>s+wordCount(r.reason || r.ngo_description || ''),0)/Math.max(1,total)); if (avgWords >= 35) return '🧠 Essay Department'; if (c.no >= Math.max(3, total * 0.5)) return '🪓 Rejection Specialist'; if (c.maybe >= Math.max(3, total * 0.5)) return '🔍 Verification Detective'; if (c.yes && c.maybe && c.no) return '⚖️ Balanced Menace'; return total >= 5 ? '⚡ Speed Reviewer' : 'Warming up'; }
function compactJoke(pm: string, delta: number, words: number, remaining: number) { const fast = delta && delta < 35; const slow = delta >= 180; const long = words >= 30; const tiny = words <= 2; const byPm: Record<string,string[]> = { Milan: fast ? ['Gurgaon speedrun approved.'] : ['Gurgaon took longer to justify itself.'], Avika: long ? ['Orange Lays-level crunch, unusually detailed.'] : ['Orange Lays-level crispness, not sharing the packet.'], Ipshita: slow ? ['Green tea probably happened somewhere in the middle.'] : ['Green tea break has been provisionally earned.'], Rachit: fast ? ['Banana chips may arrive before the next NGO.'] : ['Networking speed, but with actual notes.'], Kamran: ['Drama avoided; rare institutional win.'], Piyush: ['Karma points credited, audit pending.'], Tanishq: ['Data hygiene survived another row.'] }; let line = (byPm[pm] || ['Spreadsheet damage reduced.'])[0]; if (tiny) line = 'Minimalist review; future people will still manage.'; if (slow) line = line + ' Thoughtful, or WhatsApp won for a bit.'; return `${line} ${remaining} left.`; }
function milestoneText(name: string, done: number, total: number) { const p = pct(done,total); if (p >= 100) return `${name} finished. Task closed.`; if (p >= 75) return `75% done. Final stretch.`; if (p >= 50) return PM_HALF_MILESTONE[name] || `${name} is halfway done.`; if (p >= 25) return `25% done. Momentum exists.`; if (p >= 10) return `10% done. Engine started.`; return ''; }

export default function WorkstreamPanel({ stateName }: { stateName: string }) {
  const [data, setData] = useState<WorkstreamData>(() => makeDefaultData());
  const [screen, setScreen] = useState<'board' | 'workspace'>('board');
  const [selectedPM, setSelectedPM] = useState('Avika');
  const [mode, setMode] = useState<'responsibility' | 'task'>('responsibility');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [, setTick] = useState(0);
  const [msg, setMsg] = useState('');
  const [lastBadge, setLastBadge] = useState('');
  const [lastPaceSeconds, setLastPaceSeconds] = useState<number | null>(null);
  const [lastQuality, setLastQuality] = useState('');
  const [lastVerdict, setLastVerdict] = useState('');
  const [streak, setStreak] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPm, setAdminPm] = useState('Avika');
  const [adminRules, setAdminRules] = useState(DEFAULT_RULES);
  const [adminDeadline, setAdminDeadline] = useState('');
  const [adminDeadlineNote, setAdminDeadlineNote] = useState('');
  const [adminResponsibility, setAdminResponsibility] = useState('');
  const [adminTasks, setAdminTasks] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTitle, setAiTitle] = useState('Response review');
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHelpful, setAiHelpful] = useState<string | null>(null);
  const [aiFeedbackText, setAiFeedbackText] = useState('');
  const [aboutPM, setAboutPM] = useState<any>(null);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [milestoneCopy, setMilestoneCopy] = useState('');

  const pm = data.pms?.[selectedPM] || makeDefaultData().pms[selectedPM];
  const isDetails = pm.task_type === 'ngo_details' || selectedPM === 'Tanishq';
  const task = pm.tasks?.[currentIndex] || null;
  const response = pm.responses?.[String(currentIndex)] || {};
  const done = submittedCount(pm);
  const total = pm.tasks?.length || 0;
  const progress = pct(done, total);
  const time = countdown(pm.deadline);
  const modeLabel = reviewerMode(pm);

  useEffect(() => { const id = window.setInterval(() => setTick(x => x + 1), 1000); return () => window.clearInterval(id); }, []);
  useEffect(() => { const base = backendBase(); const saved = typeof window !== 'undefined' ? window.localStorage.getItem('dfp-workstream-fallback') : ''; if(saved){ try{ setData(JSON.parse(saved)); }catch{} } if(!base) return; fetch(`${base}/workstream`, { cache: 'no-store' }).then(r=>r.json()).then(json=>{ if(json?.ok && json?.data) setData(json.data); }).catch(()=>setMsg('Backend not reachable. Local mode only.')); }, []);
  useEffect(() => { try{ window.localStorage.setItem('dfp-workstream-fallback', JSON.stringify(data)); }catch{} }, [data]);
  useEffect(() => { const r = pm.responses?.[String(currentIndex)] || {}; setDecision(r.decision || ''); setReason(r.reason || ''); setDescription(r.ngo_description || ''); setContactNumber(r.contact_number || r.referral_poc || ''); setReferralSource(r.referral_source || ''); }, [selectedPM, currentIndex, pm.responses]);
  useEffect(() => { if(!showAdmin) return; const target = data.pms?.[adminPm] || makeDefaultData().pms[adminPm]; setAdminRules(data.review_rules || DEFAULT_RULES); setAdminDeadline(target.deadline || ''); setAdminDeadlineNote(target.deadline_note || DEFAULT_DEADLINE_NOTE); setAdminResponsibility(target.responsibility || ''); setAdminTasks(''); }, [adminPm, showAdmin, data.pms, data.review_rules]);

  function taskLabel(name = selectedPM) { const target = data.pms?.[name]; return (target?.task_type === 'ngo_details' || name === 'Tanishq') ? 'NGO Details' : 'Shortlist'; }
  function openWorkspace(name: string) { setSelectedPM(name); setCurrentIndex(0); setMode('responsibility'); setMsg(''); setLastBadge(''); setLastQuality(''); setLastVerdict(''); setLastPaceSeconds(null); setStreak(0); setScreen('workspace'); }
  function startAdmin(name = selectedPM) { setAdminPm(name); setAdminPassword(''); setShowAdmin(true); }
  function patchLocalResponse(patch: Partial<ResponseRow>) { setData(old => { const next = JSON.parse(JSON.stringify(old)); next.pms[selectedPM].responses[String(currentIndex)] = { ...(next.pms[selectedPM].responses[String(currentIndex)] || {}), ...patch }; return next; }); }
  function validationMessage() { if(isDetails){ if(wordCount(description)<5) return 'Add a short NGO description.'; if(!contactNumber.trim()) return 'Add POC contact number.'; if(!referralSource.trim()) return 'Add referral source.'; return ''; } if(!decision) return 'Select Yes / Maybe / No.'; if(decision==='Maybe' && wordCount(reason)<6) return 'For Maybe, say what is missing or what needs checking.'; if(decision==='Yes' && wordCount(reason)<1) return 'For Yes, add one quick reason.'; return ''; }
  function reactionText(prevMs: number, newDone: number) { const txt = isDetails ? description : reason; const words = wordCount(txt); const delta = prevMs ? Math.max(1, Math.round((Date.now() - prevMs) / 1000)) : 0; const depth = explanationQuality(decision, txt, isDetails); const remaining = Math.max(0, total - newDone); const paceText = delta ? formatDuration(delta) : 'first submit'; return `Saved in ${paceText} · ${words} words · ${depth}. ${compactJoke(selectedPM, delta, words, remaining)}`; }
  function maybeShowMilestone(newDone: number) { const text = milestoneText(selectedPM, newDone, total); if(!text) return; const oldPct = pct(Math.max(0, newDone - 1), total); const newPct = pct(newDone, total); const thresholds = [10,25,50,75,100]; if(thresholds.some(t => oldPct < t && newPct >= t)){ setMilestoneCopy(text); setMilestoneOpen(true); burstConfetti(newPct >= 100 ? 150 : 80); } }
  async function submitDecision() { const error = validationMessage(); if(error){ setMsg(error); return; } const prevMs = latestSubmitMs(pm); const contactPayload = isDetails ? contactNumber : ''; const referralPayload = isDetails ? referralSource : ''; const payload = { pm: selectedPM, task_index: currentIndex, decision, reason, ngo_description: description, contact_number: contactPayload, referral_source: referralPayload, referral_poc: contactPayload }; const localResponse: ResponseRow = { decision, reason, ngo_description: description, contact_number: contactPayload, referral_source: referralPayload, referral_poc: contactPayload, submitted: true, submitted_at: new Date().toISOString(), global_saved: true, global_saved_at: new Date().toISOString() }; const newDone = response.submitted ? done : done + 1; const delta = prevMs ? Math.max(1, Math.round((Date.now() - prevMs) / 1000)) : 0; setLastBadge(paceBadge(delta)); setLastPaceSeconds(delta || null); setLastQuality(explanationQuality(decision, isDetails ? description : reason, isDetails)); setLastVerdict(verdictLine(decision)); setStreak(s => response.submitted ? s : s + 1); patchLocalResponse(localResponse); setMsg(reactionText(prevMs, newDone)); burstConfetti(newDone === 1 ? 130 : newDone === 5 ? 170 : newDone === total ? 170 : 55); maybeShowMilestone(newDone); const autoReview = newDone <= 5 && !response.submitted; const base = backendBase(); if(base){ try{ const res=await fetch(`${base}/workstream/submit`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }); const json=await res.json(); if(json?.ok && json?.data) setData(json.data); else setMsg(json?.error || 'Submit failed on backend. Kept locally.'); }catch(e:any){ setMsg(e?.message || 'Submit failed on backend. Kept locally.'); } } if(autoReview) { const reviewRow = { pm:selectedPM, task_index:currentIndex, decision, reason, ngo_description:description, contact_number:contactPayload, referral_source:referralPayload, referral_poc:contactPayload, submitted:true, submitted_at:localResponse.submitted_at }; window.setTimeout(()=>runReview('selected', true, [reviewRow]),450); } }
  async function deleteResponse() { if(!response.submitted) return; if(!window.confirm('Delete this response?')) return; setData(old => { const next = JSON.parse(JSON.stringify(old)); delete next.pms[selectedPM].responses[String(currentIndex)]; return next; }); setMsg('Deleted. Clean slate. The spreadsheet gets one fewer questionable memory.'); setLastBadge(''); setLastQuality(''); setLastVerdict(''); const base=backendBase(); if(base){ try{ const res=await fetch(`${base}/workstream/delete-response`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ pm:selectedPM, task_index:currentIndex }) }); const json=await res.json(); if(json?.ok && json?.data) setData(json.data); }catch{} } }
  async function runReview(kind: 'selected'|'so-far'|'admin', mandatory = false, overrideRows?: any[]) {
    const existingRows = kind === 'selected' ? submittedRows(pm).filter(([i]) => Number(i) === currentIndex) : submittedRows(pm);
    const effectiveRows = overrideRows && overrideRows.length ? overrideRows : existingRows.map(([i, r]) => ({ task_index: Number(i), ...r }));
    if (kind !== 'admin' && effectiveRows.length === 0) {
      setMsg('Submit first, then response review will open. Nothing useful to check yet.');
      return;
    }
    setAiOpen(true); setAiHelpful(null); setAiFeedbackText(''); setAiLoading(true);
    setAiTitle(kind==='selected' ? (mandatory ? 'Mandatory expression check' : 'Expression check') : kind==='admin' ? 'Saved expression check' : 'Expression check so far');
    const base=backendBase();
    if(!base){ setAiReview(localReviewFromRows(effectiveRows)); setAiLoading(false); return; }
    try{ const res=await fetch(`${base}/workstream/ai/review`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ mode:kind, pm:selectedPM, task_index:currentIndex, submitted_rows: overrideRows || undefined }) }); const json=await res.json(); if(json?.ok){ setAiReview(json.review || null); if(json.data) setData(json.data); } else setAiReview({ headline: json?.error || 'Review failed.', quality_flags:['No backend review returned.'], suggestions:['Continue manually.'] }); }catch(e:any){ setAiReview(localReviewFromRows(effectiveRows)); } finally{ setAiLoading(false); }
  }
  function localReviewFromRows(rows: any[]): AiReview { const lengths=rows.map((r)=>wordCount(r.reason || r.ngo_description || '')); const avg=lengths.length ? Math.round(lengths.reduce((a,b)=>a+b,0)/lengths.length) : 0; const veryShort=lengths.filter(n=>n<=2).length; const detailed=lengths.filter(n=>n>=18).length; const headline=veryShort && avg<8 ? 'Too thin — type more of what went through your head.' : avg>=18 ? 'Good depth — your judgement is captured clearly.' : 'Usable — a little more raw detail would help.'; return { headline, quality_flags:[`${rows.length} response(s) checked`, `Average length: ${avg} words`, veryShort ? `${veryShort} very short response(s)` : `${detailed} detailed response(s)`], suggestions:['No proper sentences needed.', 'Hinglish, fragments and messy notes are fine.', 'Write more instinct, not better English.'], pace_comment:`${rows.length} submitted for ${selectedPM}.`, encouragement:'Expression only. Not checking whether the decision is right.', source:'fallback' }; }
  async function applyAdmin() { const tasks=parseTasks(adminTasks); const target=adminPm || selectedPM; const payload={ password:adminPassword, review_rules:adminRules, pm:target, deadline:adminDeadline, deadline_note:adminDeadlineNote, responsibility:adminResponsibility, task_type:target==='Tanishq'?'ngo_details':'shortlisting', tasks }; const base=backendBase(); if(!base){ setData(old=>{ const next=JSON.parse(JSON.stringify(old)); next.review_rules=adminRules; next.pms[target].deadline=adminDeadline; next.pms[target].deadline_note=adminDeadlineNote; next.pms[target].responsibility=adminResponsibility; if(tasks.length) next.pms[target].tasks=[...(next.pms[target].tasks || []), ...tasks]; return next; }); setShowAdmin(false); setMsg('Admin changes applied locally.'); return; } setMsg('Publishing PM view config…'); try{ const res=await fetch(`${base}/workstream/admin/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }); const json=await res.json(); if(json?.ok){ setData(json.data); setShowAdmin(false); setMsg(tasks.length ? `${tasks.length} task(s) added.` : 'PM view config updated.'); } else setMsg(json?.error || 'Admin update failed.'); }catch(e:any){ setMsg(e?.message || 'Admin update failed.'); } }
  function nextTask(){ setCurrentIndex(i => Math.min((pm.tasks?.length || 1)-1, i+1)); }
  function prevTask(){ setCurrentIndex(i => Math.max(0, i-1)); }
  function handleTaskFile(file?: File | null){ if(!file) return; const reader=new FileReader(); reader.onload=()=>{ const tasks=parseTasks(String(reader.result || '')); setAdminTasks(taskToText(tasks)); setMsg(`${tasks.length} tasks ready to add.`); }; reader.readAsText(file); }

  const leaderboard = useMemo(() => LEADERBOARD_NAMES.map(name => ({ name, done: submittedCount(data.pms?.[name]), total: data.pms?.[name]?.tasks?.length || 0 })).sort((a,b)=>b.done-a.done || a.name.localeCompare(b.name)), [data]);
  const c = counts(pm);
  const selectedProfile = profileFor(selectedPM);

  return <section className="pmu-workstream pm-view-workstream">
    {screen === 'board' && <>
      <section className="pmu-board-head source-row"><div><h2>PM view</h2><p>Responsibilities and review progress.</p></div><a className="ghost-btn" href={exportHref()}>Export CSV</a></section>
      <section className="pmu-card-grid" aria-label="PM cards">
        {PM_NAMES.map(name => { const cardPm=data.pms?.[name] || makeDefaultData().pms[name]; const cardDone=submittedCount(cardPm); const cardTotal=cardPm.tasks?.length || 0; const profile=profileFor(name); return <article className="pm-score-card pmu-card" key={name}><h3>{name}</h3><p>{cardPm.responsibility}</p><div className="pmu-card-progress"><span>{cardDone}/{cardTotal}</span><i><em style={{ width: `${cardTotal ? Math.round(cardDone/cardTotal*100) : 0}%` }} /></i></div><button className="pmu-primary-action glow-action" onClick={() => { openWorkspace(name); setMode('task'); }}>{taskLabel(name)}</button><button onClick={() => setAboutPM(profile)}><span>About PM</span><strong>→</strong></button></article>; })}
      </section>
      <button className="config-gear workstream-gear" onClick={() => startAdmin(selectedPM)}>⚙</button>
    </>}

    {screen === 'workspace' && <section className="pmu-workspace-wrap"><button className="quiet-btn pmu-back" onClick={() => setScreen('board')}>← PM view</button><div className="workstream-grid pmu-workspace-grid"><div className="workstream-main-card pmu-main-card"><div className="workstream-head"><div className="pm-workspace-name">{selectedProfile.img ? <span className="pm-orb pm-photo"><Image src={selectedProfile.img} alt={selectedPM} width={54} height={54}/></span> : <span className="pm-orb">{PM_ICONS[selectedPM] || '◆'}</span>}<div><span className="workstream-kicker">PM</span><h2>{selectedPM}</h2></div></div><div className="workstream-deadline fun-deadline"><span>⏳ Time left</span><strong>{time.hours}</strong><em>{time.rest}</em></div></div><div className="deadline-note"><b>Why this deadline matters:</b> {pm.deadline_note || DEFAULT_DEADLINE_NOTE}</div><div className="progress-toggle workstream-tabs"><button className={mode === 'responsibility' ? 'active' : ''} onClick={() => setMode('responsibility')}>Responsibility</button><button className={mode === 'task' ? 'active' : ''} onClick={() => setMode('task')}>{taskLabel()}</button></div>{mode === 'responsibility' && <div className="workstream-task-card"><h3>Responsibility</h3><p>{pm.responsibility}</p></div>}{mode === 'task' && <><div className="game-strip"><span>🔥 Streak {streak}</span><span>{lastQuality || 'Quality —'}</span><span>{lastBadge ? `${lastBadge} · ${formatDuration(lastPaceSeconds)}` : 'Pace —'}</span><span>{modeLabel}</span></div><div className="workstream-progress-line pace-progress"><b>{done}/{total}</b><i><em style={{width:`${progress}%`}}/></i><span>Last: {formatDuration(lastPaceSeconds)}</span></div>{task ? <div className="workstream-task-card"><div className="task-nav-row"><button className="quiet-btn" onClick={prevTask} disabled={currentIndex === 0}>← Previous</button><span>NGO {currentIndex + 1} of {total}</span><button className="quiet-btn" onClick={nextTask} disabled={currentIndex >= total - 1}>Next →</button></div><h3>{task.ngo_name}</h3>{task.website && <a className="workstream-link" href={safeUrl(task.website)} target="_blank" rel="noreferrer">{task.website}</a>}<p>{task.background}</p>{!isDetails ? <><div className="decision-row"><button className={decision === 'Yes' ? 'yes active' : 'yes'} onClick={() => setDecision('Yes')}>Yes</button><button className={decision === 'Maybe' ? 'maybe active' : 'maybe'} onClick={() => setDecision('Maybe')}>Maybe</button><button className={decision === 'No' ? 'no active' : 'no'} onClick={() => setDecision('No')}>No</button></div><textarea className="workstream-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Write what comes to mind. Hinglish, fragments, messy notes — all fine. We need judgement, not grammar." /><div className="word-helper">{wordCount(reason)} words · {decision === 'No' ? 'No can be blank or one word.' : decision === 'Maybe' ? 'Maybe usually needs a bit more explanation.' : decision === 'Yes' ? 'Quick reason is enough. More depth is better.' : 'Select a decision.'}</div></> : <><input className="workstream-input" value={task.ngo_name} readOnly placeholder="NGO name"/><textarea className="workstream-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Details of NGO. Rough notes are fine." /><input className="workstream-input" value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="POC contact number" /><input className="workstream-input" value={referralSource} onChange={e => setReferralSource(e.target.value)} placeholder="Referral came from which NGO?" /><div className="word-helper">{wordCount(description)} words · capture enough to follow up.</div></>}<div className="workstream-actions"><button className="primary-red glow-action" onClick={submitDecision}>Submit</button><button className="ghost-btn" onClick={() => runReview('selected')} disabled={!response.submitted}>Response review</button><button className="ghost-btn" onClick={deleteResponse} disabled={!response.submitted}>Delete response</button></div><div className="live-reaction"><b>{lastVerdict || 'Live reaction'}</b><span>{msg || (response.submitted ? `Saved at ${niceTime(response.submitted_at)}. Edit and submit again anytime.` : 'Submit to save. First five submissions trigger response review automatically.')}</span></div></div> : <div className="workstream-task-card"><h3>No task added</h3><p>Add tasks from the PM view gear.</p></div>}{progress >= 100 && <EndSummary pm={pm} name={selectedPM} /> }<div className="workstream-footer-actions"><button className="ghost-btn" onClick={() => runReview('so-far')}>Review responses</button><a className="ghost-btn" href={exportHref()}>Export CSV</a></div></>}</div><aside className="workstream-side pmu-compact-side"><div className="mini-panel pm-mini-leaderboard"><h3>Leaderboard</h3>{leaderboard.map((r,i)=><div className="mini-row" key={r.name}><span>{i===0 && r.done>0 ? '🏆 ' : ''}{r.name}</span><b>{r.done}/{r.total}</b></div>)}</div><div className="mini-panel pm-mini-summary"><h3>Summary</h3><div className="mini-row"><span>Yes</span><b>{c.yes}</b></div><div className="mini-row"><span>Maybe</span><b>{c.maybe}</b></div><div className="mini-row"><span>No</span><b>{c.no}</b></div><div className="mini-row"><span>Avg pace</span><b>{avgPace(pm)}</b></div></div></aside></div><button className="config-gear workstream-gear" onClick={() => startAdmin(selectedPM)}>⚙</button></section>}

    {milestoneOpen && <div className="modal-scrim" onClick={() => setMilestoneOpen(false)}><section className="milestone-modal" onClick={e => e.stopPropagation()}><button className="modal-x" onClick={() => setMilestoneOpen(false)}>×</button><span className="workstream-kicker">Milestone</span><h2>{milestoneCopy}</h2><p>{progress >= 100 ? 'Done. You may now pretend this was easy.' : 'Keep going. Useful judgement beats neat English.'}</p><button className="primary-red" onClick={() => setMilestoneOpen(false)}>OK</button></section></div>}
    {aboutPM && <div className="modal-scrim" onClick={() => setAboutPM(null)}><section className="pm-about-modal" onClick={e => e.stopPropagation()}><button className="modal-x" onClick={() => setAboutPM(null)}>×</button><div className="pm-about-head">{aboutPM.img ? <Image src={aboutPM.img} alt={aboutPM.name} width={104} height={104}/> : null}<div><span>{aboutPM.tagline}</span><h2>{aboutPM.name}</h2><p>{aboutPM.role}</p></div></div><p className="pm-about-copy">{aboutPM.about}</p></section></div>}
    {aiOpen && <div className="modal-scrim" onClick={() => setAiOpen(false)}><section className="ai-review-modal" onClick={e => e.stopPropagation()}><button className="modal-x" onClick={() => setAiOpen(false)}>×</button><span className="workstream-kicker">Response review</span><h2>{aiTitle}</h2>{aiLoading ? <p>Reviewing…</p> : <AiReviewBlock review={aiReview}/>}<div className="ai-feedback"><span>Useful?</span><button className={aiHelpful === 'yes' ? 'active' : ''} onClick={() => setAiHelpful('yes')}>Yes</button><button className={aiHelpful === 'no' ? 'active' : ''} onClick={() => setAiHelpful('no')}>No</button></div>{aiHelpful && <textarea className="workstream-textarea ai-feedback-box" value={aiFeedbackText} onChange={e => setAiFeedbackText(e.target.value)} placeholder={aiHelpful === 'yes' ? 'What worked?' : 'What should change?'} />}<div className="workstream-actions"><button className="primary-red" onClick={() => setAiOpen(false)}>OK</button></div><p className="ai-cost-note">First five are automatic. This checks expression only: length, clarity, and whether your thought is captured. Hinglish/fragments/no punctuation are fine.</p></section></div>}
    {showAdmin && <><div className="drawer-scrim" onClick={() => setShowAdmin(false)}/><aside className="config-drawer"><div className="drawer-head"><h2>PM view gear</h2><button onClick={() => setShowAdmin(false)}>×</button></div><div className="drawer-body"><label className="admin-field"><span>PM</span><select value={adminPm} onChange={e => setAdminPm(e.target.value)}>{PM_NAMES.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label className="admin-field"><span>Expression review rules</span><textarea value={adminRules} onChange={e => setAdminRules(e.target.value)} /></label><FieldLike label="Active deadline" value={adminDeadline} onChange={setAdminDeadline} type="datetime-local"/><label className="admin-field"><span>Why deadline matters</span><textarea value={adminDeadlineNote} onChange={e => setAdminDeadlineNote(e.target.value)} /></label><label className="admin-field"><span>Responsibility</span><textarea value={adminResponsibility} onChange={e => setAdminResponsibility(e.target.value)} /></label><label className="admin-field"><span>Upload task CSV</span><input type="file" accept=".csv,.txt" onChange={e => handleTaskFile(e.target.files?.[0])} /></label><label className="admin-field"><span>Tasks to add: NGO name | Website/source | Description</span><textarea value={adminTasks} onChange={e => setAdminTasks(e.target.value)} /></label><FieldLike label="Admin password" value={adminPassword} onChange={setAdminPassword}/><p className="drawer-msg">{msg}</p></div><div className="drawer-foot"><button className="ghost-btn" onClick={() => setShowAdmin(false)}>Cancel</button><button className="primary-red" onClick={applyAdmin}>Publish</button></div></aside></>}
  </section>;
}

function AiReviewBlock({ review }: { review: AiReview | null }) { if(!review) return <p>No review returned.</p>; return <div className="ai-review-body"><h3>{review.headline || 'Expression check complete.'}</h3>{review.quality_flags?.length ? <><b>Expression check</b><ul>{review.quality_flags.map((x,i)=><li key={i}>{x}</li>)}</ul></> : null}{review.suggestions?.length ? <><b>Nudge</b><ul>{review.suggestions.map((x,i)=><li key={i}>{x}</li>)}</ul></> : null}<p>{review.pace_comment}</p><p>{review.encouragement}</p></div>; }
function EndSummary({ pm, name }: { pm: PmData; name: string }) { const c = counts(pm); const done = submittedCount(pm); return <div className="end-summary-card"><span>Task closed</span><h3>{name} finished {done} NGOs</h3><p>Yes {c.yes} · Maybe {c.maybe} · No {c.no} · Avg pace {avgPace(pm)} · Mode {reviewerMode(pm)}</p></div>; }
function FieldLike({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange?: (v: string) => void; type?: string }) { return <label className="admin-field"><span>{label}</span><input type={type} value={value || ''} onChange={e => onChange?.(e.target.value)} /></label>; }
function burstConfetti(n = 40) { if(typeof document === 'undefined') return; const root=document.createElement('div'); root.className='confetti-root'; document.body.appendChild(root); const colors=['#ef4444','#f59e0b','#22c55e','#38bdf8','#a78bfa','#f472b6']; for(let i=0;i<n;i++){ const piece=document.createElement('i'); piece.style.left=`${Math.random()*100}vw`; piece.style.background=colors[Math.floor(Math.random()*colors.length)]; piece.style.animationDelay=`${Math.random()*0.25}s`; root.appendChild(piece); } window.setTimeout(()=>root.remove(),1700); }
