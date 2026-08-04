'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import type { CustomerPortalViewModel } from '@/lib/customer/portal-model';
import {
  createProductRequest,
  ProductRequestApiError,
  updateProductRequest,
  uploadProductRequestImage,
} from './product-request-api';
import {
  createProductRequestFields,
  findExactCanonicalIdentity,
  requestFieldPayload,
  retryKeyFor,
  validateProductRequestFields,
  type ProductRequest,
  type RetryKey,
} from './product-request-model';
import {
  productRequestErrorMessage,
  productRequestReplayMessage,
} from './product-request-ui-utils';

export function useProductRequestAdd(viewModel: CustomerPortalViewModel) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [fields, setFields] = useState(createProductRequestFields);
  const [photo, setPhoto] = useState<File | null>(null);
  const [feedback, setFeedback] = useState('');
  const [canonicalSlug, setCanonicalSlug] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<ProductRequest | null>(null);
  const [pending, startTransition] = useTransition();
  const createKeyRef = useRef<RetryKey | null>(null);
  const imageKeyRef = useRef<RetryKey | null>(null);
  const submitKeyRef = useRef<RetryKey | null>(null);
  const exact = useMemo(
    () => findExactCanonicalIdentity(viewModel.catalogue ?? [], search),
    [search, viewModel.catalogue],
  );
  const canOpenRequest = Boolean(search.trim()) && !exact;

  function changeSearch(value: string) {
    setSearch(value);
    setCanonicalSlug(null);
    if (findExactCanonicalIdentity(viewModel.catalogue ?? [], value)) setRequestOpen(false);
  }

  function changePhoto(file: File | null, error: string) {
    setPhoto(file);
    setFeedback(error);
  }

  function save(submit: boolean) {
    if (pending) return;
    if (viewModel.account.synthetic) {
      setFeedback('Development preview is read-only. Sign in with a real customer account to save a private request.');
      return;
    }
    const validation = validateProductRequestFields(fields);
    if (validation) {
      setFeedback(validation);
      return;
    }
    const identityQuery = `${fields.brand} ${fields.fullPackName} ${fields.printedSizeVariant}`;
    const canonical = findExactCanonicalIdentity(viewModel.catalogue ?? [], identityQuery);
    if (canonical) {
      setCanonicalSlug(canonical.slug);
      setFeedback('This exact identity is already in the catalogue. No private request was created.');
      return;
    }
    setCanonicalSlug(null);
    setFeedback('');
    startTransition(async () => {
      const createPayload = { ...requestFieldPayload(fields), submit: photo ? false : submit };
      const createRetry = retryKeyFor(createKeyRef.current, createPayload);
      createKeyRef.current = createRetry;
      let persisted: ProductRequest | null = null;
      let anyReplay = false;
      try {
        const created = await createProductRequest(requestFieldPayload(fields), {
          submit: photo ? false : submit,
          idempotencyKey: createRetry.idempotencyKey,
        });
        persisted = created.request;
        anyReplay ||= created.replayed;
        setCreatedRequest(persisted);

        if (photo) {
          const imagePayload = {
            requestId: persisted.id,
            revision: persisted.revision,
            name: photo.name,
            size: photo.size,
            modified: photo.lastModified,
          };
          const imageRetry = retryKeyFor(imageKeyRef.current, imagePayload);
          imageKeyRef.current = imageRetry;
          const uploaded = await uploadProductRequestImage(persisted.id, photo, {
            revision: persisted.revision,
            idempotencyKey: imageRetry.idempotencyKey,
          });
          persisted = uploaded.request;
          anyReplay ||= uploaded.replayed;
          setCreatedRequest(persisted);

          if (submit) {
            const submitPayload = { requestId: persisted.id, revision: persisted.revision, submit: true };
            const submitRetry = retryKeyFor(submitKeyRef.current, submitPayload);
            submitKeyRef.current = submitRetry;
            const submitted = await updateProductRequest(persisted.id, {
              revision: persisted.revision,
              idempotencyKey: submitRetry.idempotencyKey,
              submit: true,
            });
            persisted = submitted.request;
            anyReplay ||= submitted.replayed;
            setCreatedRequest(persisted);
          }
        }

        createKeyRef.current = null;
        imageKeyRef.current = null;
        submitKeyRef.current = null;
        setFeedback(productRequestReplayMessage(
          submit ? 'Request sent for review.' : 'Draft saved.',
          anyReplay,
        ));
        router.push(
          `/me/shelf/request/${encodeURIComponent(persisted.id)}?outcome=${anyReplay ? 'retry-confirmed' : 'created'}`,
        );
        router.refresh();
      } catch (error) {
        if (error instanceof ProductRequestApiError && error.code === 'ACTIVE_CATALOGUE_MATCH') {
          setCanonicalSlug(error.canonicalSlug);
          setFeedback('The catalogue now has this exact identity. Your description was not substituted or submitted.');
          return;
        }
        if (error instanceof ProductRequestApiError && error.code === 'REVISION_CONFLICT' && persisted) {
          setFeedback('The saved request changed while the photo or submission was being added. Open the saved request to continue with the latest version.');
          return;
        }
        setFeedback(
          persisted
            ? `${productRequestErrorMessage(error)} Your private draft is safe; retry this same action or open it below.`
            : productRequestErrorMessage(error),
        );
      }
    });
  }

  return {
    search,
    changeSearch,
    requestOpen,
    openRequest: () => setRequestOpen(true),
    exact,
    canOpenRequest,
    fields,
    setFields,
    photo,
    changePhoto,
    feedback,
    canonicalSlug,
    createdRequest,
    pending,
    locked: pending || Boolean(createdRequest) || viewModel.account.synthetic,
    synthetic: viewModel.account.synthetic,
    save,
  };
}
