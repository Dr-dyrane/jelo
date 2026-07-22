import postgres from 'postgres';

async function main() {
const connectionString = process.env.DATABASE_URL_UNPOOLED
  ?? process.env.POSTGRES_URL_NON_POOLING
  ?? process.env.DATABASE_URL
  ?? process.env.POSTGRES_URL;

if (!connectionString) throw new Error('A Neon connection string is required to audit ingredient knowledge.');

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  const [summary] = await sql<{
    ingredients: number;
    published_products: number;
    linked_products: number;
    products_without_verified_ingredients: number;
    active_links: number;
    unreviewed_ingredients: number;
    unknown_pregnancy_status: number;
    missing_evidence: number;
    unverified_product_links: number;
  }[]>`
    select
      (select count(*)::int from ingredients) as ingredients,
      (select count(*)::int from products where is_published) as published_products,
      (select count(distinct product_id)::int from product_ingredients) as linked_products,
      (
        select count(*)::int
        from products p
        where p.is_published
          and not exists (
            select 1 from product_ingredients pi
            where pi.product_id = p.id and pi.verified_at is not null
          )
      ) as products_without_verified_ingredients,
      (select count(*)::int from product_ingredients where is_active) as active_links,
      (select count(*)::int from ingredients where not pharmacist_reviewed) as unreviewed_ingredients,
      (select count(*)::int from ingredients where pregnancy_status = 'unknown') as unknown_pregnancy_status,
      (select count(*)::int from ingredients where evidence_grade = 'insufficient') as missing_evidence,
      (select count(*)::int from product_ingredients where verified_at is null) as unverified_product_links
  `;

  const unsafeRelations = await sql<{
    ingredient: string;
    related_ingredient: string;
    relation_type: string;
    evidence_grade: string;
    pharmacist_reviewed: boolean;
  }[]>`
    select
      coalesce(source.common_name, source.inci_name) as ingredient,
      coalesce(target.common_name, target.inci_name) as related_ingredient,
      relation.relation_type,
      relation.evidence_grade,
      relation.pharmacist_reviewed
    from ingredient_relations relation
    join ingredients source on source.id = relation.ingredient_id
    join ingredients target on target.id = relation.related_ingredient_id
    where relation.relation_type in ('irritation_risk', 'avoid_together')
      and (
        relation.evidence_grade = 'insufficient'
        or not relation.pharmacist_reviewed
      )
    order by source.inci_name, target.inci_name
  `;

  console.log(JSON.stringify({ summary, unsafeRelations }, null, 2));

  if (unsafeRelations.length > 0 || summary.unverified_product_links > 0) {
    process.exitCode = 1;
  }
} finally {
  await sql.end();
}
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
