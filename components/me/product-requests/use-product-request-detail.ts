'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  deleteProductRequest,
  getProductRequest,
  ProductRequestApiError,
  removeProductRequestImage,
  updateProductRequest,
  uploadProductRequestImage,
} from './product-request-api';
import {
  canEditProductRequestIdentity,
  canRevokeProductRequestPhotoConsent,
  createProductRequestFields,
  retryKeyFor,
  validateProductRequestFields,
  type ProductRequest,
  type ProductRequestFields,
  type RetryKey,
} from './product-request-model';
import {
  productRequestErrorMessage,
  productRequestReplayMessage,
} from './product-request-ui-utils';

type DetailStatus = 'loading' | 'ready' | 'error' | 'not-found';

export function useProductRequestDetail(
  requestId: string,
  synthetic: boolean,
  initialRequest?: ProductRequest | null,
) {
  const router = useRouter();
  const syntheticRequest = synthetic && initialRequest?.id === requestId ? initialRequest : null;
  const [request, setRequest] = useState<ProductRequest | null>(syntheticRequest);
  const [fields, setFields] = useState<ProductRequestFields>(() => (
    createProductRequestFields(syntheticRequest ?? undefined)
  ));
  const [status, setStatus] = useState<DetailStatus>(() => (
    synthetic ? syntheticRequest ? 'ready' : 'not-found' : 'loading'
  ));
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [canonicalSlug, setCanonicalSlug] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const retryKeys = useRef<Record<string, RetryKey | null>>({});

  const load = useCallback(async (announce = false) => {
    await Promise.resolve();
    if (announce) setStatus('loading');
    if (synthetic) {
      setRequest(syntheticRequest);
      setFields(createProductRequestFields(syntheticRequest ?? undefined));
      setStatus(syntheticRequest ? 'ready' : 'not-found');
      if (syntheticRequest && announce) setFeedback('Development preview restored.');
      return;
    }
    try {
      const next = await getProductRequest(requestId);
      setRequest(next);
      setFields(createProductRequestFields(next));
      setStatus('ready');
      if (announce) setFeedback('Latest revision loaded.');
    } catch (error) {
      if (error instanceof ProductRequestApiError && error.status === 404) {
        setStatus('not-found');
      } else {
        setFeedback(productRequestErrorMessage(error));
        setStatus('error');
      }
    }
  }, [requestId, synthetic, syntheticRequest]);

  useEffect(() => {
    if (synthetic) return;
    let current = true;
    getProductRequest(requestId).then((next) => {
      if (!current) return;
      setRequest(next);
      setFields(createProductRequestFields(next ?? undefined));
      setStatus(next ? 'ready' : 'not-found');
    }).catch((error: unknown) => {
      if (!current) return;
      if (error instanceof ProductRequestApiError && error.status === 404) {
        setStatus('not-found');
      } else {
        setFeedback(productRequestErrorMessage(error));
        setStatus('error');
      }
    });
    return () => { current = false; };
  }, [requestId, synthetic]);

  function operationKey(name: string, payload: unknown) {
    const next = retryKeyFor(retryKeys.current[name] ?? null, payload);
    retryKeys.current[name] = next;
    return next.idempotencyKey;
  }

  function settle(name: string) {
    retryKeys.current[name] = null;
  }

  async function recoverConflict() {
    try {
      const latest = await getProductRequest(requestId);
      setRequest(latest);
      setFields(createProductRequestFields(latest));
      setReplacement(null);
      setEditing(false);
      setStatus('ready');
      setFeedback('Another update was saved first. The latest revision is now loaded; review it before retrying.');
    } catch (error) {
      setFeedback(`A revision conflict occurred, and the latest request could not be loaded. ${productRequestErrorMessage(error)}`);
    }
  }

  function handleMutationError(error: unknown) {
    if (error instanceof ProductRequestApiError && error.code === 'REVISION_CONFLICT') {
      void recoverConflict();
      return;
    }
    if (error instanceof ProductRequestApiError && error.code === 'ACTIVE_CATALOGUE_MATCH') {
      setCanonicalSlug(error.canonicalSlug);
      setFeedback('The catalogue now has this exact identity. Your original request is unchanged and remains visible here.');
      return;
    }
    setFeedback(productRequestErrorMessage(error));
  }

  function beginEdit() {
    if (request && !synthetic && canEditProductRequestIdentity(request)) setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    if (request) setFields(createProductRequestFields(request));
  }

  function saveChanges() {
    if (!request || pending || synthetic || !canEditProductRequestIdentity(request)) return;
    const validation = validateProductRequestFields(fields);
    if (validation) { setFeedback(validation); return; }
    const payload = { ...fields, revision: request.revision };
    startTransition(async () => {
      try {
        const result = await updateProductRequest(request.id, {
          ...fields,
          revision: request.revision,
          idempotencyKey: operationKey('edit', payload),
        });
        settle('edit');
        setRequest(result.request);
        setFields(createProductRequestFields(result.request));
        setEditing(false);
        setFeedback(productRequestReplayMessage('Changes saved.', result.replayed));
      } catch (error) { handleMutationError(error); }
    });
  }

  function submitRequest() {
    if (!request || pending || synthetic) return;
    const payload = { revision: request.revision, submit: true };
    startTransition(async () => {
      try {
        const result = await updateProductRequest(request.id, {
          revision: request.revision,
          idempotencyKey: operationKey('submit', payload),
          submit: true,
        });
        settle('submit');
        setRequest(result.request);
        setFields(createProductRequestFields(result.request));
        setFeedback(productRequestReplayMessage(
          'Request sent for review.',
          result.replayed,
        ));
      } catch (error) { handleMutationError(error); }
    });
  }

  function changeReplacement(file: File | null, error: string) {
    setReplacement(file);
    setFeedback(error);
  }

  function replacePhoto() {
    if (!request || !replacement || pending || synthetic) return;
    const payload = {
      revision: request.revision,
      name: replacement.name,
      size: replacement.size,
      modified: replacement.lastModified,
    };
    startTransition(async () => {
      try {
        const result = await uploadProductRequestImage(request.id, replacement, {
          revision: request.revision,
          idempotencyKey: operationKey('photo-replace', payload),
        });
        settle('photo-replace');
        setRequest(result.request);
        setFields(createProductRequestFields(result.request));
        setReplacement(null);
        setFeedback(productRequestReplayMessage(
          request.photo.present ? 'Private photo replaced.' : 'Private photo added.',
          result.replayed,
        ));
      } catch (error) { handleMutationError(error); }
    });
  }

  function removePhoto() {
    if (!request || pending || synthetic || !request.photo.present) return;
    if (!window.confirm('Remove this private photo from the request?')) return;
    const payload = { revision: request.revision };
    startTransition(async () => {
      try {
        const result = await removeProductRequestImage(request.id, {
          revision: request.revision,
          idempotencyKey: operationKey('photo-remove', payload),
        });
        settle('photo-remove');
        setRequest(result.request);
        setFields(createProductRequestFields(result.request));
        setFeedback(productRequestReplayMessage('Private photo removed.', result.replayed));
      } catch (error) { handleMutationError(error); }
    });
  }

  function revokePhotoConsent() {
    if (
      !request
      || pending
      || synthetic
      || !canRevokeProductRequestPhotoConsent(request)
    ) return;
    const payload = {
      revision: request.revision,
      photoIdentificationConsent: false,
    };
    startTransition(async () => {
      try {
        const result = await updateProductRequest(request.id, {
          ...payload,
          idempotencyKey: operationKey('consent-revoke', payload),
        });
        settle('consent-revoke');
        setRequest(result.request);
        setFields(createProductRequestFields(result.request));
        setFeedback(productRequestReplayMessage(
          'Photo identification permission revoked.',
          result.replayed,
        ));
      } catch (error) { handleMutationError(error); }
    });
  }

  function removeRequest() {
    if (!request || pending || synthetic) return;
    const payload = { revision: request.revision };
    startTransition(async () => {
      try {
        const result = await deleteProductRequest(request.id, {
          revision: request.revision,
          idempotencyKey: operationKey('delete', payload),
        });
        settle('delete');
        setFeedback(productRequestReplayMessage('Private request deleted.', result.replayed));
        router.replace(`/me/shelf?outcome=${result.replayed ? 'delete-retry-confirmed' : 'deleted'}`);
        router.refresh();
      } catch (error) { handleMutationError(error); }
    });
  }

  return {
    request,
    fields,
    setFields,
    status,
    editing,
    feedback,
    canonicalSlug,
    replacement,
    pending,
    synthetic,
    load,
    beginEdit,
    cancelEdit,
    saveChanges,
    submitRequest,
    changeReplacement,
    replacePhoto,
    removePhoto,
    revokePhotoConsent,
    removeRequest,
  };
}
