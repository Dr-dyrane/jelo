import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CustomerAccessIdentity } from './access-policy';
import type { CustomerConcernRecord, CustomerConcernRepository } from './concern-repository';
import { createCustomerConcernService } from './concern-policy';

const sessionIdentity: CustomerAccessIdentity = {
  subject: 'auth0|customer-session-001',
  name: 'Amara Okafor',
  source: 'session',
  displayName: 'Amara',
  preferredFirstName: 'Amara',
};

const syntheticIdentity: CustomerAccessIdentity = {
  subject: 'synthetic-development',
  name: 'Synthetic Customer',
  source: 'synthetic-development',
  displayName: 'Synthetic',
  preferredFirstName: 'Synthetic',
};

function createMockRepository(): CustomerConcernRepository & {
  store: Map<string, CustomerConcernRecord>;
} {
  const store = new Map<string, CustomerConcernRecord>();
  const repository: CustomerConcernRepository & { store: Map<string, CustomerConcernRecord> } = {
    store,
    async list() {
      return [...store.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },
    async add(_owner: string, concernSlug: string) {
      if (store.has(concernSlug)) return 'already_saved';
      store.set(concernSlug, {
        concernSlug,
        savedAt: new Date().toISOString(),
        origin: 'customer',
      });
      return 'added';
    },
    async remove(_owner: string, concernSlug: string) {
      if (!store.has(concernSlug)) return 'already_removed';
      store.delete(concernSlug);
      return 'removed';
    },
    async clear() {
      const count = store.size;
      store.clear();
      return count;
    },
  };
  return repository;
}

describe('customerConcernService', () => {
  let repository: ReturnType<typeof createMockRepository>;
  let service: ReturnType<typeof createCustomerConcernService>;

  beforeEach(() => {
    repository = createMockRepository();
    service = createCustomerConcernService(repository);
    vi.restoreAllMocks();
  });

  it('returns unavailable for read with a synthetic identity', async () => {
    const result = await service.read(syntheticIdentity);
    expect(result.status).toBe('unavailable');
    expect(result.concerns).toEqual([]);
    expect(result.message).toBeTruthy();
  });

  it('returns error for add with a synthetic identity', async () => {
    const result = await service.add(syntheticIdentity, 'acne-breakouts');
    expect(result.status).toBe('error');
    expect(result.concernSlug).toBe('acne-breakouts');
    expect(result.message).toBeTruthy();
  });

  it('returns error for remove with a synthetic identity', async () => {
    const result = await service.remove(syntheticIdentity, 'acne-breakouts');
    expect(result.status).toBe('error');
    expect(result.concernSlug).toBe('acne-breakouts');
    expect(result.message).toBeTruthy();
  });

  it('returns error for clear with a synthetic identity', async () => {
    const result = await service.clear(syntheticIdentity);
    expect(result.status).toBe('error');
    expect(result.message).toBeTruthy();
  });

  it('saves a valid concern slug', async () => {
    const result = await service.add(sessionIdentity, 'acne-breakouts');
    expect(result.status).toBe('saved');
    expect(result.concernSlug).toBe('acne-breakouts');
    expect(result.message).toBeTruthy();
  });

  it('rejects an unknown concern slug', async () => {
    const result = await service.add(sessionIdentity, 'not-a-real-concern');
    expect(result.status).toBe('error');
    expect(result.concernSlug).toBe('not-a-real-concern');
    expect(result.message).toBeTruthy();
  });

  it('rejects a condition-pattern slug as escalation-only', async () => {
    const result = await service.add(sessionIdentity, 'atopic-eczema-pattern');
    expect(result.status).toBe('error');
    expect(result.concernSlug).toBe('atopic-eczema-pattern');
    expect(result.message).toBeTruthy();
  });

  it('removes a saved concern', async () => {
    await service.add(sessionIdentity, 'acne-breakouts');
    const result = await service.remove(sessionIdentity, 'acne-breakouts');
    expect(result.status).toBe('removed');
    expect(result.concernSlug).toBe('acne-breakouts');
    expect(result.message).toBeTruthy();
  });

  it('clears all saved concerns', async () => {
    await service.add(sessionIdentity, 'acne-breakouts');
    await service.add(sessionIdentity, 'dark-spots');
    const result = await service.clear(sessionIdentity);
    expect(result.status).toBe('cleared');
    expect(result.message).toBeTruthy();
  });

  it('returns ready with the concerns list for a session identity', async () => {
    await service.add(sessionIdentity, 'acne-breakouts');
    await service.add(sessionIdentity, 'dark-spots');
    const result = await service.read(sessionIdentity);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.concerns.length).toBe(2);
      expect(result.concerns.map(c => c.concernSlug)).toContain('acne-breakouts');
      expect(result.concerns.map(c => c.concernSlug)).toContain('dark-spots');
    }
  });
});
