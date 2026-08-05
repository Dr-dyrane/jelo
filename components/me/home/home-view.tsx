'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ClockAlert,
  ClockPlus,
  Compass,
  MessageCircleQuestion,
  AlertCircle,
  Tag,
  ShelvingUnit,
} from 'lucide-react';
import type { ShelfActionHandler } from '@/components/me/shelf/me-shelf-state';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { ProductCard } from '@/components/products/product-card';
import type { CustomerHomeReadModel } from '@/lib/customer/route-read-models';
import { ME_PORTAL_SURFACES } from '@/components/me/shell/me-shell-model';
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import { memberProductHref, UnavailableShelfCard } from './shared-views';
import styles from './me-home.module.css';

export function HomeView({
  homeModel,
  shelfAction,
  onShelfMutation,
}: {
  homeModel: CustomerHomeReadModel;
  shelfAction?: ShelfActionHandler;
  onShelfMutation: (result: CustomerShelfActionResult) => void;
}) {
  const { greeting, askEntry, routineSection, shelfSection, priceEvidenceSection, attentionSection, exploreEntry } = homeModel;

  return (
    <>
      {/* 1. Personal greeting — application scale, no editorial eyebrow */}
      <section className={styles.feedGreeting} aria-label={ME_PORTAL_SURFACES.home.title ?? 'Home'}>
        <h1 className={styles.feedGreetingName}>{greeting}</h1>
      </section>

      {/* 2. One Ask/search entry — compact, capped width */}
      <section className={styles.feedAskEntry} aria-label="Ask Me">
        <Link className={styles.feedAskLink} href={askEntry.href}>
          <MessageCircleQuestion size={20} strokeWidth={1.5} aria-hidden="true" />
          <span>
            <small>{askEntry.label}</small>
            <strong>What should I do for my care now?</strong>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      {/* 3. Continue your Routine — compact preview of next 3–4 steps */}
      {routineSection.state.status === 'unavailable' ? (
        <section className={styles.feedSection} role="status" aria-label="Routine unavailable">
          <div className={styles.feedUnavailable}>
            <ClockPlus size={20} strokeWidth={1.5} aria-hidden="true" />
            <p>{routineSection.state.message}</p>
            <Link href="/me/routine">Try again</Link>
          </div>
        </section>
      ) : routineSection.visible ? (
        <section className={styles.feedSection} aria-labelledby="me-routine-preview-title" data-provenance={routineSection.provenance ?? undefined}>
          <div className={styles.feedSectionHeading}>
            <h2 id="me-routine-preview-title">Continue your routine</h2>
            <Link className={styles.feedSectionLink} href={'/me/routine'}>Open routine <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <ol className={styles.routinePreviewList}>
            {routineSection.steps.map((step, index) => {
              const StatusIcon = step.status === 'alert' ? ClockAlert : ClockPlus;
              const statusLabel = step.status === 'alert'
                ? 'Routine alert'
                : step.status === 'done'
                  ? 'Routine done'
                  : 'Routine step confirmed';
              return (
                <li key={step.id}>
                  <Link
                    href={memberProductHref(step.product, 'routine')}
                    className={styles.routinePreviewRow}
                    aria-label={`View ${step.product.name}`}
                  >
                    <span className={styles.routinePreviewImage}>
                      <SafeProductImage src={step.product.image} alt={`${step.product.brand} ${step.product.name}`} />
                    </span>
                    <span className={styles.routinePreviewCopy}>
                      <small>{step.moment}</small>
                      <strong>{step.product.brand} {step.product.name}</strong>
                    </span>
                    <span className={styles.routinePreviewIndex}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <StatusIcon size={14} aria-hidden="true" />
                      <span className={styles.visuallyHidden}>{statusLabel}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {/* 4. Recently saved products — brought closer to first viewport */}
      {shelfSection.state.status === 'unavailable' ? (
        <section className={styles.feedSection} role="status" aria-label="Shelf unavailable">
          <div className={styles.feedUnavailable}>
            <ShelvingUnit size={20} strokeWidth={1.5} aria-hidden="true" />
            <p>{shelfSection.state.message}</p>
            <Link href="/me">Try again</Link>
          </div>
        </section>
      ) : shelfSection.visible ? (
        <section className={styles.feedSection} aria-labelledby="me-shelf-preview-title">
          <div className={styles.feedSectionHeading}>
            <h2 id="me-shelf-preview-title">Recently saved</h2>
            <Link className={styles.feedSectionLink} href={'/me/shelf'}>Open shelf <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
          <div className="product-rail feedShelfRail">
            {shelfSection.items.map((item) => item.product ? (
              <ProductCard
                key={item.identityVersionId}
                product={item.product}
                href={memberProductHref(item.product, 'shelf')}
                density="compact"
              />
            ) : (
              <UnavailableShelfCard
                key={item.identityVersionId}
                item={item}
                shelfAction={shelfAction}
                onSettled={onShelfMutation}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* 5. Fresh price evidence — only eligible items from the model */}
      {priceEvidenceSection.visible ? (
        <section className={styles.feedSection} aria-labelledby="me-price-evidence-title">
          <div className={styles.feedSectionHeading}>
            <h2 id="me-price-evidence-title">Fresh prices</h2>
          </div>
          <ul className={styles.priceEvidenceList}>
            {priceEvidenceSection.items.map((item) => (
              <li key={item.product.slug} className={styles.priceEvidenceItem}>
                <Link href={memberProductHref(item.product, 'home')} className={styles.priceEvidenceLink}>
                  <span className={styles.priceEvidenceImage}>
                    <SafeProductImage src={item.product.image} alt={`${item.product.brand} ${item.product.name}`} />
                  </span>
                  <span className={styles.priceEvidenceCopy}>
                    <small>{item.product.brand}</small>
                    <strong>{item.product.name}</strong>
                    <span className={styles.priceEvidencePrice}>
                      <Tag size={14} aria-hidden="true" /> {item.priceLabel}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 6. Needs attention — only model-derived attention states */}
      {attentionSection.visible ? (
        <section className={styles.feedSection} aria-labelledby="me-attention-title">
          <div className={styles.feedSectionHeading}>
            <h2 id="me-attention-title">Needs attention</h2>
          </div>
          <ul className={styles.attentionList}>
            {attentionSection.items.map((item, index) => (
              <li key={`${item.kind}-${index}`} className={styles.attentionItem}>
                <Link href={item.href} className={styles.attentionLink}>
                  <AlertCircle size={18} strokeWidth={1.5} aria-hidden="true" />
                  <span>{item.label}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 7. Explore continuation — quiet link */}
      <section className={styles.feedExploreEntry} aria-label="Explore">
        <Link className={styles.feedExploreLink} href={exploreEntry.href}>
          <Compass size={18} strokeWidth={1.5} aria-hidden="true" />
          <span>{exploreEntry.label}</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
