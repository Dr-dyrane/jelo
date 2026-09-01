import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { customerCapabilities } from '../../lib/customer/customer-capabilities';
import {
  customerProductRequestLimitMessage,
  MAX_ACTIVE_CUSTOMER_PRODUCT_REQUEST_IMAGES,
  MAX_OPEN_CUSTOMER_PRODUCT_REQUESTS,
  OPEN_CUSTOMER_PRODUCT_REQUEST_STATES,
} from '../../lib/customer/product-request-limits';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

test('the private request capacity policy is explicit and customer-readable', () => {
  assert.equal(MAX_OPEN_CUSTOMER_PRODUCT_REQUESTS, 12);
  assert.equal(MAX_ACTIVE_CUSTOMER_PRODUCT_REQUEST_IMAGES, 6);
  assert.deepEqual(OPEN_CUSTOMER_PRODUCT_REQUEST_STATES, [
    'draft',
    'pending',
    'in_review',
    'needs_info',
  ]);
  assert.equal(
    customerProductRequestLimitMessage('open_requests', 12),
    'You can keep up to 12 open product requests. Close one before adding another.',
  );
  assert.equal(
    customerProductRequestLimitMessage('private_photos', 6),
    'You can keep private photos on up to 6 product requests. Remove one before adding another.',
  );
  assert.equal(customerCapabilities.requestLimits, true);
});

test('request and photo capacity decisions are serialized per owner', () => {
  const repository = source('lib/customer/product-request-repository.ts');
  assert.match(repository, /pg_advisory_xact_lock/);
  assert.match(repository, /["']jelocare\.product-request-capacity:["']/);
  assert.doesNotMatch(repository, /["']jelocare\.product-request-capacity\\0["']/);
  assert.match(repository, /where owner_subject = \$\{ownerSubject\}/g);
  assert.match(repository, /lifecycle_state::text = any/);

  const create = repository.slice(
    repository.indexOf('async create('),
    repository.indexOf('async update('),
  );
  assert.ok(
    create.indexOf('exactActiveCatalogueMatch') <
      create.indexOf('lockOwnerProductRequestCapacity'),
  );
  assert.ok(
    create.indexOf('lockOwnerProductRequestCapacity') <
      create.indexOf('openRequestCount'),
  );
  assert.ok(
    create.indexOf('openRequestCount') <
      create.indexOf('insert into public.customer_product_requests'),
  );
  assert.match(create, /status: 'limit_reached',[\s\S]*kind: 'open_requests'/);

  const replace = repository.slice(
    repository.indexOf('async replaceImage('),
    repository.indexOf('async removeImage('),
  );
  assert.ok(
    replace.indexOf('lockOwnerProductRequestCapacity') <
      replace.indexOf('activePhotoCount'),
  );
  assert.ok(
    replace.indexOf('activePhotoCount') <
      replace.indexOf('update public.customer_product_requests'),
  );
  assert.match(
    replace,
    /if \(\s*!oldImage[\s\S]*MAX_ACTIVE_CUSTOMER_PRODUCT_REQUEST_IMAGES/,
  );
  assert.match(
    replace,
    /status: 'limit_reached',[\s\S]*kind: 'private_photos'/,
  );

  const consentRevocation = repository.slice(
    repository.indexOf('async revokePhotoIdentificationConsent('),
    repository.indexOf('async withdraw('),
  );
  assert.doesNotMatch(consentRevocation, /activePhotoCount|limit_reached/);
});

test('limit responses are private conflicts and rejected uploads are discarded', () => {
  const api = source('lib/customer/product-request-api.ts');
  assert.match(api, /case 'limit_reached'/);
  assert.match(api, /OWNER_REQUEST_LIMIT/);
  assert.match(api, /OWNER_PHOTO_LIMIT/);
  assert.match(api, /status: 409/);

  const service = source('lib/customer/product-request-service.ts');
  const replace = service.slice(
    service.indexOf('async replaceImage('),
    service.indexOf('async removeImage('),
  );
  assert.match(
    replace,
    /if \(result\.status === 'updated'\)[\s\S]*else \{[\s\S]*discardUnattachedBlob/,
  );
  assert.match(replace, /if \(stored\) await discardUnattachedBlob/);
});
