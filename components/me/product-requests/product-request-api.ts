import {
  isProductRequest,
  type ProductRequest,
  type ProductRequestFields,
} from './product-request-model';

type JsonObject = Record<string, unknown>;

export class ProductRequestApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly canonicalSlug: string | null;

  constructor({
    message,
    status,
    code,
    canonicalSlug,
  }: {
    message: string;
    status: number;
    code?: string | null;
    canonicalSlug?: string | null;
  }) {
    super(message);
    this.name = 'ProductRequestApiError';
    this.status = status;
    this.code = code ?? null;
    this.canonicalSlug = canonicalSlug ?? null;
  }
}

export type ProductRequestMutationResult = {
  request: ProductRequest;
  replayed: boolean;
};

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function responseRequest(value: unknown): ProductRequest | null {
  if (isProductRequest(value)) return value;
  const object = asObject(value);
  if (!object) return null;
  for (const key of ['request', 'productRequest', 'data']) {
    if (isProductRequest(object[key])) return object[key];
  }
  return null;
}

function responseRequests(value: unknown): ProductRequest[] | null {
  if (Array.isArray(value) && value.every(isProductRequest)) return value;
  const object = asObject(value);
  if (!object) return null;
  for (const key of ['requests', 'productRequests', 'data']) {
    const candidate = object[key];
    if (Array.isArray(candidate) && candidate.every(isProductRequest)) return candidate;
  }
  return null;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function replayed(response: Response, value: unknown) {
  const object = asObject(value);
  return response.headers.get('Idempotency-Replayed') === 'true'
    || response.headers.get('X-Idempotent-Replay') === 'true'
    || object?.replayed === true
    || object?.idempotentReplay === true
    || object?.outcome === 'idempotent_replay';
}

async function apiResponse(response: Response) {
  const value = await parseJson(response);
  if (response.ok) return value;
  const object = asObject(value);
  throw new ProductRequestApiError({
    status: response.status,
    code: typeof object?.code === 'string' ? object.code : null,
    canonicalSlug: typeof object?.canonicalSlug === 'string' ? object.canonicalSlug : null,
    message: typeof object?.error === 'string'
      ? object.error
      : typeof object?.message === 'string'
        ? object.message
        : 'That request could not be completed.',
  });
}

async function requestMutation(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const value = await apiResponse(response);
  const request = responseRequest(value);
  if (!request) throw new ProductRequestApiError({
    status: response.status,
    message: 'The request response was incomplete. Refresh before trying again.',
  });
  return { request, replayed: replayed(response, value) } satisfies ProductRequestMutationResult;
}

export async function listProductRequests() {
  const response = await fetch('/api/me/product-requests', { cache: 'no-store' });
  const value = await apiResponse(response);
  const requests = responseRequests(value);
  if (!requests) throw new ProductRequestApiError({
    status: response.status,
    message: 'Your private product requests could not be read.',
  });
  return requests;
}

export async function getProductRequest(id: string) {
  const response = await fetch(`/api/me/product-requests/${encodeURIComponent(id)}`, { cache: 'no-store' });
  const value = await apiResponse(response);
  const request = responseRequest(value);
  if (!request) throw new ProductRequestApiError({
    status: response.status,
    message: 'That private product request could not be read.',
  });
  return request;
}

export function createProductRequest(
  fields: {
    brand: string;
    fullPackName: string;
    printedSizeVariant: string;
    category?: string;
    retailerLabel?: string;
    sourceUrl?: string;
    photoIdentificationConsent: boolean;
  },
  options: { submit: boolean; idempotencyKey: string },
) {
  return requestMutation('/api/me/product-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, ...options }),
  });
}

export function updateProductRequest(
  id: string,
  payload: Partial<ProductRequestFields> & {
    revision: number;
    idempotencyKey: string;
    submit?: boolean;
  },
) {
  return requestMutation(`/api/me/product-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteProductRequest(
  id: string,
  payload: { revision: number; idempotencyKey: string },
) {
  const response = await fetch(`/api/me/product-requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const value = await apiResponse(response);
  return { replayed: replayed(response, value) };
}

export function uploadProductRequestImage(
  id: string,
  image: File,
  payload: { revision: number; idempotencyKey: string },
) {
  const body = new FormData();
  body.set('image', image);
  body.set('revision', String(payload.revision));
  body.set('idempotencyKey', payload.idempotencyKey);
  return requestMutation(`/api/me/product-requests/${encodeURIComponent(id)}/image`, {
    method: 'POST',
    body,
  });
}

export function removeProductRequestImage(
  id: string,
  payload: { revision: number; idempotencyKey: string },
) {
  return requestMutation(`/api/me/product-requests/${encodeURIComponent(id)}/image`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function productRequestImageUrl(request: ProductRequest) {
  return `/api/me/product-requests/${encodeURIComponent(request.id)}/image?revision=${request.revision}`;
}
