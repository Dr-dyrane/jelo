'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CalendarClock, ChevronDown, Clock3, Moon, RefreshCw, ShieldAlert, Sparkles, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { inferMarket } from '@/data/prices';
import { SafeProductImage } from '@/components/products/safe-product-image';

const prompts = ['Tiny bumps on my forehead', 'Dark marks after acne', 'My face is oily and sensitive'];
const timelineKey = 'jelocare:clinical-timeline:v1';

type Report = { title: string; summary: string; pattern: string; routine: { time: 'Morning' | 'Evening' | 'Weekly' | 'Any time'; action: string }[]; cautions: string[]; productSlugs: string[]; followUp: string };
type ConsultProduct = { slug: string; brand: string; name: string; image: string; size: string; step: string; displayLine: string; price: { amount: number; currency: 'NGN' | 'USD'; retailer: string; market: 'NG' | 'US' } | null; retailers: { retailer: string; href: string }[] };
type Profile = { age?: number; pregnant?: boolean; breastfeeding?: boolean; sensitiveSkin?: boolean; allergies?: string[]; medications?: string[]; currentIngredients?: string[] };
type Evidence = { id: string; title: string; source: string; sourceType: string; level: 'high' | 'moderate' | 'limited' | 'insufficient'; summary: string; reviewedAt: string; reviewStatus: 'reviewed' | 'needs-review' };
type ClinicalFinding = { ruleId: string; severity: 'info' | 'caution' | 'high' | 'urgent'; title: string; explanation: string; action: 'allow' | 'adjust' | 'avoid' | 'escalate'; evidence?: Evidence[] };
type OptimizedStep = { time: 'Morning' | 'Evening' | 'Weekly'; action: string; rationale: string; frequency: string };
type Barrier = { score: number; state: 'stable' | 'watch' | 'stressed' | 'compromised'; confidence: 'low' | 'moderate' | 'high'; signals: string[]; recoveryPriority: 'routine' | 'elevated' | 'high'; recommendedRecoveryNights: number };
type Clinical = { profile?: Profile; findings: ClinicalFinding[]; evidence: Evidence[]; blockedIngredientIds: string[]; activeLoad: { exfoliant: number; retinoid: number; antimicrobial: number; total: number }; barrier: Barrier; optimizedRoutine: OptimizedStep[]; routineSummary?: string };
type TimelineRecord = { id: string; schemaVersion: 1; createdAt: string; assessmentType: 'consultation'; concernSummary: string; concerns: string[]; market: 'NG' | 'US'; barrier: Barrier; activeLoad: Clinical['activeLoad']; findingRuleIds: string[]; blockedIngredientIds: string[]; detectedIngredientIds: string[]; routineSummary?: string; recommendedProductSlugs: string[]; followUpAt: string };
type TimelineInsight = { direction: 'first-assessment' | 'improving' | 'stable' | 'worsening' | 'mixed'; barrierDelta: number | null; activeLoadDelta: number | null; previousAssessmentAt?: string; summary: string; actions: string[]; confidence: 'low' | 'moderate' | 'high' };
type Consultation = { report: Report; products: ConsultProduct[]; clinical?: Clinical; timeline?: TimelineRecord; timelineInsight?: TimelineInsight; meta: { modelCalls: number; market: 'NG' | 'US'; concerns: string[]; fallback?: boolean } };

type ProfileForm = { age: string; pregnant: boolean; breastfeeding: boolean; sensitiveSkin: boolean; allergies: string; medications: string; currentIngredients: string };
const emptyProfile: ProfileForm = { age: '', pregnant: false, breastfeeding: false, sensitiveSkin: false, allergies: '', medications: '', currentIngredients: '' };

function list(value: string) { return value.split(/[,\n]/).map(item => item.trim()).filter(Boolean); }
function profilePayload(profile: ProfileForm): Profile {
  return { age: profile.age ? Number(profile.age) : undefined, pregnant: profile.pregnant || undefined, breastfeeding: profile.breastfeeding || undefined, sensitiveSkin: profile.sensitiveSkin || undefined, allergies: list(profile.allergies).length ? list(profile.allergies) : undefined, medications: list(profile.medications).length ? list(profile.medications) : undefined, currentIngredients: list(profile.currentIngredients).length ? list(profile.currentIngredients) : undefined };
}
function formatPrice(product: ConsultProduct) {
  if (!product.price) return 'Live price';
  return new Intl.NumberFormat(product.price.currency === 'NGN' ? 'en-NG' : 'en-US', { style: 'currency', currency: product.price.currency, maximumFractionDigits: product.price.currency === 'NGN' ? 0 : 2 }).format(product.price.amount);
}
function RoutineIcon({ time }: { time: Report['routine'][number]['time'] }) {
  if (time === 'Morning') return <Sun size={18} />;
  if (time === 'Evening') return <Moon size={18} />;
  return <Clock3 size={18} />;
}
function TrendIcon({ direction }: { direction: TimelineInsight['direction'] }) {
  if (direction === 'improving') return <ArrowUpRight size={22} />;
  if (direction === 'worsening') return <ArrowDownRight size={22} />;
  return <ArrowRight size={22} />;
}
function saveTimeline(record?: TimelineRecord) {
  if (!record) return [];
  let current: TimelineRecord[] = [];
  try { current = JSON.parse(window.localStorage.getItem(timelineKey) ?? '[]'); } catch { current = []; }
  const next = [record, ...current.filter(item => item.id !== record.id)].slice(0, 24);
  window.localStorage.setItem(timelineKey, JSON.stringify(next));
  return next;
}

export function ConsultExperience() {
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [result, setResult] = useState<Consultation | null>(null);
  const [timeline, setTimeline] = useState<TimelineRecord[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const market = useMemo(() => inferMarket(), []);

  useEffect(() => { try { setTimeline(JSON.parse(window.localStorage.getItem(timelineKey) ?? '[]')); } catch { setTimeline([]); } }, []);

  async function submit(text: string) {
    const query = text.trim();
    if (!query || busy) return;
    setBusy(true); setError(''); setSubmittedQuery(query);
    const patient = profilePayload(profile);
    const priorTimeline = timeline.slice(0, 8);
    const fingerprint = JSON.stringify({ patient, history: priorTimeline.map(item => [item.id, item.barrier.score, item.activeLoad.total]) });
    const cacheKey = `jelocare:consult:v6:${market}:${query.toLowerCase().replace(/\s+/g, ' ')}:${fingerprint}`;
    const cached = window.localStorage.getItem(cacheKey);
    if (cached) {
      try { const parsed = JSON.parse(cached); setResult(parsed); setTimeline(saveTimeline(parsed.timeline)); setInput(''); setBusy(false); return; } catch { window.localStorage.removeItem(cacheKey); }
    }
    try {
      const response = await fetch('/api/consult', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, market, profile: patient, priorTimeline }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Consultation failed');
      setResult(payload); setTimeline(saveTimeline(payload.timeline)); window.localStorage.setItem(cacheKey, JSON.stringify(payload)); setInput('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The consultation could not continue.'); }
    finally { setBusy(false); }
  }

  function reset() { setResult(null); setSubmittedQuery(''); setError(''); }

  if (result) return (
    <section className="consult-report" aria-live="polite">
      <header className="report-hero"><div><p className="eyebrow"><Sparkles size={14}/> JeloCare assessment</p><h2>{result.report.title}</h2><p className="report-summary">{result.report.summary}</p></div><button className="report-reset" type="button" onClick={reset}><RefreshCw size={17}/> Ask another</button></header>
      <div className="report-query"><span>You described</span><p>{submittedQuery}</p></div>
      <div className="report-grid">
        <article className="report-panel report-pattern"><p className="eyebrow">What it may fit</p><h3>A useful working pattern</h3><p>{result.report.pattern}</p><div className="concern-chips">{result.meta.concerns.map(concern => <span key={concern}>{concern}</span>)}</div></article>
        <article className="report-panel"><p className="eyebrow">Optimized routine</p><h3>Keep it deliberate.</h3>{result.clinical?.routineSummary ? <p className="routine-summary">{result.clinical.routineSummary}</p> : null}<div className="routine-list">{(result.clinical?.optimizedRoutine?.length ? result.clinical.optimizedRoutine : result.report.routine).map((item,index)=><div className="routine-step" key={`${item.time}-${index}`}><span className="routine-icon"><RoutineIcon time={item.time}/></span><div><strong>{item.time}</strong><p>{item.action}</p>{'rationale' in item ? <small>{item.frequency} · {item.rationale}</small> : null}</div></div>)}</div></article>
      </div>
      {result.clinical ? <><section className="barrier-card"><div className={`barrier-score barrier-${result.clinical.barrier.state}`}><span>Barrier score</span><strong>{result.clinical.barrier.score}</strong><small>{result.clinical.barrier.state}</small></div><div className="barrier-copy"><p className="eyebrow">Recovery intelligence</p><h3>{result.clinical.barrier.recoveryPriority === 'high' ? 'Recovery comes first.' : result.clinical.barrier.recoveryPriority === 'elevated' ? 'Protect tolerance.' : 'Barrier looks steady.'}</h3><p>{result.clinical.barrier.recommendedRecoveryNights ? `${result.clinical.barrier.recommendedRecoveryNights} recovery night${result.clinical.barrier.recommendedRecoveryNights > 1 ? 's' : ''} recommended each week.` : 'No extra recovery nights were triggered.'}</p>{result.clinical.barrier.signals.length ? <div className="barrier-signals">{result.clinical.barrier.signals.map(signal=><span key={signal}>{signal}</span>)}</div> : null}</div></section><section className="clinical-strip"><div><span>Active load</span><strong>{result.clinical.activeLoad.total}</strong><small>{result.clinical.activeLoad.total <= 1 ? 'Low' : result.clinical.activeLoad.total === 2 ? 'Moderate' : 'High'}</small></div><div><span>Exfoliants</span><strong>{result.clinical.activeLoad.exfoliant}</strong></div><div><span>Retinoids</span><strong>{result.clinical.activeLoad.retinoid}</strong></div><div><span>Blocked</span><strong>{result.clinical.blockedIngredientIds.length}</strong></div></section></> : null}
      {result.timelineInsight ? <section className={`trend-card trend-${result.timelineInsight.direction}`}><div className="trend-icon"><TrendIcon direction={result.timelineInsight.direction}/></div><div><p className="eyebrow">Longitudinal signal</p><h3>{result.timelineInsight.direction.replace('-', ' ')}</h3><p>{result.timelineInsight.summary}</p><div className="trend-actions">{result.timelineInsight.actions.map(action=><span key={action}>{action}</span>)}</div></div><div className="trend-deltas"><span>Barrier change<strong>{result.timelineInsight.barrierDelta === null ? 'Baseline' : `${result.timelineInsight.barrierDelta >= 0 ? '+' : ''}${result.timelineInsight.barrierDelta}`}</strong></span><span>Active load<strong>{result.timelineInsight.activeLoadDelta === null ? 'Baseline' : `${result.timelineInsight.activeLoadDelta >= 0 ? '+' : ''}${result.timelineInsight.activeLoadDelta}`}</strong></span><small>{result.timelineInsight.confidence} confidence</small></div></section> : null}
      {result.timeline ? <section className="timeline-card"><div><p className="eyebrow"><CalendarClock size={14}/> Clinical timeline</p><h3>Assessment saved.</h3><p>This record now anchors future comparisons of barrier state, active load and routine changes.</p></div><div className="timeline-meta"><span>Follow-up</span><strong>{new Date(result.timeline.followUpAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</strong><small>{timeline.length} saved assessment{timeline.length === 1 ? '' : 's'} on this device</small></div></section> : null}
      {result.products.length ? <section className="report-products"><div className="report-section-heading"><div><p className="eyebrow">Matched products</p><h3>Start with less.<br/>Choose well.</h3></div><span>{result.meta.market === 'US' ? 'United States offers' : 'Nigeria offers'}</span></div><div className="consult-product-grid">{result.products.map(product=><article className="consult-product" key={product.slug}><Link className="consult-product-image" href={`/products/${product.slug}`}><SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`}/><span className="consult-product-price">{formatPrice(product)}</span><span className="consult-product-arrow"><ArrowUpRight size={19}/></span></Link><div className="consult-product-copy"><p className="eyebrow">{product.brand}</p><h4><Link href={`/products/${product.slug}`}>{product.name}</Link></h4><p>{product.step} · {product.size}</p><div className="consult-retailers">{product.retailers.map(offer=><a key={offer.retailer} href={offer.href}>{offer.retailer}<ArrowUpRight size={14}/></a>)}</div></div></article>)}</div></section> : null}
      <div className="report-bottom-grid"><article className="report-panel caution-panel"><p className="eyebrow"><ShieldAlert size={14}/> Clinical checks</p>{result.clinical?.findings?.length ? <div className="finding-list">{result.clinical.findings.map(finding=><div className={`finding finding-${finding.severity}`} key={finding.ruleId}><strong>{finding.title}</strong><p>{finding.explanation}</p>{finding.evidence?.length ? <small>{finding.evidence.map(item => item.title).join(' · ')}</small> : null}</div>)}</div> : <ul>{result.report.cautions.map(item=><li key={item}>{item}</li>)}</ul>}</article><article className="report-panel follow-panel"><p className="eyebrow">Follow-up</p><p>{result.report.followUp}</p></article></div>
      {result.clinical?.evidence?.length ? <section className="evidence-panel"><div className="evidence-heading"><div><p className="eyebrow"><BookOpen size={14}/> Evidence</p><h3>Why these checks fired.</h3></div><span>{result.clinical.evidence.length} reviewed source{result.clinical.evidence.length === 1 ? '' : 's'}</span></div><div className="evidence-grid">{result.clinical.evidence.map(item=><article key={item.id}><div><span className={`evidence-level evidence-${item.level}`}>{item.level}</span><span>{item.sourceType.replace('-', ' ')}</span></div><h4>{item.title}</h4><p>{item.summary}</p><footer>{item.source}<span>Reviewed {new Date(item.reviewedAt).toLocaleDateString(undefined,{year:'numeric',month:'short'})}</span></footer></article>)}</div></section> : null}
      <p className="report-disclaimer">One AI generation was used for this report. Clinical safety checks, barrier scoring, timeline trend analysis, evidence selection and routine optimization were deterministic. Guidance, not diagnosis.</p>
    </section>
  );

  return <section className="consult-card"><div className="consult-empty"><div className="consult-orb"><Sparkles size={24}/></div><p>Tell us what you notice, where it is, how long it has been there, and what you have already tried.</p><div className="prompt-row">{prompts.map(prompt=><button key={prompt} type="button" onClick={()=>submit(prompt)}>{prompt}</button>)}</div>{timeline.length ? <p className="timeline-note"><CalendarClock size={14}/> {timeline.length} prior assessment{timeline.length === 1 ? '' : 's'} will inform this comparison.</p> : null}</div><details className="profile-disclosure"><summary><span>Personalize this assessment</span><ChevronDown size={17}/></summary><div className="profile-grid"><label>Age<input inputMode="numeric" min="12" max="100" value={profile.age} onChange={event=>setProfile({...profile,age:event.target.value.replace(/\D/g,'').slice(0,3)})} placeholder="Optional"/></label><label className="profile-wide">Current products or ingredients<textarea rows={2} value={profile.currentIngredients} onChange={event=>setProfile({...profile,currentIngredients:event.target.value})} placeholder="Retinol, salicylic acid, benzoyl peroxide…"/></label><label>Allergies<input value={profile.allergies} onChange={event=>setProfile({...profile,allergies:event.target.value})} placeholder="Comma-separated"/></label><label>Medications<input value={profile.medications} onChange={event=>setProfile({...profile,medications:event.target.value})} placeholder="Comma-separated"/></label><div className="profile-toggles"><button type="button" aria-pressed={profile.sensitiveSkin} onClick={()=>setProfile({...profile,sensitiveSkin:!profile.sensitiveSkin})}>Sensitive skin</button><button type="button" aria-pressed={profile.pregnant} onClick={()=>setProfile({...profile,pregnant:!profile.pregnant})}>Pregnant</button><button type="button" aria-pressed={profile.breastfeeding} onClick={()=>setProfile({...profile,breastfeeding:!profile.breastfeeding})}>Breastfeeding</button></div></div></details><form className="consult-form" onSubmit={event=>{event.preventDefault();submit(input)}}><textarea value={input} onChange={event=>setInput(event.target.value)} placeholder="Describe your concern…" rows={4} aria-label="Describe your skin concern"/><button type="submit" disabled={!input.trim()||busy}>{busy?'Considering…':'Create assessment'}</button></form>{error?<p className="consult-error">{error}</p>:null}<p className="consult-note">Urgent, painful or rapidly worsening symptoms need in-person care.</p></section>;
}