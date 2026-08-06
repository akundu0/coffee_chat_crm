import { createInMemoryAdapter } from '../src/lib/storageService.js';

describe('createInMemoryAdapter', () => {
  it('returns undefined for a key that was never set', async () => {
    const adapter = createInMemoryAdapter();
    expect(await adapter.get('missing')).toBeUndefined();
  });

  it('stores and retrieves a value', async () => {
    const adapter = createInMemoryAdapter();
    await adapter.set('key', { a: 1 });
    expect(await adapter.get('key')).toEqual({ a: 1 });
  });

  it('overwrites an existing value', async () => {
    const adapter = createInMemoryAdapter();
    await adapter.set('key', 'first');
    await adapter.set('key', 'second');
    expect(await adapter.get('key')).toBe('second');
  });

  it('removes a value', async () => {
    const adapter = createInMemoryAdapter();
    await adapter.set('key', 'value');
    await adapter.remove('key');
    expect(await adapter.get('key')).toBeUndefined();
  });

  it('can be seeded with initial data', async () => {
    const adapter = createInMemoryAdapter({ seeded: 'value' });
    expect(await adapter.get('seeded')).toBe('value');
  });

  it('keeps separate adapter instances independent', async () => {
    const a = createInMemoryAdapter();
    const b = createInMemoryAdapter();
    await a.set('key', 'a-value');
    expect(await b.get('key')).toBeUndefined();
  });
});
