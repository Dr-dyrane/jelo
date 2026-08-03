import postgres from 'postgres';
import { externalCatalogueMetadata, externalProducts } from '../data/external-catalogue';
import { requireAdminDatabaseUrl } from './lib/admin-database';

function normalized(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function main() {
  // Fail before opening a production connection. The existing persistence
  // schema was built for the deprecated cutout release and cannot store the
  // new rights + final-image approval record safely.
  if (!externalProducts.length) {
    throw new Error('No external catalogue entries have deliberate public approval; private candidates were not seeded.');
  }
  throw new Error('External catalogue production seeding is paused until the approval-aware, final-image persistence schema is active.');

  const connectionString = requireAdminDatabaseUrl();

  const releaseSha256 = externalCatalogueMetadata.packshotReleaseSha256;
  const expected = new Map(externalProducts.map(product => [product.barcode, product]));
  const sql = postgres(connectionString, { max: 1, prepare: false });
  try {
    await sql.begin(async transaction => {
      await transaction`
        update external_catalogue_releases
        set status = 'superseded'
        where status = 'active'
          and release_sha256 <> ${releaseSha256}
      `;

      await transaction`
        update external_catalogue_products
        set is_published = false,
            import_status = 'superseded',
            updated_at = now()
        where source_catalogue = 'open-beauty-facts'
          and is_published = true
      `;

      await transaction`
        insert into external_catalogue_releases (
          release_sha256,
          selection_sha256,
          candidate_manifest_sha256,
          candidate_metadata_sha256,
          audit_manifest_sha256,
          source_snapshot_sha256,
          product_count,
          review_status,
          review_scope,
          reviewed_at,
          reviewer,
          status,
          activated_at
        ) values (
          ${releaseSha256},
          ${externalCatalogueMetadata.packshotSelectionSha256},
          ${externalCatalogueMetadata.packshotCandidateManifestSha256},
          ${externalCatalogueMetadata.packshotCandidateMetadataSha256},
          ${externalCatalogueMetadata.packshotAuditManifestSha256},
          ${externalCatalogueMetadata.sourceSnapshotSha256},
          ${externalProducts.length},
          ${externalCatalogueMetadata.packshotReviewStatus},
          ${externalCatalogueMetadata.packshotReviewScope},
          ${externalCatalogueMetadata.packshotReviewedAt},
          ${externalCatalogueMetadata.packshotReviewer},
          'active',
          now()
        )
        on conflict (release_sha256) do update set
          selection_sha256 = excluded.selection_sha256,
          candidate_manifest_sha256 = excluded.candidate_manifest_sha256,
          candidate_metadata_sha256 = excluded.candidate_metadata_sha256,
          audit_manifest_sha256 = excluded.audit_manifest_sha256,
          source_snapshot_sha256 = excluded.source_snapshot_sha256,
          product_count = excluded.product_count,
          review_status = excluded.review_status,
          review_scope = excluded.review_scope,
          reviewed_at = excluded.reviewed_at,
          reviewer = excluded.reviewer,
          status = 'active',
          activated_at = now()
      `;

      for (let offset = 0; offset < externalProducts.length; offset += 100) {
        const rows = externalProducts.slice(offset, offset + 100).map(product => ({
          source_catalogue: product.source,
          source_product_id: product.sourceProductId,
          barcode: product.barcode,
          brand: product.brand,
          name: product.name,
          quantity: product.quantity,
          category: product.category,
          source_categories: JSON.stringify(product.sourceCategories),
          countries: JSON.stringify(product.countries),
          search_text: normalized([product.barcode, product.brand, product.name, product.quantity, product.category, ...product.sourceCategories].join(' ')),
          source_url: product.sourceUrl,
          source_updated_at: product.sourceUpdatedAt,
          source_retrieved_at: product.sourceRetrievedAt,
          source_schema_version: product.sourceSchemaVersion,
          source_snapshot_sha256: product.sourceSnapshotSha256,
          raw_payload_sha256: product.rawPayloadSha256,
          ingredient_label_sha256: product.ingredientLabelSha256 ?? null,
          source_image_url: product.sourceImageUrl,
          ingredient_image_url: product.ingredientImageUrl ?? null,
          source_full_image_url: product.sourceFullImageUrl,
          canonical_image_url: product.canonicalImageUrl,
          source_image_sha256: product.sourceImageSha256,
          image_sha256: product.imageSha256,
          image_mime_type: product.imageMimeType,
          image_width: product.imageWidth,
          image_height: product.imageHeight,
          image_byte_size: product.imageByteSize,
          image_has_alpha: product.imageHasAlpha,
          image_treatment: product.imageTreatment,
          image_review_status: product.imageReviewStatus,
          image_review_scope: product.imageReviewScope,
          image_reviewed_at: product.imageReviewedAt,
          image_reviewer: product.imageReviewer,
          image_processing_model: product.imageProcessingModel,
          image_processing_version: product.imageProcessingVersion,
          image_processing_provider: product.imageProcessingProvider,
          candidate_sha256: product.candidateSha256,
          packshot_release_sha256: product.packshotReleaseSha256,
          image_license: product.imageLicense,
          image_attribution: product.imageAttribution,
          data_license: product.dataLicense,
          content_license: product.contentLicense,
          clinical_review_status: product.clinicalReviewStatus,
          source_photo_validated: product.sourcePhotoValidated,
          source_ingredients_complete: product.sourceIngredientsComplete,
          quality_score: product.qualityScore,
          import_status: 'published',
          quarantine_reason: null,
          is_published: true,
        }));

        await transaction`
          insert into external_catalogue_products ${transaction(rows)}
          on conflict (source_catalogue, source_product_id) do update set
            barcode = excluded.barcode,
            brand = excluded.brand,
            name = excluded.name,
            quantity = excluded.quantity,
            category = excluded.category,
            source_categories = excluded.source_categories,
            countries = excluded.countries,
            search_text = excluded.search_text,
            source_url = excluded.source_url,
            source_updated_at = excluded.source_updated_at,
            source_retrieved_at = excluded.source_retrieved_at,
            source_schema_version = excluded.source_schema_version,
            source_snapshot_sha256 = excluded.source_snapshot_sha256,
            raw_payload_sha256 = excluded.raw_payload_sha256,
            ingredient_label_sha256 = excluded.ingredient_label_sha256,
            source_image_url = excluded.source_image_url,
            ingredient_image_url = excluded.ingredient_image_url,
            source_full_image_url = excluded.source_full_image_url,
            canonical_image_url = excluded.canonical_image_url,
            source_image_sha256 = excluded.source_image_sha256,
            image_sha256 = excluded.image_sha256,
            image_mime_type = excluded.image_mime_type,
            image_width = excluded.image_width,
            image_height = excluded.image_height,
            image_byte_size = excluded.image_byte_size,
            image_has_alpha = excluded.image_has_alpha,
            image_treatment = excluded.image_treatment,
            image_review_status = excluded.image_review_status,
            image_review_scope = excluded.image_review_scope,
            image_reviewed_at = excluded.image_reviewed_at,
            image_reviewer = excluded.image_reviewer,
            image_processing_model = excluded.image_processing_model,
            image_processing_version = excluded.image_processing_version,
            image_processing_provider = excluded.image_processing_provider,
            candidate_sha256 = excluded.candidate_sha256,
            packshot_release_sha256 = excluded.packshot_release_sha256,
            image_license = excluded.image_license,
            image_attribution = excluded.image_attribution,
            data_license = excluded.data_license,
            content_license = excluded.content_license,
            clinical_review_status = excluded.clinical_review_status,
            source_photo_validated = excluded.source_photo_validated,
            source_ingredients_complete = excluded.source_ingredients_complete,
            quality_score = excluded.quality_score,
            import_status = 'published',
            quarantine_reason = null,
            is_published = true,
            updated_at = now()
        `;
      }

      const rows = await transaction<Array<{
        barcode: string;
        image_sha256: string;
        source_image_sha256: string;
        candidate_sha256: string;
        canonical_image_url: string;
        packshot_release_sha256: string;
        image_reviewer: string;
      }>>`
        select barcode, image_sha256, source_image_sha256, candidate_sha256,
               canonical_image_url, packshot_release_sha256, image_reviewer
        from external_catalogue_products
        where source_catalogue = 'open-beauty-facts'
          and is_published = true
        order by barcode
      `;
      if (rows.length !== expected.size) throw new Error(`Neon release has ${rows.length}/${expected.size} published records.`);
      for (const row of rows) {
        const product = expected.get(row.barcode);
        if (
          !product
          || row.image_sha256 !== product.imageSha256
          || row.source_image_sha256 !== product.sourceImageSha256
          || row.candidate_sha256 !== product.candidateSha256
          || row.canonical_image_url !== product.canonicalImageUrl
          || row.packshot_release_sha256 !== releaseSha256
          || row.image_reviewer !== product.imageReviewer
        ) throw new Error(`${row.barcode}: Neon release membership or image provenance mismatch.`);
      }

      const active = await transaction<Array<{ release_sha256: string; product_count: number }>>`
        select release_sha256, product_count
        from external_catalogue_releases
        where status = 'active'
      `;
      if (active.length !== 1 || active[0]?.release_sha256 !== releaseSha256 || active[0]?.product_count !== expected.size) {
        throw new Error('Neon active release does not match the reviewed packshot manifest.');
      }

      await transaction`
        alter table external_catalogue_products
        validate constraint external_catalogue_published_packshot_check
      `;
    });

    console.log(`Activated reviewed packshot release ${releaseSha256.slice(0, 12)} with ${expected.size} records in Neon.`);
  } finally {
    await sql.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
