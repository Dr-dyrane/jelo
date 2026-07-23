'use client';

import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdaptiveSelector, type AdaptiveOption } from '@/components/ui/adaptive-selector';
import {
  emptyContributionDraft,
  contributionDraftSchema,
  finalContributionSchema,
  type AdaptiveValue,
  type ContributionDraft,
  type ContributionKind,
  type IntakeEvent,
} from '@/lib/community-intake/schema';
import styles from '@/app/contribute/contribute.module.css';

type ContributionExperienceProps = {
  purposes: AdaptiveOption[];
  products: AdaptiveOption[];
  brands: AdaptiveOption[];
  retailers: AdaptiveOption[];
};

type FlowStep = 'kind' | 'purposes' | 'products' | 'brand' | 'retailer' | 'purchase' | 'outcome' | 'review';
type SaveState = 'device' | 'saving' | 'saved' | 'error';

const localDraftKey = 'jelocare-community-intake-v1';
const kindOptions: AdaptiveOption[] = [
  { id: 'product', label: 'One product', detail: 'What you used and where you found it' },
  { id: 'routine', label: 'My routine', detail: 'The products you use together' },
  { id: 'store', label: 'A trusted store', detail: 'A place others should know' },
];
const outcomeOptions: AdaptiveOption[] = [
  { id: 'love-it', label: 'Love it' },
  { id: 'helped', label: 'Helped' },
  { id: 'unsure', label: 'Not sure' },
  { id: 'didnt-help', label: 'Didn’t help' },
];

function flowFor(draft: ContributionDraft, hasKind: boolean): FlowStep[] {
  if (!hasKind) return ['kind'];
  if (draft.kind === 'routine') return ['kind', 'purposes', 'products', 'outcome', 'review'];
  if (draft.kind === 'store') return ['kind', 'purposes', 'retailer', 'review'];
  const needsBrand = draft.products.length === 0 || draft.products[0]?.source === 'custom';
  return ['kind', 'purposes', 'products', ...(needsBrand ? ['brand' as const] : []), 'retailer', 'purchase', 'outcome', 'review'];
}

function selection(id: string, label: string): AdaptiveValue {
  return { id, label, source: 'canonical' };
}

function joined(values: AdaptiveValue[]) {
  return values.map(value => value.label).join(', ');
}

function restoredState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(localDraftKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      draft?: unknown;
      hasKind?: boolean;
      draftId?: string | null;
      revision?: number;
      submitKey?: string;
    };
    return parsed;
  } catch {
    return null;
  }
}

export function ContributionExperience({ purposes, products, brands, retailers }: ContributionExperienceProps) {
  const [draft, setDraft] = useState<ContributionDraft>(() => emptyContributionDraft());
  const [hasKind, setHasKind] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('device');
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const draftIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const submitKeyRef = useRef(crypto.randomUUID());
  const createPromiseRef = useRef<Promise<string | null> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingEventsRef = useRef<IntakeEvent[]>([]);
  const lastStepRef = useRef<FlowStep | null>(null);
  const flow = useMemo(() => flowFor(draft, hasKind), [draft, hasKind]);
  const currentStep = flow[Math.min(stepIndex, flow.length - 1)] ?? 'kind';

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const restored = restoredState();
      if (restored?.draft) {
        const parsed = contributionDraftSchema.safeParse(restored.draft);
        const partial = parsed.success ? parsed.data : null;
        if (partial) {
          setDraft(partial);
          setHasKind(Boolean(restored.hasKind));
          setStepIndex(Math.max(0, Math.min(partial.currentStep - 1, 8)));
          draftIdRef.current = restored.draftId ?? null;
          revisionRef.current = Number.isInteger(restored.revision) ? restored.revision ?? 0 : 0;
          if (restored.submitKey) submitKeyRef.current = restored.submitKey;
          pendingEventsRef.current.push({ id: crypto.randomUUID(), type: 'draft_restored', step: partial.currentStep, inputMode: null, resultsCount: null });
        }
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const recordEvent = useCallback((type: IntakeEvent['type'], inputMode: IntakeEvent['inputMode'], resultsCount: number | null) => {
    pendingEventsRef.current.push({
      id: crypto.randomUUID(),
      type,
      step: Math.min(stepIndex + 1, 9),
      inputMode,
      resultsCount,
    });
  }, [stepIndex]);

  const persistLocalDraft = useCallback((snapshot: ContributionDraft) => {
    window.localStorage.setItem(localDraftKey, JSON.stringify({
      draft: snapshot,
      hasKind: true,
      draftId: draftIdRef.current,
      revision: revisionRef.current,
      submitKey: submitKeyRef.current,
    }));
  }, []);

  useEffect(() => {
    if (!hydrated || lastStepRef.current === currentStep) return;
    lastStepRef.current = currentStep;
    recordEvent('step_viewed', null, null);
  }, [currentStep, hydrated, recordEvent]);

  const ensureRemoteDraft = useCallback(async (kind: ContributionKind) => {
    if (draftIdRef.current) return draftIdRef.current;
    if (createPromiseRef.current) return createPromiseRef.current;
    createPromiseRef.current = (async () => {
      try {
        const response = await fetch('/api/contribute/drafts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ kind, website: '' }),
        });
        if (!response.ok) return null;
        const data = await response.json() as { draftId: string; revision: number };
        draftIdRef.current = data.draftId;
        revisionRef.current = data.revision;
        return data.draftId;
      } catch {
        return null;
      } finally {
        createPromiseRef.current = null;
      }
    })();
    return createPromiseRef.current;
  }, []);

  const saveSnapshot = useCallback(async (snapshot: ContributionDraft, events: IntakeEvent[]) => {
    setSaveState('saving');
    const draftId = await ensureRemoteDraft(snapshot.kind);
    if (!draftId) {
      setSaveState('device');
      return;
    }
    // The remote capability changes outside React state. Persist it immediately so
    // a reload between draft creation and the next answer resumes this draft.
    persistLocalDraft(snapshot);

    async function requestSave(revision: number) {
      return fetch(`/api/contribute/drafts/${draftId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision, draft: snapshot, events, website: '' }),
      });
    }

    try {
      let response = await requestSave(revisionRef.current);
      if (response.status === 409) {
        const conflict = await response.json() as { revision?: number };
        if (Number.isInteger(conflict.revision)) revisionRef.current = conflict.revision!;
        response = await requestSave(revisionRef.current);
      }
      if (!response.ok) {
        setSaveState(response.status === 401 || response.status === 404 ? 'device' : 'error');
        return;
      }
      const data = await response.json() as { revision: number };
      revisionRef.current = data.revision;
      persistLocalDraft(snapshot);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [ensureRemoteDraft, persistLocalDraft]);

  useEffect(() => {
    if (!hydrated || !hasKind || complete) return;
    persistLocalDraft(draft);
    const timer = window.setTimeout(() => {
      const events = pendingEventsRef.current.splice(0, 50);
      saveQueueRef.current = saveQueueRef.current.then(() => saveSnapshot(draft, events));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [complete, draft, hasKind, hydrated, persistLocalDraft, saveSnapshot]);

  function replaceDraft(next: ContributionDraft) {
    setDraft({ ...next, currentStep: Math.min(stepIndex + 1, 9) });
    setError('');
  }

  function patchDraft(patch: Partial<ContributionDraft>) {
    setDraft(current => ({ ...current, ...patch, currentStep: Math.min(stepIndex + 1, 9) }));
    setError('');
  }

  function nextStep() {
    const next = Math.min(stepIndex + 1, flow.length - 1);
    setStepIndex(next);
    setDraft(current => ({ ...current, currentStep: Math.min(next + 1, 9) }));
    setError('');
  }

  function previousStep() {
    const next = Math.max(0, stepIndex - 1);
    setStepIndex(next);
    setDraft(current => ({ ...current, currentStep: Math.min(next + 1, 9) }));
    setError('');
  }

  function chooseKind(values: AdaptiveValue[]) {
    const value = values[0];
    if (!value) return;
    const kind = value.id as ContributionKind;
    const next = emptyContributionDraft(kind);
    setHasKind(true);
    replaceDraft(next);
  }

  function chooseProducts(values: AdaptiveValue[]) {
    if (draft.kind !== 'product') {
      patchDraft({ products: values });
      return;
    }
    const chosen = values[0];
    const option = products.find(product => product.id === chosen?.id);
    const knownBrand = option?.detail ? brands.find(brand => brand.label === option.detail) : undefined;
    patchDraft({ products: values, brands: knownBrand ? [selection(knownBrand.id, knownBrand.label)] : [] });
  }

  function canContinue() {
    if (currentStep === 'kind') return hasKind;
    if (currentStep === 'purposes') return draft.purposes.length > 0;
    if (currentStep === 'products') return draft.products.length > 0;
    if (currentStep === 'brand') return draft.brands.length > 0;
    if (currentStep === 'retailer') return draft.retailers.length > 0;
    if (currentStep === 'outcome') return Boolean(draft.outcome);
    return true;
  }

  async function submit() {
    const validated = finalContributionSchema.safeParse(draft);
    if (!validated.success) {
      setError('A few answers are still missing.');
      return;
    }
    setSubmitting(true);
    setError('');
    const events = pendingEventsRef.current.splice(0, 50);
    saveQueueRef.current = saveQueueRef.current.then(() => saveSnapshot(validated.data, events));
    await saveQueueRef.current;
    const draftId = draftIdRef.current;
    if (!draftId) {
      setSubmitting(false);
      setError('Saved on this device. Connect and try again.');
      return;
    }
    try {
      const response = await fetch(`/api/contribute/drafts/${draftId}/submit`, {
        method: 'POST',
        headers: { 'idempotency-key': submitKeyRef.current },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setError(data?.error ?? 'Could not submit yet.');
        return;
      }
      window.localStorage.removeItem(localDraftKey);
      setComplete(true);
    } catch {
      setError('Could not submit yet. Your draft is still saved.');
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    const next = emptyContributionDraft();
    setDraft(next);
    setHasKind(false);
    setStepIndex(0);
    setComplete(false);
    setError('');
    setSaveState('device');
    draftIdRef.current = null;
    revisionRef.current = 0;
    submitKeyRef.current = crypto.randomUUID();
    window.localStorage.removeItem(localDraftKey);
  }

  if (!hydrated) return <div className={styles.loading} aria-label="Loading">Loading…</div>;

  if (complete) return <section className={styles.complete} aria-labelledby="contribution-complete-title">
    <span><Check size={28} aria-hidden="true" /></span>
    <p>Shared with JeloCare</p>
    <h2 id="contribution-complete-title">Thank you.</h2>
    <p>Your note helps grow Nigeria’s skincare library.</p>
    <div><button type="button" onClick={startAnother}><RotateCcw size={16} aria-hidden="true" /> Add another</button><Link href="/products">Browse products</Link></div>
  </section>;

  const kindValue = hasKind ? [selection(draft.kind, kindOptions.find(option => option.id === draft.kind)?.label ?? draft.kind)] : [];
  const outcomeValue = draft.outcome ? [selection(draft.outcome, outcomeOptions.find(option => option.id === draft.outcome)?.label ?? draft.outcome)] : [];
  const progress = flow.length > 1 ? Math.round((stepIndex / (flow.length - 1)) * 100) : 0;
  const interaction = (mode: 'tap' | 'search' | 'type' | 'custom', count: number) => recordEvent('selection_changed', mode, count);

  return <section className={styles.experience} aria-labelledby="contribution-question">
    <div className={styles.progress} aria-label={`${progress}% complete`}><span style={{ width: `${progress}%` }} /></div>
    <div className={styles.saveStatus} role="status" aria-live="polite">
      {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Not saved. We’ll retry.' : 'Saved on this device'}
    </div>

    <div className={styles.question} key={currentStep}>
      {currentStep === 'kind' ? <AdaptiveSelector label="What are you adding?" mode="single" value={kindValue} suggestions={kindOptions} allowCustom={false} onChange={chooseKind} onInteraction={interaction}/> : null}
      {currentStep === 'purposes' ? <AdaptiveSelector label="What is it for?" hint="Choose every answer that fits." mode="multiple" value={draft.purposes} suggestions={purposes} onChange={values => patchDraft({ purposes: values })} onInteraction={interaction}/> : null}
      {currentStep === 'products' ? <AdaptiveSelector label={draft.kind === 'routine' ? 'What is in your routine?' : 'Which product?'} hint={draft.kind === 'routine' ? 'Add one or more.' : undefined} mode={draft.kind === 'routine' ? 'multiple' : 'single'} value={draft.products} suggestions={products} onChange={chooseProducts} onInteraction={interaction}/> : null}
      {currentStep === 'brand' ? <AdaptiveSelector label="Who makes it?" mode="single" value={draft.brands} suggestions={brands} onChange={values => patchDraft({ brands: values })} onInteraction={interaction}/> : null}
      {currentStep === 'retailer' ? <AdaptiveSelector label={draft.kind === 'store' ? 'Which store do you trust?' : 'Where did you buy it?'} mode="single" value={draft.retailers} suggestions={retailers} onChange={values => patchDraft({ retailers: values })} onInteraction={interaction}/> : null}
      {currentStep === 'purchase' ? <div className={styles.purchase}>
        <div><p>Optional</p><h2 id="contribution-question">What did you pay?</h2></div>
        <label><span>Price</span><span className={styles.money}><b>₦</b><input inputMode="numeric" type="number" min="100" max="10000000" value={draft.priceNgn ?? ''} onChange={event => patchDraft({ priceNgn: event.target.value ? Number(event.target.value) : null })} placeholder="17,500" /></span></label>
        <label><span>Purchase date</span><input type="date" max={new Date().toISOString().slice(0, 10)} value={draft.purchaseDate ?? ''} onChange={event => patchDraft({ purchaseDate: event.target.value || null })}/></label>
      </div> : null}
      {currentStep === 'outcome' ? <AdaptiveSelector label="How was it?" hint="Your experience, not a medical claim." mode="single" value={outcomeValue} suggestions={outcomeOptions} allowCustom={false} onChange={values => patchDraft({ outcome: (values[0]?.id as ContributionDraft['outcome']) ?? null })} onInteraction={interaction}/> : null}
      {currentStep === 'review' ? <div className={styles.review}>
        <div><p>Ready</p><h2 id="contribution-question">Share what you know.</h2><span>Anonymous. Simple. Useful.</span></div>
        <dl>
          <div><dt>Adding</dt><dd>{kindOptions.find(option => option.id === draft.kind)?.label}</dd></div>
          <div><dt>For</dt><dd>{joined(draft.purposes)}</dd></div>
          {draft.products.length ? <div><dt>{draft.kind === 'routine' ? 'Routine' : 'Product'}</dt><dd>{joined(draft.products)}</dd></div> : null}
          {draft.retailers.length ? <div><dt>Store</dt><dd>{joined(draft.retailers)}</dd></div> : null}
          {draft.priceNgn ? <div><dt>Paid</dt><dd>₦{draft.priceNgn.toLocaleString('en-NG')}</dd></div> : null}
        </dl>
      </div> : null}
    </div>

    {error ? <p className={styles.error} role="alert">{error}</p> : null}

    <div className={styles.actions}>
      {stepIndex > 0 ? <button type="button" className={styles.back} onClick={previousStep}><ArrowLeft size={16} aria-hidden="true" /> Back</button> : <span />}
      {currentStep === 'review'
        ? <button type="button" className={styles.primary} onClick={submit} disabled={submitting}>{submitting ? 'Sharing…' : 'Share with JeloCare'} <ArrowRight size={16} aria-hidden="true" /></button>
        : <button type="button" className={styles.primary} onClick={nextStep} disabled={!canContinue()}>Continue <ArrowRight size={16} aria-hidden="true" /></button>}
    </div>
  </section>;
}
