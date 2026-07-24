'use client';

import { ArrowLeft, ArrowRight, Check, Mail, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AdaptiveSelector, type AdaptiveOption } from '@/components/ui/adaptive-selector';
import type { AdaptiveValue } from '@/lib/community-intake/schema';
import {
  emptyRetailerPartnershipDraft,
  retailerPartnershipDraftSchema,
  type RetailerPartnershipDraft,
} from '@/lib/retailer-partnership/schema';
import styles from '@/app/(site)/retailers/retailers.module.css';

type FlowStep = 'store' | 'channels' | 'location' | 'contact' | 'online' | 'brands' | 'services' | 'review';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type MailState = 'idle' | 'sending' | 'sent' | 'failed' | 'unavailable';

const flow: FlowStep[] = ['store', 'channels', 'location', 'contact', 'online', 'brands', 'services', 'review'];
const localKey = 'jelocare-retailer-partnership-v1';

const channelOptions: AdaptiveOption[] = [
  { id: 'channel:physical-store', label: 'Physical store', detail: 'Customers can walk in' },
  { id: 'channel:website', label: 'Website', detail: 'Customers can order online' },
  { id: 'channel:instagram', label: 'Instagram', detail: 'Orders begin in DMs' },
  { id: 'channel:whatsapp', label: 'WhatsApp', detail: 'Orders begin in chat' },
  { id: 'channel:facebook', label: 'Facebook', detail: 'Orders begin on your business page' },
  { id: 'channel:marketplace', label: 'Marketplace', detail: 'You sell through another platform' },
];

const serviceOptions: AdaptiveOption[] = [
  { id: 'service:walk-in', label: 'Walk in' },
  { id: 'service:pickup', label: 'Pickup' },
  { id: 'service:lagos-delivery', label: 'Lagos delivery' },
  { id: 'service:nationwide-delivery', label: 'Nationwide delivery' },
  { id: 'service:same-day', label: 'Same-day delivery' },
  { id: 'service:wholesale', label: 'Wholesale' },
];

const nigeriaStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
].map(label => ({
  id: `state:${label.toLocaleLowerCase('en-NG').replaceAll(' ', '-')}`,
  label,
}));

function joined(values: AdaptiveValue[]) {
  return values.map(value => value.label).join(', ');
}

function normalizeWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function RetailerPartnershipExperience({ brands }: { brands: AdaptiveOption[] }) {
  const [draft, setDraft] = useState<RetailerPartnershipDraft>(() => emptyRetailerPartnershipDraft());
  const [stepIndex, setStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [complete, setComplete] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [mailState, setMailState] = useState<MailState>('idle');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const applicationIdRef = useRef<string | null>(null);
  const revisionRef = useRef(0);
  const submitKeyRef = useRef(crypto.randomUUID());
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const currentStep = flow[stepIndex] ?? 'store';

  const persistLocal = useCallback((snapshot: RetailerPartnershipDraft) => {
    if (!applicationIdRef.current) return;
    window.localStorage.setItem(localKey, JSON.stringify({
      applicationId: applicationIdRef.current,
      revision: revisionRef.current,
      draft: snapshot,
      submitKey: submitKeyRef.current,
      mailState,
    }));
  }, [mailState]);

  const restoreRemote = useCallback(async (applicationId: string) => {
    const response = await fetch(`/api/retailers/applications/${applicationId}`);
    if (!response.ok) return false;
    const data = await response.json() as {
      applicationId: string;
      revision: number;
      status: string;
      draft: unknown;
    };
    const parsed = retailerPartnershipDraftSchema.safeParse(data.draft);
    if (!parsed.success) return false;
    applicationIdRef.current = data.applicationId;
    setApplicationId(data.applicationId);
    revisionRef.current = data.revision;
    setDraft(parsed.data);
    setStepIndex(Math.max(0, Math.min(parsed.data.currentStep - 1, flow.length - 1)));
    setComplete(data.status === 'submitted');
    setSaveState('saved');
    setMailState('sent');
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const params = new URLSearchParams(window.location.search);
      const linkedApplication = params.get('application');
      if (linkedApplication && await restoreRemote(linkedApplication)) {
        if (!cancelled) setHydrated(true);
        return;
      }
      try {
        const local = JSON.parse(window.localStorage.getItem(localKey) ?? 'null') as {
          applicationId?: string;
          revision?: number;
          draft?: unknown;
          submitKey?: string;
          mailState?: MailState;
        } | null;
        if (local?.applicationId && await restoreRemote(local.applicationId)) {
          if (local.submitKey) submitKeyRef.current = local.submitKey;
          if (local.mailState) setMailState(local.mailState);
        }
      } catch {
        window.localStorage.removeItem(localKey);
      }
      if (!cancelled) setHydrated(true);
    }
    void restore();
    return () => { cancelled = true; };
  }, [restoreRemote]);

  const saveSnapshot = useCallback(async (snapshot: RetailerPartnershipDraft) => {
    const applicationId = applicationIdRef.current;
    if (!applicationId) return;
    setSaveState('saving');
    async function requestSave(revision: number) {
      return fetch(`/api/retailers/applications/${applicationId}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision, draft: snapshot, websiteField: '' }),
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
        setSaveState('error');
        return;
      }
      const data = await response.json() as { revision: number };
      revisionRef.current = data.revision;
      persistLocal(snapshot);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [persistLocal]);

  useEffect(() => {
    if (!hydrated || !applicationIdRef.current || complete) return;
    const parsed = retailerPartnershipDraftSchema.safeParse(draft);
    if (!parsed.success) return;
    persistLocal(parsed.data);
    const timer = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current.then(() => saveSnapshot(parsed.data));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [complete, draft, hydrated, persistLocal, saveSnapshot]);

  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = window.setTimeout(() => {
      setSaveState(current => current === 'saved' ? 'idle' : current);
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  function patchDraft(patch: Partial<RetailerPartnershipDraft>) {
    setDraft(current => ({ ...current, ...patch, currentStep: Math.min(stepIndex + 1, 8) }));
    setError('');
  }

  function canContinue() {
    if (currentStep === 'store') return draft.storeName.trim().length >= 2;
    if (currentStep === 'channels') return draft.channels.length > 0;
    if (currentStep === 'location') return draft.state.length === 1 && draft.city.trim().length >= 2;
    if (currentStep === 'contact') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email) && draft.contactConsent;
    }
    return true;
  }

  async function createApplication(snapshot: RetailerPartnershipDraft) {
    setBusy(true);
    setMailState('sending');
    setError('');
    try {
      const response = await fetch('/api/retailers/applications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...snapshot, websiteField: '' }),
      });
      const data = await response.json().catch(() => null) as {
        applicationId?: string;
        revision?: number;
        emailDelivery?: 'sent' | 'failed' | 'unavailable';
        error?: string;
      } | null;
      if (!response.ok || !data?.applicationId) {
        setMailState('idle');
        setError(data?.error ?? 'Could not save your store yet.');
        return false;
      }
      applicationIdRef.current = data.applicationId;
      setApplicationId(data.applicationId);
      revisionRef.current = data.revision ?? 0;
      const delivery = data.emailDelivery ?? 'unavailable';
      setMailState(delivery);
      setSaveState('saved');
      persistLocal(snapshot);
      return true;
    } catch {
      setMailState('idle');
      setError('Could not save your store yet.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function nextStep() {
    if (!canContinue()) return;
    const next = Math.min(stepIndex + 1, flow.length - 1);
    const snapshot = { ...draft, currentStep: next + 1 };
    if (currentStep === 'contact' && !applicationIdRef.current) {
      const parsed = retailerPartnershipDraftSchema.safeParse(snapshot);
      if (!parsed.success) {
        setError('Check your contact details.');
        return;
      }
      if (!await createApplication(parsed.data)) return;
    }
    setDraft(snapshot);
    setStepIndex(next);
    setError('');
  }

  function previousStep() {
    const next = Math.max(0, stepIndex - 1);
    setStepIndex(next);
    setDraft(current => ({ ...current, currentStep: next + 1 }));
    setError('');
  }

  async function resendLink() {
    const applicationId = applicationIdRef.current;
    if (!applicationId) return;
    setMailState('sending');
    setError('');
    const response = await fetch(`/api/retailers/applications/${applicationId}/send-link`, { method: 'POST' });
    if (response.ok) {
      setMailState('sent');
      return;
    }
    const data = await response.json().catch(() => null) as { error?: string } | null;
    setMailState('failed');
    setError(data?.error ?? 'Could not send the private link yet.');
  }

  async function submit() {
    const applicationId = applicationIdRef.current;
    const finalDraft = retailerPartnershipDraftSchema.safeParse({ ...draft, currentStep: 8 });
    if (!applicationId || !finalDraft.success) {
      setError('A few details are still missing.');
      return;
    }
    setBusy(true);
    setError('');
    await saveQueueRef.current;
    try {
      const response = await fetch(`/api/retailers/applications/${applicationId}/submit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': submitKeyRef.current,
        },
        body: JSON.stringify({ draft: finalDraft.data }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setError(data?.error ?? 'Could not share your store yet.');
        return;
      }
      window.localStorage.removeItem(localKey);
      setComplete(true);
    } catch {
      setError('Could not share your store yet. Your draft is still saved.');
    } finally {
      setBusy(false);
    }
  }

  function startAnother() {
    setDraft(emptyRetailerPartnershipDraft());
    setStepIndex(0);
    setComplete(false);
    setSaveState('idle');
    setMailState('idle');
    setError('');
    applicationIdRef.current = null;
    setApplicationId(null);
    revisionRef.current = 0;
    submitKeyRef.current = crypto.randomUUID();
    window.localStorage.removeItem(localKey);
  }

  if (!hydrated) return <div className={styles.partnershipLoading}>Loading…</div>;

  if (complete) return <div className={styles.partnershipComplete}>
    <span><Check size={28} aria-hidden="true" /></span>
    <p>Store shared</p>
    <h3>Thank you.</h3>
    <p>We’ll take it from here.</p>
    <button type="button" onClick={startAnother}><RotateCcw size={16} aria-hidden="true" /> Add another store</button>
  </div>;

  const progress = Math.round((stepIndex / (flow.length - 1)) * 100);

  return <div className={styles.partnershipExperience}>
    <div className={styles.partnershipProgressRow}>
      <div className={styles.partnershipProgress} aria-label={`${progress}% complete`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      {saveState === 'saved' ? <span className={styles.partnershipSaveStatus} role="status" aria-live="polite">
        <Check size={16} aria-hidden="true" />
        <span className="sr-only">Saved</span>
      </span> : null}
      {saveState === 'error' ? <span className={`${styles.partnershipSaveStatus} ${styles.partnershipSaveError}`} role="status" aria-live="polite">Retrying…</span> : null}
    </div>

    <div className={styles.partnershipQuestion} key={currentStep}>
      {currentStep === 'store' ? <div className={styles.textQuestion}>
        <p>Start here</p>
        <h3 id="retailer-partnership-question">What is your store called?</h3>
        <label><span>Store name</span><input autoFocus value={draft.storeName} maxLength={120} onChange={event => patchDraft({ storeName: event.target.value })} placeholder="Your store" /></label>
      </div> : null}

      {currentStep === 'channels' ? <AdaptiveSelector
        label="How do customers buy from you?"
        hint="Choose every answer that fits."
        selectionLabel="Ways to buy"
        mode="multiple"
        value={draft.channels}
        suggestions={channelOptions}
        allowCustom={false}
        onChange={values => patchDraft({ channels: values })}
      /> : null}

      {currentStep === 'location' ? <div className={styles.locationQuestion}>
        <AdaptiveSelector
          label="Where can customers find you?"
          hint="Your main location."
          selectionLabel="Location added"
          mode="single"
          value={draft.state}
          suggestions={nigeriaStates}
          allowCustom={false}
          onChange={values => patchDraft({ state: values })}
        />
        <div className={styles.inlineFields}>
          <label><span>City</span><input value={draft.city} maxLength={120} onChange={event => patchDraft({ city: event.target.value })} placeholder="Ikeja" /></label>
          <label><span>Address <small>Optional</small></span><input value={draft.address ?? ''} maxLength={240} onChange={event => patchDraft({ address: event.target.value || null })} placeholder="Store address" /></label>
        </div>
      </div> : null}

      {currentStep === 'contact' ? <div className={styles.textQuestion}>
        <p>Keep your place</p>
        <h3 id="retailer-partnership-question">Where should we send your private link?</h3>
        <div className={styles.inlineFields}>
          <label><span>Email</span><input type="email" autoComplete="email" disabled={Boolean(applicationId)} value={draft.email} maxLength={254} onChange={event => patchDraft({ email: event.target.value })} placeholder="you@yourstore.com" /></label>
          <label><span>WhatsApp <small>Optional</small></span><input type="tel" autoComplete="tel" value={draft.whatsapp ?? ''} maxLength={40} onChange={event => patchDraft({ whatsapp: event.target.value || null })} placeholder="+234…" /></label>
        </div>
        <label className={styles.consent}>
          <input type="checkbox" checked={draft.contactConsent} onChange={event => patchDraft({ contactConsent: event.target.checked })} />
          <span>JeloCare may contact me about this store.</span>
        </label>
        {applicationId ? <div className={styles.mailNote}>
          <Mail size={17} aria-hidden="true" />
          <span>{mailState === 'sent' ? `Private link sent to ${draft.email}` : 'Your store is saved.'}</span>
          {mailState === 'failed' || mailState === 'unavailable'
            ? <button type="button" onClick={resendLink}>Send link</button>
            : null}
        </div> : null}
      </div> : null}

      {currentStep === 'online' ? <div className={styles.textQuestion}>
        <p>Optional</p>
        <h3 id="retailer-partnership-question">Where can people see your store?</h3>
        <div className={styles.inlineFields}>
          <label><span>Website</span><input type="url" value={draft.website ?? ''} maxLength={240} onChange={event => patchDraft({ website: event.target.value || null })} onBlur={event => patchDraft({ website: normalizeWebsite(event.target.value) })} placeholder="yourstore.com" /></label>
          <label><span>Instagram</span><input value={draft.instagram ?? ''} maxLength={120} onChange={event => patchDraft({ instagram: event.target.value || null })} placeholder="@yourstore" /></label>
          <label><span>Facebook</span><input value={draft.facebook ?? ''} maxLength={240} onChange={event => patchDraft({ facebook: event.target.value || null })} placeholder="Page name or link" /></label>
        </div>
        {mailState === 'sent' ? <p className={styles.linkSent}><Mail size={16} aria-hidden="true" /> Your private link is in your inbox.</p> : null}
      </div> : null}

      {currentStep === 'brands' ? <AdaptiveSelector
        label="Which brands do you carry?"
        hint="Add a few now. You can expand this later."
        selectionLabel="Brands added"
        mode="multiple"
        value={draft.brands}
        suggestions={brands}
        onChange={values => patchDraft({ brands: values })}
      /> : null}

      {currentStep === 'services' ? <div className={styles.locationQuestion}>
        <AdaptiveSelector
          label="How do you serve customers?"
          hint="Choose every answer that fits."
          selectionLabel="Services added"
          mode="multiple"
          value={draft.services}
          suggestions={serviceOptions}
          allowCustom={false}
          onChange={values => patchDraft({ services: values })}
        />
        <div className={styles.inlineFields}>
          <label><span>One product <small>Optional</small></span><input value={draft.sampleProduct ?? ''} maxLength={240} onChange={event => patchDraft({ sampleProduct: event.target.value || null })} placeholder="Product name and size" /></label>
          <label><span>Current price <small>Optional</small></span><span className={styles.partnershipMoney}><b>₦</b><input inputMode="numeric" type="number" min="100" max="100000000" value={draft.samplePriceNgn ?? ''} onChange={event => patchDraft({ samplePriceNgn: event.target.value ? Number(event.target.value) : null })} placeholder="17,500" /></span></label>
        </div>
      </div> : null}

      {currentStep === 'review' ? <div className={styles.partnershipReview}>
        <p>Ready</p>
        <h3 id="retailer-partnership-question">Share your store?</h3>
        <dl>
          <div><dt>Store</dt><dd>{draft.storeName}</dd></div>
          <div><dt>Where</dt><dd>{draft.city}, {joined(draft.state)}</dd></div>
          <div><dt>Sales</dt><dd>{joined(draft.channels)}</dd></div>
          {draft.brands.length ? <div><dt>Brands</dt><dd>{joined(draft.brands)}</dd></div> : null}
          {draft.website ? <div><dt>Website</dt><dd>{draft.website}</dd></div> : null}
          {draft.instagram ? <div><dt>Instagram</dt><dd>{draft.instagram}</dd></div> : null}
          {draft.facebook ? <div><dt>Facebook</dt><dd>{draft.facebook}</dd></div> : null}
        </dl>
      </div> : null}
    </div>

    {error ? <p className={styles.partnershipError} role="alert">{error}</p> : null}

    <div className={styles.partnershipActions}>
      {stepIndex > 0 ? <button type="button" className={styles.partnershipBack} onClick={previousStep}><ArrowLeft size={16} aria-hidden="true" /> Back</button> : <span />}
      {currentStep === 'review'
        ? <button type="button" className={styles.partnershipPrimary} onClick={submit} disabled={busy}>{busy ? 'Sharing…' : 'Share store'} <ArrowRight size={16} aria-hidden="true" /></button>
        : <button type="button" className={styles.partnershipPrimary} onClick={nextStep} disabled={!canContinue() || busy}>{currentStep === 'contact' && !applicationId ? (busy ? 'Sending…' : 'Send my private link') : 'Continue'} <ArrowRight size={16} aria-hidden="true" /></button>}
    </div>
  </div>;
}
