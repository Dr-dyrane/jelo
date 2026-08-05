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
      {/* 1. Personal greeting */}
      <section className={styles.feedGreeting} aria-label="Greeting">
        <p className={styles.eyebrow}>{ME_PORTAL_SURFACES.home.eyebrow}</p>
        <h1 className={styles.feedGreetingName}>{greeting}.</h1>
      </section>

      {/* 2. One Ask/search entry */}
      <section className={styles.feedAskEntry} aria-label="Ask Me">
        <Link className={styles.feedAskLink} href={askEntry.href}>
          <MessageCircleQuestion size={22} strokeWidth={1.5} aria-hidden="true" />
          <span>
            <small>{askEntry.label}</small>
            <strong>What should I understand or do for my care now?</strong>
          </span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>

      {/* 3. Continue your Routine — only when real */}
      {routineSection.visible ? (
        <section className={`${styles.fullSection} ${styles.routineSurface}`} aria-labelledby="me-routine-preview-title">
          <div className={styles.fullSectionHeading}>
            <div>
              <p className={styles.eyebrow}>{routineSection.provenance ?? 'Continue your Routine'}</p>
              <h2 id="me-routine-preview-title">My steps.</h2>
            </div>
            <Link className={styles.fullSectionLink} href={'/me/routine'}>Open Routine <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          <ol className={styles.routineGrid}>
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
                    className={styles.routineRailCard}
                    aria-label={`View ${step.product.name}`}
                  >
                    <span className={styles.routineRailCardImage}>
                      <SafeProductImage src={step.product.image} alt={`${step.product.brand} ${step.product.name}`} />
                    </span>
                    <span className={styles.routineRailCardNumber}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <StatusIcon size={16} aria-hidden="true" />
                      <span className={styles.visuallyHidden}>{statusLabel}</span>
                    </span>
                    <span className={styles.routineRailCardCopy}>
                      <small>{step.moment}</small>
                      <strong>{step.product.brand} {step.product.name}</strong>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {/* 4. Recently saved products — only when real */}
      {shelfSection.visible ? (
        <section className={styles.fullSection} aria-labelledby="me-shelf-preview-title">
          <div className={styles.fullSectionHeading}>
            <div>
              <p className={styles.eyebrow}>Saved products</p>
              <h2 id="me-shelf-preview-title">My Shelf.</h2>
            </div>
            <Link className={styles.fullSectionLink} href={'/me/shelf'}>Open Shelf <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          {shelfSection.state.status === 'unavailable' ? (
            <div className={styles.emptyAction} role="status">
              <ShelvingUnit size={24} strokeWidth={1.5} aria-hidden="true" />
              <p>{shelfSection.state.message}</p>
              <Link href="/me">Try again</Link>
            </div>
          ) : (
            <div className="product-rail">
              {shelfSection.items.map((item) => item.product ? (
                <ProductCard
                  key={item.identityVersionId}
                  product={item.product}
                  href={memberProductHref(item.product, 'shelf')}
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
          )}
        </section>
      ) : null}

      {/* 5. Fresh price evidence — only when eligible */}
      {priceEvidenceSection.visible ? (
        <section className={styles.fullSection} aria-labelledby="me-price-evidence-title">
          <div className={styles.fullSectionHeading}>
            <div>
              <p className={styles.eyebrow}>Fresh prices</p>
              <h2 id="me-price-evidence-title">Current market.</h2>
            </div>
          </div>
          <ul className={styles.priceEvidenceList}>
            {priceEvidenceSection.items
              .filter(item => item.freshness === 'fresh')
              .map((item) => (
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
                      <span className={styles.priceEvidenceStores}>
                        {item.retailerCount} store{item.retailerCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {/* 6. Needs attention — only when authoritative state requires it */}
      {attentionSection.visible ? (
        <section className={styles.fullSection} aria-labelledby="me-attention-title">
          <div className={styles.fullSectionHeading}>
            <div>
              <p className={styles.eyebrow}>Needs attention</p>
              <h2 id="me-attention-title">Review these.</h2>
            </div>
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
          <Compass size={20} strokeWidth={1.5} aria-hidden="true" />
          <span>{exploreEntry.label}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </>
  );
}
