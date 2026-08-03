import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { products } from '../../data/catalogue';
import {
  customerSignInPath,
  resolveSignInContinuation,
  resolveSignInIntent,
} from '../../lib/auth/sign-in-intent';
import {
  isDevelopmentCustomerFixtureEnabled,
  SYNTHETIC_CUSTOMER_ENV_FLAG,
} from '../../lib/customer/access-policy';

test('sign-in continuation accepts only the two internal product roots', () => {
  assert.equal(resolveSignInContinuation('/me'), '/me');
  assert.equal(resolveSignInContinuation('/ops'), '/ops');
  assert.equal(resolveSignInContinuation('/me/shelf'), '/ops');
  assert.equal(resolveSignInContinuation('https://example.com'), '/ops');
  assert.equal(resolveSignInContinuation('//example.com'), '/ops');
  assert.equal(resolveSignInContinuation('/%2fexample.com'), '/ops');
  assert.equal(resolveSignInContinuation(null), '/ops');
  assert.equal(resolveSignInIntent('/me'), 'customer');
  assert.equal(resolveSignInIntent('/ops'), 'operator');
  assert.equal(customerSignInPath(), '/sign-in?next=/me');
});

test('the synthetic customer requires development plus the explicit local flag', () => {
  assert.equal(SYNTHETIC_CUSTOMER_ENV_FLAG, 'JELOCARE_ENABLE_SYNTHETIC_CUSTOMER');
  assert.equal(isDevelopmentCustomerFixtureEnabled({
    NODE_ENV: 'development',
    JELOCARE_ENABLE_SYNTHETIC_CUSTOMER: 'true',
  }), true);
  assert.equal(isDevelopmentCustomerFixtureEnabled({
    NODE_ENV: 'production',
    JELOCARE_ENABLE_SYNTHETIC_CUSTOMER: 'true',
  }), false);
  assert.equal(isDevelopmentCustomerFixtureEnabled({
    NODE_ENV: 'development',
    JELOCARE_ENABLE_SYNTHETIC_CUSTOMER: 'false',
  }), false);
  assert.equal(isDevelopmentCustomerFixtureEnabled({
    NODE_ENV: 'test',
    JELOCARE_ENABLE_SYNTHETIC_CUSTOMER: 'true',
  }), false);
});

test('the development presentation is server-only, synthetic, and local-data-only', () => {
  const fixture = readFileSync('lib/customer/development-fixture.ts', 'utf8');
  const access = readFileSync('lib/customer/access.ts', 'utf8');
  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');

  assert.match(fixture, /import 'server-only'/);
  assert.match(fixture, /amara\.customer@example\.test/);
  assert.match(fixture, /Amara Example/);
  assert.match(fixture, /import \{ products \} from '@\/data\/catalogue'/);
  assert.doesNotMatch(fixture, /fetch\(|getPostgresClient|NEON_|sql`|https?:\/\//);
  assert.match(access, /isDevelopmentCustomerFixtureEnabled\(process\.env\)/);
  assert.match(access, /const identity = await getAuthSubject\(\)/);
  assert.doesNotMatch(access, /searchParams|cookies\(\)|headers\(\)/);
  assert.doesNotMatch(home, /__qa|fixture|scenario selector|test customer/i);
});

test('the synthetic routine is customer-authored and uses a coherent exact-product trio', () => {
  const fixture = readFileSync('lib/customer/development-fixture.ts', 'utf8');
  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  const routineSlugs = [
    'cosrx-salicylic-acid-daily-gentle-cleanser',
    'cerave-pm-facial-moisturising-lotion-52ml',
    'eucerin-oil-control-sun-gel-cream-spf50-50ml',
  ];

  for (const slug of routineSlugs) {
    const product = products.find((candidate) => candidate.slug === slug);
    assert.ok(product?.image, `${slug} must remain an exact display-approved catalogue product`);
  }
  assert.match(fixture, /routineProvenance: 'Amara’s routine'/);
  assert.match(home, /viewModel\.routineProvenance/);
  assert.doesNotMatch(fixture, /some-by-mi-aha-bha-pha-miracle-toner/);
  assert.doesNotMatch(fixture, /recommended|JeloCare routine/i);
});

test('the real customer route owns account sign-out and no unreleased Me links', () => {
  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  const dock = readFileSync('components/me/shell/me-workspace-dock.tsx', 'utf8');

  assert.match(home, /authClient\.signOut\(\)/);
  assert.match(home, /window\.location\.assign\('\/sign-in\?next=\/me'\)/);
  assert.match(dock, /ME_RELEASED_WORKSPACE_NAVIGATION/);
  assert.doesNotMatch(home, /href=["'{`]\/me\/(concerns|shelf|routine)/);
});
