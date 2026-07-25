import { getPostgresClient } from '@/lib/db/postgres';
import { listPendingEdges } from '@/lib/moderation/queues';
import { requireConsoleOperator } from '@/lib/moderation/console-access';
import { can } from '@/lib/moderation/capabilities';
import { EmptyState } from '@/components/ops/state/EmptyState';
import { findCatalogueProduct } from '@/lib/catalogue/repository';
import { listProductIngredientsSafe } from '@/lib/clinical/ingredients';
import { EdgesInbox } from './EdgesInbox';
import opsStyles from '../../ops.module.css';
import styles from '@/components/ops/inbox/inbox.module.css';

export const dynamic = 'force-dynamic';

const LIMIT = 100;

export default async function EdgesQueue() {
  const operator = await requireConsoleOperator();
  const canDecide = can(operator.role, 'edges.decide');
  const rows = await listPendingEdges(getPostgresClient(), LIMIT);

  const enrichedRows = await Promise.all(rows.map(async row => {
    let subjectProduct;
    let objectProduct;
    const warnings: string[] = [];

    if (row.subjectKind === 'product' || row.subjectRef.startsWith('product:')) {
      const slug = row.subjectRef.startsWith('product:') ? row.subjectRef.slice(8) : row.subjectRef;
      subjectProduct = await findCatalogueProduct(slug);

      if (subjectProduct) {
        // Query active ingredients to verify clinical safety restrictions (ADR 0006)
        const ingredients = await listProductIngredientsSafe(subjectProduct.slug);
        
        const avoidInPregnancy = ingredients.some(i => i.pregnancyStatus === 'avoid');
        if (avoidInPregnancy) {
          warnings.push('Contains ingredients to avoid during pregnancy (e.g. retinoids).');
        }

        const sensitiveCaution = ingredients.some(i => i.sensitiveSkinStatus === 'avoid' || i.sensitiveSkinStatus === 'use_with_caution');
        if (sensitiveCaution) {
          warnings.push('Contains ingredients posing sensitive skin irritation risk.');
        }

        const needsSunProtection = ingredients.some(i => i.requiresSunProtection);
        if (needsSunProtection) {
          warnings.push('Contains sun-sensitizing actives requiring daytime SPF.');
        }
      }
    }

    if (row.objectKind === 'product' || row.objectRef.startsWith('product:')) {
      const slug = row.objectRef.startsWith('product:') ? row.objectRef.slice(8) : row.objectRef;
      objectProduct = await findCatalogueProduct(slug);
    }

    return { ...row, subjectProduct, objectProduct, warnings };
  }));

  return (
    <>
      <h1 className={opsStyles.h1}>Knowledge edges</h1>
      <p className={opsStyles.lede}>Typed triples derived from contributions, pending review. Community-reported until an operator approves.</p>

      {enrichedRows.length === 0 ? (
        <EmptyState
          title="No pending edges"
          body="Triples connecting products, ingredients, concerns, or brands will appear here."
        />
      ) : (
        <>
          <EdgesInbox rows={enrichedRows} canDecide={canDecide} />
          {enrichedRows.length === LIMIT ? (
            <p className={styles.partial}>Showing the {LIMIT} most recent — more may be pending.</p>
          ) : null}
        </>
      )}
    </>
  );
}
